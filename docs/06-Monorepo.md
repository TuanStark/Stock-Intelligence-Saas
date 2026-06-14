# Full Monorepo Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế full-stack monorepo production-ready cho Stock Intelligence SaaS, bao gồm Frontend, Backend, Workers, Shared Packages, Infra và Build Strategy để codebase scale tốt, boundary rõ, build nhanh và maintain lâu dài.

---

# 1. Mục tiêu của Full Monorepo Blueprint

Monorepo Blueprint định nghĩa:

- Repo được tổ chức như thế nào
- Frontend nằm ở đâu
- Backend nằm ở đâu
- Workers nằm ở đâu
- Shared code nằm ở đâu
- Infra nằm ở đâu
- Build / test / release chạy như thế nào
- Ownership và dependency rules ra sao

Đây là lớp chống:

- Repo loạn
- FE/BE lệch contract
- Shared code thành dumping ground
- Import chéo bừa bãi
- Build chậm
- CI/CD phình to
- Scale team đau đớn

---

# 2. Monorepo Design Principles

1. **One Product, One Repo**  
   Toàn bộ product nằm trong 1 repo.

2. **Apps are Deployable Units**  
   `apps/` là runtime boundary.

3. **Packages are Shared Contracts / Libraries**  
   `packages/` không phải nơi nhét code linh tinh.

4. **No Cross-App Imports**  
   App không import code trực tiếp từ app khác.

5. **Shared Code Must Be Intentional**  
   Shared phải có ownership rõ.

6. **Contracts First**  
   Shared contracts > shared logic.

7. **Build by Dependency Graph**  
   Chỉ build thứ bị ảnh hưởng.

8. **Boundaries Enforced by Tooling**  
   Boundary phải được tooling enforce.

---

# 3. Monorepo Top-Level Structure

```text
stock-intelligence-saas/
├── apps/
│   ├── web/                          # Next.js frontend
│   ├── api/                          # NestJS backend API
│   ├── worker-ingestion/             # Data ingestion workers
│   ├── worker-processing/            # Compute/signal workers
│   └── worker-ai/                    # AI summary workers
├── packages/
│   ├── contracts/                    # Shared TypeScript types + Zod schemas
│   ├── config/                       # Shared config (env, constants)
│   ├── db/                           # Prisma schema + migrations
│   ├── utils/                        # Pure utility functions
│   ├── eslint-config/                # Shared ESLint config
│   └── tsconfig/                     # Shared TypeScript config
├── infra/
│   ├── docker/                       # Dockerfiles per app
│   ├── k8s/                          # Kubernetes manifests
│   └── terraform/                    # Infrastructure as Code
├── tools/
│   ├── scripts/                      # Build / deploy / seed scripts
│   └── generators/                   # Code generators (plop/hygen)
├── docs/                             # Architecture docs (this folder)
├── .github/
│   └── workflows/                    # CI/CD pipelines
├── turbo.json                        # TurboRepo pipeline config
├── pnpm-workspace.yaml               # Workspace definition
├── package.json                      # Root package.json
├── .env.example                      # Environment template
└── README.md
```

---

# 4. Apps Layer (`apps/`)

## 4.1 `apps/web` — Frontend

