# CI/CD Pipeline Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế CI/CD pipeline production-ready cho Stock Intelligence SaaS monorepo, bao gồm build strategy, test automation, deployment flows, rollback mechanism và environment management.

---

# 1. Pipeline Principles

1. **Fast Feedback** — PR checks phải xong < 5 phút.
2. **Affected-Only** — Chỉ build/test packages bị thay đổi (TurboRepo).
3. **Fail Fast** — Lint + type check trước, tests sau.
4. **Immutable Artifacts** — Docker images tagged bằng commit SHA.
5. **Zero-Downtime Deploys** — Rolling update, migration trước deploy.
6. **Rollback Always Ready** — 1-click rollback tới version trước.

---

# 2. Environment Strategy

| Environment | Branch | Deploy Trigger | Purpose |
|---|---|---|---|
| Local | — | Manual | Developer workstation |
| CI | PR branches | Automatic (PR open/update) | Validation |
| Staging | `main` | Auto-deploy on merge | QA / Integration testing |
| Production | Git tags `v*` | Manual approval + Auto-deploy | Live users |

---

# 3. Pipeline Overview

```text
PR Open/Update           Merge to main           Git Tag (v1.x.x)
     │                        │                        │
     ▼                        ▼                        ▼
┌──────────┐          ┌──────────────┐          ┌──────────────┐
│  CI Check │          │ Deploy Staging│          │ Deploy Prod   │
│           │          │              │          │              │
│ 1. Lint   │          │ 1. Build all │          │ 1. Build all │
│ 2. Types  │          │ 2. Full tests│          │ 2. Full tests│
│ 3. Tests  │          │ 3. Docker    │          │ 3. Docker    │
│    (affected)│        │ 4. Push images│         │ 4. Push images│
│ 4. Build  │          │ 5. Migrate DB│          │ 5. Approval  │
│    (affected)│        │ 6. Deploy    │          │ 6. Migrate DB│
│ 5. Coverage│          │ 7. Smoke test│          │ 7. Deploy    │
└──────────┘          └──────────────┘          │ 8. Smoke test│
                                                │ 9. Monitor   │
                                                └──────────────┘
```

---

# 4. PR Check Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI Check

on:
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Stage 1: Fast checks (parallel)
      - name: Lint
        run: pnpm turbo lint --filter=...[origin/main]

      - name: Type Check
        run: pnpm turbo type-check --filter=...[origin/main]

      # Stage 2: Tests (affected only)
      - name: Unit Tests
        run: pnpm turbo test --filter=...[origin/main]

      - name: Build Check
        run: pnpm turbo build --filter=...[origin/main]

      # Stage 3: Coverage report
      - name: Upload Coverage
        uses: codecov/codecov-action@v4
```

---

# 5. Staging Deploy Pipeline

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Full test suite
      - name: Run All Tests
        run: pnpm turbo test

      # Build Docker images
      - name: Build API Image
        run: |
          docker build -f infra/docker/Dockerfile.api \
            -t $REGISTRY/stock-intel-api:${{ github.sha }} .

      - name: Build Web Image
        run: |
          docker build -f infra/docker/Dockerfile.web \
            -t $REGISTRY/stock-intel-web:${{ github.sha }} .

      - name: Build Worker Images
        run: |
          for worker in ingestion processing ai; do
            docker build -f infra/docker/Dockerfile.worker \
              --build-arg WORKER=$worker \
              -t $REGISTRY/stock-intel-worker-$worker:${{ github.sha }} .
          done

      # Push images
      - name: Push Images
        run: docker push --all-tags $REGISTRY/stock-intel-*

      # Database migration (BEFORE deploy)
      - name: Run Migrations
        run: |
          pnpm --filter @stock-intel/db exec \
            prisma migrate deploy

      # Deploy to staging
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/api \
            api=$REGISTRY/stock-intel-api:${{ github.sha }} \
            --namespace=staging
          kubectl set image deployment/web \
            web=$REGISTRY/stock-intel-web:${{ github.sha }} \
            --namespace=staging
          # ... workers

      # Smoke tests
      - name: Smoke Test
        run: |
          curl -f https://staging-api.stockintel.com/health
          curl -f https://staging.stockintel.com
```

---

