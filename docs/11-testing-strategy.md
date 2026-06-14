# Testing Strategy Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế testing strategy production-ready cho Stock Intelligence SaaS, bao gồm test pyramid, coverage targets, mocking strategy, test infrastructure, và testing workflow.

---

# 1. Testing Principles

1. **Tests are Documentation** — Tests giải thích behavior kỳ vọng.
2. **Fast Feedback** — Unit tests chạy trong giây, không phải phút.
3. **Deterministic** — Không flaky tests. Mọi test phải reproducible.
4. **Isolated** — Tests không phụ thuộc lẫn nhau, không phụ thuộc external state.
5. **Behavior over Implementation** — Test what it does, not how it does it.
6. **Cost-Effective** — Test càng nhiều ở tầng thấp, càng ít ở tầng cao.

---

# 2. Test Pyramid

```text
         ┌───────────────┐
         │   E2E Tests   │  ← Ít nhất, chậm nhất, đắt nhất
         │  (Playwright)  │
         ├───────────────┤
         │ Integration    │  ← Vừa phải
         │ (Supertest +   │
         │  Testcontainers)│
         ├───────────────┤
         │  Unit Tests   │  ← Nhiều nhất, nhanh nhất, rẻ nhất
         │   (Vitest)    │
         └───────────────┘
```

| Layer       | Tool                       | Target                      | Coverage     |
| ----------- | -------------------------- | --------------------------- | ------------ |
| Unit        | Vitest                     | Services, utils, pure logic | ≥ 80%        |
| Integration | Supertest + Testcontainers | API endpoints, DB queries   | ≥ 60%        |
| E2E         | Playwright                 | Critical user flows         | Top 10 flows |

---

# 3. Test Categories

## 3.1 Unit Tests

**Scope:** Single function / class, no external dependencies.

**What to unit test:**

- Business logic (signal computation, scoring, PnL calculation)
- Data transformations (adapter → canonical schema)
- Validation rules (Zod schemas)
- Utility functions (decimal math, date conversions)
- Error handling paths

**What NOT to unit test:**

- Database queries (use integration tests)
- HTTP endpoints (use integration tests)
- Third-party library internals

### Example

```typescript
// intelligence/engines/signal.engine.spec.ts
describe("SignalEngine", () => {
  describe("detectRSISignal", () => {
    it("should detect overbought when RSI > 70", () => {
      const signal = detectRSISignal({ rsi: 75, symbol: "FPT" });

      expect(signal).toEqual({
        type: "RSI_OVERBOUGHT",
        strength: "HIGH",
        score: "75",
      });
    });

    it("should detect oversold when RSI < 30", () => {
      const signal = detectRSISignal({ rsi: 22, symbol: "VCB" });

      expect(signal).toEqual({
        type: "RSI_OVERSOLD",
        strength: "HIGH",
        score: "22",
      });
    });

    it("should return null when RSI is neutral", () => {
      const signal = detectRSISignal({ rsi: 50, symbol: "HPG" });
      expect(signal).toBeNull();
    });
  });
});
```

---

## 3.2 Integration Tests

**Scope:** Module + real DB / real Redis / real queue.

**Infrastructure:** Testcontainers (PostgreSQL, Redis containers per test suite).

**What to integration test:**

- API endpoint request → response
- Database CRUD operations
- Cache read/write behavior
- Queue enqueue → process flow
- Auth middleware (JWT verification)

### Example

```typescript
// market-data/market-data.integration.spec.ts
describe("MarketData API", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Start real PostgreSQL via Testcontainers
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.cleanDatabase(); // Truncate tables
  });

  describe("GET /api/v1/public/instruments/:symbol/candles", () => {
    it("should return candles for valid symbol", async () => {
      // Arrange: seed instrument + candles
      await prisma.instrument.create({ data: seedInstrument("FPT") });
      await prisma.candle.createMany({ data: seedCandles("FPT", 10) });

      // Act
      const response = await request(app.getHttpServer())
        .get("/api/v1/public/instruments/FPT/candles")
        .query({ timeframe: "1d", limit: 10 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.data[0]).toMatchObject({
        open: expect.any(String),
        high: expect.any(String),
        low: expect.any(String),
        close: expect.any(String),
      });
    });

    it("should return 404 for unknown symbol", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/public/instruments/UNKNOWN/candles",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });
});
```

---

## 3.3 E2E Tests

**Scope:** Full user flows qua browser.

**Tool:** Playwright.

**Critical Flows to Test:**

| #   | Flow                                       | Priority    |
| --- | ------------------------------------------ | ----------- |
| 1   | Register → Login → See dashboard           | 🔴 Critical |
| 2   | Search stock → View detail → See chart     | 🔴 Critical |
| 3   | Add to watchlist → See in watchlist        | 🔴 Critical |
| 4   | Create portfolio → Add position            | 🟡 High     |
| 5   | Set alert → Trigger → See notification     | 🟡 High     |
| 6   | View market overview → Navigate top movers | 🟡 High     |
| 7   | Upgrade to PRO → Access premium features   | 🟡 High     |
| 8   | Generate API key → Make API call           | 🟠 Medium   |
| 9   | View AI summary (premium)                  | 🟠 Medium   |
| 10  | Logout → Verify session cleared            | 🟠 Medium   |

