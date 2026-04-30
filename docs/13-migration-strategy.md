# Migration Strategy Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế database migration strategy an toàn cho Stock Intelligence SaaS, bao gồm Prisma migration workflow, zero-downtime patterns, data seeding, và rollback procedures.

---

# 1. Migration Principles

1. **Forward-Only** — Production migrations không bao giờ rollback. Fix forward.
2. **Backward Compatible** — New schema phải work với old code (deploy window).
3. **Small, Incremental** — Mỗi migration làm 1 việc nhỏ, verifiable.
4. **Idempotent Seeds** — Seed data phải chạy lại được mà không duplicate.
5. **Tested Before Deploy** — Migration phải test trên staging trước production.
6. **Locked Execution** — Chỉ 1 migration process chạy tại 1 thời điểm.

---

# 2. Prisma Migration Workflow

## Development

```bash
# 1. Edit schema.prisma
# 2. Generate migration
pnpm --filter @stock-intel/db exec prisma migrate dev --name add_user_preferences

# 3. Review generated SQL
# 4. Test locally
# 5. Commit migration files
```

## Staging / Production

```bash
# Chỉ apply pending migrations (no schema changes)
pnpm --filter @stock-intel/db exec prisma migrate deploy
```

## File Structure

```text
packages/db/prisma/
├── schema.prisma
├── migrations/
│   ├── 20260101_init/
│   │   └── migration.sql
│   ├── 20260115_add_refresh_tokens/
│   │   └── migration.sql
│   ├── 20260201_add_user_preferences/
│   │   └── migration.sql
│   └── migration_lock.toml
└── seed.ts
```

---

# 3. Zero-Downtime Migration Patterns

## Pattern 1: Add Column (Safe)

```sql
-- Migration: add nullable column
ALTER TABLE instruments ADD COLUMN lot_size INTEGER;

-- Can deploy immediately — old code ignores new column
```

## Pattern 2: Add Required Column (2-Phase)

```text
Phase 1 (Migration):
  ALTER TABLE instruments ADD COLUMN lot_size INTEGER;  -- nullable first

Phase 2 (Backfill):
  UPDATE instruments SET lot_size = 100 WHERE lot_size IS NULL;

Phase 3 (Migration):
  ALTER TABLE instruments ALTER COLUMN lot_size SET NOT NULL;
  ALTER TABLE instruments ALTER COLUMN lot_size SET DEFAULT 100;
```

## Pattern 3: Rename Column (3-Phase)

```text
Phase 1 — Deploy 1:
  ALTER TABLE users ADD COLUMN display_name VARCHAR(255);  -- new column
  -- Code writes to BOTH old_name AND display_name

Phase 2 — Backfill:
  UPDATE users SET display_name = old_name WHERE display_name IS NULL;
  -- Code reads from display_name, writes to both

Phase 3 — Deploy 2:
  ALTER TABLE users DROP COLUMN old_name;
  -- Code only uses display_name
```

## Pattern 4: Add Index (Safe with CONCURRENTLY)

```sql
-- Must use CONCURRENTLY to avoid table locks
CREATE INDEX CONCURRENTLY idx_signals_detected_at
  ON signals (detected_at);
```

> Prisma không support CONCURRENTLY natively. Dùng raw SQL migration.

## Pattern 5: Drop Column (2-Phase)

```text
Phase 1 — Deploy code that stops reading/writing column
Phase 2 — Drop column in next migration
```

---

# 4. Dangerous Operations Checklist

| Operation | Risk Level | Pre-check | Safe Pattern |
|---|---|---|---|
| ADD column (nullable) | 🟢 Low | None | Direct |
| ADD column (NOT NULL) | 🟡 Medium | Backfill plan | 2-phase |
| ADD index | 🟡 Medium | Table size | CONCURRENTLY |
| RENAME column | 🔴 High | All consumers | 3-phase |
| DROP column | 🔴 High | No consumers | 2-phase |
| CHANGE column type | 🔴 High | Data compatibility | Add new → migrate → drop |
| DROP table | 🔴 Critical | Backup | Archive first |
| TRUNCATE | 🔴 Critical | Backup | Never in production |