# 6. Production Deploy Pipeline

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment:
      name: production
      url: https://stockintel.com

    steps:
      # ... (same build steps as staging)

      # Manual approval gate
      - name: Await Approval
        uses: trstringer/manual-approval@v1
        with:
          approvers: lead-dev,cto
          minimum-approvals: 1

      # Migration
      - name: Run Migrations
        run: pnpm --filter @stock-intel/db exec prisma migrate deploy

      # Rolling deploy
      - name: Deploy to Production
        run: |
          kubectl set image deployment/api \
            api=$REGISTRY/stock-intel-api:${{ github.sha }} \
            --namespace=production
          kubectl rollout status deployment/api \
            --namespace=production --timeout=300s

      # Post-deploy verification
      - name: Production Smoke Test
        run: ./scripts/smoke-test-production.sh

      - name: Monitor Error Rate (5 min)
        run: ./scripts/post-deploy-monitor.sh
```

---

# 7. Database Migration Strategy

## Rules

1. **Migrations run BEFORE code deploy** — New code must work with old AND new schema.
2. **Forward-only** — No rollback migrations (add-only in production).
3. **Backward compatible** — New columns must be nullable or have defaults.
4. **No breaking changes** — Column rename = add new + migrate data + drop old (3 deploys).
5. **Migration lock** — Only 1 migration process at a time.

## Dangerous Operations (Require Special Handling)

| Operation | Risk | Strategy |
|---|---|---|
| Add column | Low | Add nullable, backfill later |
| Add index | Medium | CREATE INDEX CONCURRENTLY |
| Rename column | High | 3-phase: add → backfill → drop old |
| Drop column | High | 2-phase: stop reading → drop |
| Change type | High | Add new column → migrate → drop |

---

# 8. Docker Strategy

## Multi-stage Build

```dockerfile
# infra/docker/Dockerfile.api
FROM node:22-alpine AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY packages/utils/package.json packages/utils/
COPY apps/api/package.json apps/api/
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm turbo build --filter=@stock-intel/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Image Tagging

```text
$REGISTRY/stock-intel-api:abc1234     # commit SHA (immutable)
$REGISTRY/stock-intel-api:staging     # latest staging
$REGISTRY/stock-intel-api:v1.2.3      # release tag
$REGISTRY/stock-intel-api:latest      # latest production
```

---

# 9. Rollback Strategy

## Instant Rollback (< 1 minute)

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/api --namespace=production

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=5 --namespace=production
```

## Database Rollback

Database migrations are **forward-only**. If a migration causes issues:

1. Deploy new migration that fixes the issue (forward-fix)
2. Never run `prisma migrate reset` in production
3. If critical: restore from DB snapshot (last resort)

---

# 10. Monitoring Post-Deploy

## Automated Checks (5 minutes after deploy)

| Check | Threshold | Action |
|---|---|---|
| Error rate | > 1% increase | Auto-rollback |
| P95 latency | > 500ms | Alert |
| Health endpoint | Non-200 | Auto-rollback |
| Pod restarts | > 2 in 5 min | Alert + investigate |

## Deploy Notification

```text
Deploy completed:
  Version: v1.2.3 (abc1234)
  Environment: production
  Deployed by: @developer
  Changes: 5 commits
  Migration: yes (add user_preferences table)
  Status: ✅ Healthy
```

→ Slack / Discord notification

---

# 11. Secret Management

| Secret Type | Storage | Rotation |
|---|---|---|
| Database credentials | Kubernetes Secrets | 90 days |
| JWT signing keys | Kubernetes Secrets | On incident |
| API provider keys | Kubernetes Secrets | Per provider policy |
| Redis password | Kubernetes Secrets | 90 days |
| Docker registry creds | GitHub Secrets | 1 year |

### Rules

1. No secrets in code or git
2. No secrets in Docker images
3. Secrets injected via environment at runtime
4. Secret rotation must not require redeploy

---

# 12. Final Thesis

CI/CD tốt = deploy tự tin.

1. **PR checks** bảo vệ `main` branch
2. **Affected-only builds** giữ CI nhanh
3. **Immutable artifacts** đảm bảo reproducibility
4. **Migration trước deploy** đảm bảo data safety
5. **Auto-rollback** bảo vệ production
6. **Monitoring** verify mọi deploy