```text
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (public)/                 # Public routes (no auth)
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── market/               # Market overview
│   │   │   └── stock/[symbol]/       # Stock detail
│   │   ├── (auth)/                   # Auth routes
│   │   │   ├── login/
│   │   │   └── register/
│   │   └── (dashboard)/              # Authenticated routes
│   │       ├── watchlists/
│   │       ├── portfolios/
│   │       ├── alerts/
│   │       └── settings/
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Base design system
│   │   ├── charts/                   # Chart components
│   │   ├── market/                   # Market-specific components
│   │   └── layout/                   # Layout components
│   ├── hooks/                        # Custom hooks
│   ├── lib/                          # Client utilities
│   │   ├── api.ts                    # API client (TanStack Query)
│   │   ├── ws.ts                     # WebSocket client
│   │   └── auth.ts                   # Auth utilities
│   ├── stores/                       # Zustand stores
│   └── styles/                       # Global styles
├── public/                           # Static assets
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Rules

- Components không chứa business logic
- API calls chỉ qua hooks (TanStack Query)
- State management: server state = TanStack Query, client state = Zustand
- Không import từ `apps/api`

---

## 4.2 `apps/api` — Backend

```text
apps/api/
├── src/
│   ├── main.ts                       # NestJS bootstrap
│   ├── app.module.ts                 # Root module
│   ├── common/                       # Cross-cutting concerns
│   │   ├── decorators/               # Custom decorators
│   │   ├── filters/                  # Exception filters
│   │   ├── guards/                   # Auth guards
│   │   ├── interceptors/             # Response/logging interceptors
│   │   ├── pipes/                    # Validation pipes
│   │   └── middleware/               # HTTP middleware
│   └── modules/                      # Domain modules
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/           # Passport strategies
│       │   ├── guards/
│       │   └── dto/
│       ├── market-data/
│       │   ├── market-data.module.ts
│       │   ├── market-data.controller.ts
│       │   ├── market-data.service.ts
│       │   ├── market-data.gateway.ts  # WebSocket gateway
│       │   ├── adapters/             # Source adapters
│       │   └── dto/
│       ├── intelligence/
│       │   ├── intelligence.module.ts
│       │   ├── intelligence.controller.ts
│       │   ├── intelligence.service.ts
│       │   ├── engines/              # Signal/scoring engines
│       │   └── dto/
│       ├── portfolio/
│       │   ├── portfolio.module.ts
│       │   ├── portfolio.controller.ts
│       │   ├── portfolio.service.ts
│       │   └── dto/
│       ├── alert/
│       │   ├── alert.module.ts
│       │   ├── alert.controller.ts
│       │   ├── alert.service.ts
│       │   └── dto/
│       ├── news/
│       │   ├── news.module.ts
│       │   ├── news.controller.ts
│       │   ├── news.service.ts
│       │   └── dto/
│       ├── ai/
│       │   ├── ai.module.ts
│       │   ├── ai.service.ts         # No controller (async only)
│       │   ├── prompts/
│       │   └── dto/
│       └── billing/
│           ├── billing.module.ts
│           ├── billing.controller.ts
│           ├── billing.service.ts
│           └── dto/
├── test/                             # Integration tests
├── tsconfig.json
└── package.json
```

### Rules

- Mỗi module tương ứng 1 bounded context
- Controller chỉ validate input + return output
- Service chứa business logic
- Repository pattern qua Prisma Service
- Module không import trực tiếp module khác — dùng events hoặc explicit dependency injection

---

## 4.3 Worker Apps

```text
apps/worker-ingestion/
├── src/
│   ├── main.ts                       # Worker bootstrap
│   ├── processors/                   # BullMQ processors
│   │   ├── price.processor.ts
│   │   ├── news.processor.ts
│   │   └── fundamentals.processor.ts
│   ├── adapters/                     # Source adapters (shared concept)
│   └── health/                       # Health check endpoint
├── tsconfig.json
└── package.json

apps/worker-processing/
├── src/
│   ├── main.ts
│   ├── processors/
│   │   ├── signal.processor.ts
│   │   ├── score.processor.ts
│   │   └── ranking.processor.ts
│   └── engines/                      # Compute engines
├── tsconfig.json
└── package.json