---

# 5. Seed Data Strategy

```typescript
// packages/db/prisma/seed.ts

async function main() {
  const prisma = new PrismaClient();

  // Seed exchanges (idempotent - upsert)
  await prisma.exchange.upsert({
    where: { code: 'HOSE' },
    update: {},
    create: { code: 'HOSE', name: 'Ho Chi Minh Stock Exchange', market: 'VN' },
  });

  await prisma.exchange.upsert({
    where: { code: 'HNX' },
    update: {},
    create: { code: 'HNX', name: 'Hanoi Stock Exchange', market: 'VN' },
  });

  // Seed sectors
  const sectors = ['Technology', 'Finance', 'Real Estate', 'Energy', 'Consumer'];
  for (const name of sectors) {
    await prisma.sector.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Seed admin user (dev only)
  if (process.env.NODE_ENV !== 'production') {
    await prisma.user.upsert({
      where: { email: 'admin@stockintel.dev' },
      update: {},
      create: {
        email: 'admin@stockintel.dev',
        passwordHash: await hash('admin123', 12),
        status: 'ACTIVE',
      },
    });
  }
}
```

### Seed Rules

1. **Upsert always** — Never `create` without checking existence
2. **Reference data only** — Exchanges, sectors, default configs
3. **No test data in production seeds** — Dev-only data gated by `NODE_ENV`
4. **Seed phải chạy trong CI** — Tự động validate seed script

---

# 6. TimescaleDB Migration

TimescaleDB dùng cho time-series data (candles). Cần setup riêng:

```sql
-- Initial setup (raw SQL migration)
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE candles (
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  timeframe VARCHAR(10) NOT NULL,
  open NUMERIC(24,8) NOT NULL,
  high NUMERIC(24,8) NOT NULL,
  low NUMERIC(24,8) NOT NULL,
  close NUMERIC(24,8) NOT NULL,
  volume NUMERIC(24,8) NOT NULL,
  value NUMERIC(24,8),
  timestamp TIMESTAMPTZ NOT NULL,
  source VARCHAR(100) NOT NULL,
  
  PRIMARY KEY (instrument_id, timeframe, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('candles', 'timestamp',
  chunk_time_interval => INTERVAL '1 month'
);

-- Compression policy (compress after 7 days)
ALTER TABLE candles SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'instrument_id, timeframe',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('candles', INTERVAL '7 days');

-- Retention policy (delete after 5 years)
SELECT add_retention_policy('candles', INTERVAL '5 years');
```

> Note: TimescaleDB tables managed via raw SQL, not Prisma schema. Prisma can still query them via `prisma.$queryRaw`.

---

# 7. Migration Testing

```typescript
// Trước deploy
describe('Migration Safety', () => {
  it('should apply pending migrations without error', async () => {
    // Fresh DB + all migrations
    await execSync('prisma migrate deploy');
  });

  it('should seed without error', async () => {
    await execSync('prisma db seed');
  });

  it('should be idempotent', async () => {
    // Run seed twice — should not throw
    await execSync('prisma db seed');
    await execSync('prisma db seed');
  });
});
```

---

# 8. Backup Strategy

| Environment | Backup Frequency | Retention | Method |
|---|---|---|---|
| Production | Every 6 hours | 30 days | Automated PG dump + WAL |
| Staging | Daily | 7 days | Automated PG dump |
| Development | None | — | Recreate from migrations |

### Pre-Migration Backup

```bash
# Always snapshot before production migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

# 9. Final Thesis

Migration an toàn = dữ liệu an toàn.

1. **Forward-only** — Đừng rollback schema
2. **Small steps** — 1 migration = 1 thay đổi
3. **Test first** — Staging trước production
4. **Backup always** — Snapshot trước migration
5. **Zero-downtime** — Backward-compatible changes
6. **Automate** — Seed idempotent, migration trong CI