### Example

```typescript
// e2e/stock-detail.spec.ts
test("user can search and view stock detail", async ({ page }) => {
  await page.goto("/");

  // Search for stock
  await page.fill('[data-testid="search-input"]', "FPT");
  await page.click('[data-testid="search-result-FPT"]');

  // Verify stock detail page
  await expect(page).toHaveURL(/\/stock\/FPT/);
  await expect(page.locator('[data-testid="stock-name"]')).toContainText("FPT");
  await expect(page.locator('[data-testid="stock-price"]')).toBeVisible();
  await expect(page.locator('[data-testid="stock-chart"]')).toBeVisible();
});
```

---

# 4. Mocking Strategy

## What to Mock

| Dependency                            | Mock Strategy                   |
| ------------------------------------- | ------------------------------- |
| External APIs (market data providers) | Adapter mocks with fixture data |
| AI providers (OpenAI, Gemini)         | Fixed response mocks            |
| Email service                         | Spy / stub                      |
| Current time                          | `vi.useFakeTimers()`            |
| Random values                         | Seeded random / fixed values    |

## What NOT to Mock

| Dependency     | Reason                                 |
| -------------- | -------------------------------------- |
| Database       | Use Testcontainers (real PostgreSQL)   |
| Redis          | Use Testcontainers (real Redis)        |
| Zod validation | Real validation = what production does |
| Business logic | That's what you're testing             |

## Fixture Pattern

```typescript
// test/fixtures/instrument.fixture.ts
export function createInstrumentFixture(
  overrides?: Partial<Instrument>,
): Instrument {
  return {
    instrumentId: randomUUID(),
    symbol: "FPT",
    exchange: "HOSE",
    market: "VN",
    name: "CTCP FPT",
    sector: "Technology",
    industry: "IT Services",
    currency: "VND",
    status: "ACTIVE",
    tradable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

---

# 5. Contract Testing

## Producer-Consumer Contract Tests

Đảm bảo event producer và consumer agree về schema.

```typescript
// Producer side
describe("MarketDataService events", () => {
  it("should publish quote.updated in correct shape", () => {
    const event = service.createQuoteUpdatedEvent(quoteData);

    // Validate against shared schema
    const result = DomainEventSchema.safeParse(event);
    expect(result.success).toBe(true);

    const payloadResult = QuoteSchema.safeParse(event.payload);
    expect(payloadResult.success).toBe(true);
  });
});

// Consumer side
describe("IntelligenceService", () => {
  it("should handle quote.updated event", () => {
    const event = createQuoteUpdatedEvent(fixtureQuote);

    // Should not throw
    expect(() => service.handleQuoteUpdated(event)).not.toThrow();
  });
});
```

---

# 6. Test Infrastructure

## Testcontainers Setup

```typescript
// test/setup/testcontainers.ts
import { PostgreSqlContainer, RedisContainer } from "@testcontainers/modules";

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer("postgres:17")
    .withDatabase("test_db")
    .start();

  redisContainer = await new RedisContainer("redis:7").start();

  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();

  // Run migrations
  await execSync("npx prisma migrate deploy");
}, 60_000);

afterAll(async () => {
  await pgContainer.stop();
  await redisContainer.stop();
});
```

---

# 7. Coverage Targets

| Package                  | Unit | Integration | Overall |
| ------------------------ | ---- | ----------- | ------- |
| `packages/contracts`     | 95%  | —           | 95%     |
| `packages/utils`         | 95%  | —           | 95%     |
| `apps/api` (services)    | 80%  | 60%         | 75%     |
| `apps/api` (controllers) | —    | 80%         | 80%     |
| `apps/worker-*`          | 70%  | 50%         | 65%     |
| `apps/web`               | 60%  | —           | 60%     |

> CI blocks merge if coverage drops below target.

---

# 8. Test Naming Convention

```
describe('[Module/Class]', () => {
  describe('[method/scenario]', () => {
    it('should [expected behavior] when [condition]', () => { ... });
  });
});
```

Examples:

- `should return signal when RSI exceeds 70`
- `should throw NotFoundError when instrument does not exist`
- `should invalidate cache when quote is updated`

---

# 9. CI Testing Pipeline

```text
PR Open:
  1. Lint + Type check
  2. Unit tests (affected packages only)
  3. Integration tests (affected apps only)
  4. Coverage report → PR comment

Pre-merge:
  5. Full unit test suite
  6. Full integration test suite

Nightly:
  7. E2E tests (Playwright)
  8. Performance benchmarks
```

---

# 10. Final Thesis

Testing tốt = ngủ ngon.

1. **Unit tests** bảo vệ business logic
2. **Integration tests** bảo vệ contract giữa layers
3. **E2E tests** bảo vệ user experience
4. **Contract tests** bảo vệ service communication
5. **Testcontainers** cho tests chạy trên real infrastructure
6. **Coverage targets** là safety net, không phải goal