apps/worker-ai/
├── src/
│   ├── main.ts
│   ├── processors/
│   │   ├── stock-summary.processor.ts
│   │   └── news-summary.processor.ts
│   ├── providers/                    # LiteLLM provider config
│   └── prompts/                      # Prompt templates
├── tsconfig.json
└── package.json
```

### Rules

- Workers là headless (no HTTP, chỉ health check)
- Mỗi worker process 1 category jobs
- Workers phải idempotent
- Workers phải có DLQ (dead-letter queue)

---

# 5. Packages Layer (`packages/`)

## 5.1 `packages/contracts`

```text
packages/contracts/
├── src/
│   ├── index.ts                      # Public exports
│   ├── instrument/
│   │   ├── instrument.schema.ts      # Zod schema
│   │   ├── instrument.types.ts       # Inferred types
│   │   └── index.ts
│   ├── market-data/
│   │   ├── quote.schema.ts
│   │   ├── candle.schema.ts
│   │   ├── market-data.types.ts
│   │   └── index.ts
│   ├── signal/
│   │   ├── signal.schema.ts
│   │   ├── signal.types.ts
│   │   └── index.ts
│   ├── intelligence/
│   │   ├── stock-score.schema.ts
│   │   ├── ai-summary.schema.ts
│   │   └── index.ts
│   ├── portfolio/
│   │   ├── portfolio.schema.ts
│   │   └── index.ts
│   ├── news/
│   │   ├── news.schema.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── event-envelope.schema.ts
│   │   ├── event-types.ts
│   │   └── index.ts
│   ├── api/
│   │   ├── response.schema.ts        # ApiSuccess, ApiError
│   │   ├── pagination.schema.ts
│   │   └── index.ts
│   └── errors/
│       ├── domain-errors.ts
│       └── index.ts
├── tsconfig.json
└── package.json
```

### Rules

- Zod schemas là **single source of truth**
- TypeScript types **inferred** từ Zod (`z.infer<typeof Schema>`)
- Package này **không có runtime dependencies** ngoại trừ `zod`
- FE và BE cùng import từ đây

---

## 5.2 `packages/db`

```text
packages/db/
├── prisma/
│   ├── schema.prisma                 # Prisma schema
│   ├── migrations/                   # Migration files
│   └── seed.ts                       # Seed data
├── src/
│   ├── index.ts                      # PrismaClient export
│   ├── prisma.service.ts             # NestJS injectable
│   └── extensions/                   # Prisma Client Extensions
│       ├── soft-delete.ts
│       └── audit-log.ts
├── tsconfig.json
└── package.json
```

### Rules

- Chỉ `packages/db` chứa Prisma schema
- Apps import PrismaClient từ package này
- Migrations tracked trong git
- Seed data phải idempotent

---

## 5.3 `packages/config`

```text
packages/config/
├── src/
│   ├── index.ts
│   ├── env.ts                        # Zod-validated env vars
│   ├── constants.ts                  # App constants
│   ├── cache-keys.ts                 # Redis key patterns
│   └── queue-names.ts                # BullMQ queue names
├── tsconfig.json
└── package.json
```

### Rules

- Environment variables validated bằng Zod tại startup
- Constants centralized, không scatter trong code
- Cache keys và queue names phải có namespace

---

## 5.4 `packages/utils`

```text
packages/utils/
├── src/
│   ├── index.ts
│   ├── decimal.ts                    # Decimal-safe arithmetic
│   ├── date.ts                       # Timezone-safe date utilities
│   ├── hash.ts                       # Hashing utilities
│   ├── retry.ts                      # Retry with backoff
│   ├── result.ts                     # Result<T, E> type
│   └── logger.ts                     # Structured logger factory
├── tsconfig.json
└── package.json
```

### Rules

- Pure functions only
- Zero external dependencies (tốt nhất)
- 100% unit test coverage
- Không chứa business logic

---

# 6. Infra Layer (`infra/`)

```text
infra/
├── docker/
│   ├── Dockerfile.api                # API server
│   ├── Dockerfile.web                # Frontend (static build)
│   ├── Dockerfile.worker             # Worker base image
│   └── docker-compose.dev.yml        # Local development
├── k8s/
│   ├── base/                         # Kustomize base
│   │   ├── api/
│   │   ├── web/
│   │   ├── workers/
│   │   ├── redis/
│   │   └── postgres/
│   └── overlays/
│       ├── staging/
│       └── production/
└── terraform/
    ├── modules/
    │   ├── networking/
    │   ├── database/
    │   ├── cache/
    │   ├── storage/
    │   └── kubernetes/
    ├── environments/
    │   ├── staging/
    │   └── production/
    └── main.tf
```

---

# 7. Dependency Rules (Critical)

## Allowed Dependencies

```text
apps/web         → packages/contracts, packages/config, packages/utils
apps/api         → packages/contracts, packages/config, packages/utils, packages/db
apps/worker-*    → packages/contracts, packages/config, packages/utils, packages/db
```

## Forbidden Dependencies

```text
❌ apps/web       → apps/api                 (no cross-app imports)
❌ apps/web       → packages/db              (FE must not access DB)
❌ apps/api       → apps/web                 (no cross-app imports)
❌ apps/worker-*  → apps/api                 (workers are independent)
❌ packages/utils → packages/db              (utils must be pure)
❌ packages/contracts → packages/db          (contracts are DB-agnostic)
```

## Enforcement

- `eslint-plugin-import` với import boundaries
- TurboRepo dependency graph
- CI lint check

---

# 8. Build Strategy

## TurboRepo Pipeline

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

### Rules

- `turbo run build` builds toàn bộ theo dependency graph
- Remote caching enabled cho CI
- Chỉ build apps/packages bị affected
- `db:generate` và `db:migrate` không cache

---

# 9. Development Workflow

## Local Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp .env.example .env

# 3. Start infra (Postgres, Redis)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 4. Run migrations
pnpm --filter @stock-intel/db db:migrate

# 5. Generate Prisma client
pnpm --filter @stock-intel/db db:generate

# 6. Seed data
pnpm --filter @stock-intel/db db:seed

# 7. Start dev servers
pnpm dev                      # All apps
pnpm --filter @stock-intel/api dev   # API only
pnpm --filter @stock-intel/web dev   # FE only
```

## Package Naming Convention

| Package              | npm name                 |
| -------------------- | ------------------------ |
| `packages/contracts` | `@stock-intel/contracts` |
| `packages/db`        | `@stock-intel/db`        |
| `packages/config`    | `@stock-intel/config`    |
| `packages/utils`     | `@stock-intel/utils`     |
| `apps/api`           | `@stock-intel/api`       |
| `apps/web`           | `@stock-intel/web`       |
| `apps/worker-*`      | `@stock-intel/worker-*`  |

---

# 10. CI/CD Integration

```text
PR Open → lint + type-check + test (affected only)
PR Merge → build + deploy staging
Release Tag → build + deploy production
```

### Rules

- CI chỉ build affected packages (via TurboRepo)
- Remote cache cho faster CI
- Preview deployments cho FE PRs
- Migration step trước deploy API

---

# 11. Scale Strategy

### Khi team nhỏ (1-3 devs)

- Tất cả apps chạy cùng 1 máy dev
- API + Workers có thể cùng 1 process (NestJS modules)
- Deploy: 1 API container + 1 Worker container

### Khi team vừa (4-8 devs)

- Tách workers ra containers riêng
- FE team chỉ touch `apps/web` + `packages/contracts`
- BE team touch `apps/api` + `packages/db` + workers

### Khi team lớn (9+ devs)

- Code ownership per module (CODEOWNERS)
- PR reviews required cross-module
- Xem xét tách repo nếu deploy cadence khác nhau

---

# 12. Final Thesis

Monorepo tốt không phải là repo lớn.

Monorepo tốt là repo mà:

- Mọi người biết code nằm ở đâu
- Import boundaries rõ ràng
- Build nhanh nhờ caching
- Deploy từng phần được
- Team mới join hiểu structure trong 30 phút

Monorepo này được thiết kế để **scale từ 1 dev tới 10+ dev** mà không cần reorganize.
