# Coding Standards — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Chuẩn hóa coding conventions, naming, file structure và patterns cho toàn bộ codebase. Code phải consistent, readable, dễ onboard.

---

# 1. General Principles

1. **Readability > Cleverness** — Code được đọc nhiều hơn viết. Viết cho người khác đọc.
2. **Explicit > Implicit** — Đặt tên rõ ràng, không viết tắt trừ khi là convention phổ biến.
3. **Consistency > Preference** — Theo convention chung, không theo style cá nhân.
4. **Small Functions** — Mỗi function làm 1 việc, tối đa 30 dòng logic.
5. **No Magic Numbers** — Dùng named constants.
6. **No Dead Code** — Xóa code không dùng, không comment out.
7. **No TODO in Main Branch** — TODO phải có issue ticket.

---

# 2. Naming Conventions

## Files & Directories

| Type | Convention | Example |
|---|---|---|
| Module | `kebab-case` | `market-data/` |
| Component (React) | `PascalCase.tsx` | `StockCard.tsx` |
| Service (NestJS) | `kebab-case.service.ts` | `market-data.service.ts` |
| Controller | `kebab-case.controller.ts` | `portfolio.controller.ts` |
| DTO | `kebab-case.dto.ts` | `create-watchlist.dto.ts` |
| Schema (Zod) | `kebab-case.schema.ts` | `instrument.schema.ts` |
| Test | `*.spec.ts` / `*.test.ts` | `auth.service.spec.ts` |
| Constants | `kebab-case.constants.ts` | `cache-keys.constants.ts` |
| Types | `kebab-case.types.ts` | `market-data.types.ts` |
| Utils | `kebab-case.ts` | `decimal.ts` |

## Variables & Functions

| Type | Convention | Example |
|---|---|---|
| Variables | `camelCase` | `currentPrice` |
| Functions | `camelCase` | `calculateScore()` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Boolean | `is/has/should` prefix | `isActive`, `hasExpired` |
| Handlers | `handle` prefix | `handleQuoteUpdate()` |
| Getters | `get` prefix | `getLatestQuote()` |
| Validators | `validate/is` prefix | `validateInstrument()` |
| Transformers | `to/from/map` prefix | `toCanonicalQuote()` |

## Classes & Interfaces

| Type | Convention | Example |
|---|---|---|
| Class | `PascalCase` | `MarketDataService` |
| Interface | `PascalCase` (no `I` prefix) | `MarketDataAdapter` |
| Enum | `PascalCase` | `SignalStrength` |
| Enum values | `UPPER_SNAKE_CASE` | `SignalStrength.RSI_OVERBOUGHT` |
| Type alias | `PascalCase` | `InstrumentStatus` |

## Database

| Type | Convention | Example |
|---|---|---|
| Table | `snake_case` (plural) | `portfolio_positions` |
| Column | `snake_case` | `average_cost` |
| Index | `idx_{table}_{columns}` | `idx_signals_instrument_detected` |
| Enum | `snake_case` | `signal_strength` |
| FK | `{table}_{column}_fkey` | `portfolio_positions_portfolio_id_fkey` |

---

# 3. TypeScript Rules

## Strict Mode

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Type Rules

1. **No `any`** — Dùng `unknown` nếu chưa biết type, rồi narrow down.
2. **No type assertions (`as`)** — Trừ khi đã validate runtime (Zod parse).
3. **Prefer `interface` cho objects** — Dùng `type` cho unions, intersections.
4. **Prefer `const` assertions** — `as const` cho literal types.
5. **Explicit return types** — Cho public API functions.

```typescript
// ✅ Good
function getQuote(symbol: string): Promise<Quote> { ... }

// ❌ Bad
function getQuote(symbol: string) { ... }  // implicit return type
```

## Import Rules

1. **Absolute imports** cho packages
2. **Relative imports** chỉ trong cùng module
3. **No barrel re-exports** trừ package root `index.ts`
4. **Import order**: external → packages → relative

```typescript
// ✅ Good order
import { Injectable } from '@nestjs/common';
import { Quote } from '@stock-intel/contracts';
import { PrismaService } from '@stock-intel/db';
import { MarketDataAdapter } from './adapters/market-data-adapter.interface';
```

---

# 4. NestJS Backend Patterns

## Module Structure

```
module/
├── module-name.module.ts         # DI registration
├── module-name.controller.ts     # HTTP only
├── module-name.service.ts        # Business logic
├── module-name.repository.ts     # Data access (optional)
├── dto/                          # Request/Response shapes
├── entities/                     # Prisma-mapped entities (if needed)
├── adapters/                     # External integrations
├── events/                       # Domain event definitions
└── __tests__/                    # Co-located tests
```

## Controller Rules

```typescript
// ✅ Controller: thin, no business logic
@Controller('api/v1/public/instruments')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get(':symbol/candles')
  async getCandles(
    @Param('symbol') symbol: string,
    @Query() query: GetCandlesDto,
  ): Promise<ApiSuccess<Candle[]>> {
    const candles = await this.marketDataService.getCandles(symbol, query);
    return { success: true, data: candles };
  }
}
```

## Service Rules

```typescript
// ✅ Service: business logic, orchestration
@Injectable()
export class MarketDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBus,
  ) {}

  async getCandles(symbol: string, options: GetCandlesDto): Promise<Candle[]> {
    // 1. Check cache
    // 2. Query DB if miss
    // 3. Transform to contract shape
    // 4. Return
  }
}
```

## DTO Rules

```typescript
// DTO uses Zod for runtime validation
import { createZodDto } from 'nestjs-zod';
import { GetCandlesQuerySchema } from '@stock-intel/contracts';

export class GetCandlesDto extends createZodDto(GetCandlesQuerySchema) {}
```

---

# 5. React Frontend Patterns

## Component Structure

```typescript
// ✅ Good: small, focused, typed
interface StockCardProps {
  instrument: Instrument;
  quote: Quote;
  onClick?: (symbol: string) => void;
}

export function StockCard({ instrument, quote, onClick }: StockCardProps) {
  return (
    <div onClick={() => onClick?.(instrument.symbol)}>
      {/* ... */}
    </div>
  );
}
```

## Rules

1. **Functional components only** — No class components
2. **Props interface** — Always explicit, named `{Component}Props`
3. **No inline styles** — Tailwind classes only
4. **Custom hooks** — Extract logic > 5 lines into hooks
5. **No direct API calls** — Use TanStack Query hooks
6. **No global state abuse** — Zustand chỉ cho truly global state

## Data Fetching Pattern

```typescript
// ✅ Good: TanStack Query hook
export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => api.getQuote(symbol),
    staleTime: 15_000, // 15s for realtime
    refetchInterval: 15_000,
  });
}

// ✅ Usage in component
function StockDetail({ symbol }: { symbol: string }) {
  const { data: quote, isLoading, error } = useQuote(symbol);
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState error={error} />;
  
  return <QuoteDisplay quote={quote} />;
}
```

---

# 6. Git Conventions

## Branch Naming

```text
feature/market-data-ingestion
fix/quote-cache-invalidation
chore/update-dependencies
docs/api-contract-v2
refactor/signal-engine
```

## Commit Messages

```text
feat(market-data): add SSI adapter for quote ingestion
fix(portfolio): correct PnL calculation for partial sells
refactor(intelligence): extract signal engine to separate module
test(auth): add refresh token rotation tests
docs(api): add WebSocket protocol definition
chore(deps): update prisma to v6.2
```

Format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`

## PR Rules

1. PR phải liên kết issue
2. PR description phải mô tả **what** và **why**
3. Max 400 dòng thay đổi (trừ generated files)
4. Phải pass CI trước khi review
5. Ít nhất 1 approval trước merge

---

# 7. Code Quality Tools

## Linting

- **ESLint** — với `@typescript-eslint`, `import` plugin
- **Prettier** — format consistency

## Pre-commit

```bash
# lint-staged configuration
*.{ts,tsx}: eslint --fix
*.{ts,tsx,json,md}: prettier --write
```

## CI Checks

1. Type check (`tsc --noEmit`)
2. Lint (`eslint`)
3. Format (`prettier --check`)
4. Tests (`vitest run`)
5. Build (`turbo build`)

---

# 8. Documentation Rules

1. **Public functions** phải có JSDoc
2. **Complex logic** phải có inline comments giải thích **why**
3. **Module** phải có README nếu > 5 files
4. **API endpoints** phải define trong contracts
5. **No obvious comments** — Không comment "increment counter by 1"

```typescript
// ✅ Good: explains WHY
// We use string for price to avoid floating point precision issues
// with financial calculations. Convert to Decimal only when computing.
price: string;

// ❌ Bad: explains WHAT (obvious)
// Set the price
price: string;
```

---

# 9. Final Rules (Non-Negotiable)

1. `strict: true` trong mọi `tsconfig.json`
2. Không `any` trong production code
3. Không `console.log` — dùng structured logger
4. Không hardcode secrets
5. Không commit `.env` files
6. Mọi external call phải có timeout
7. Mọi mutation phải có validation (Zod)
8. Tests phải pass trước merge
9. Dead code = xóa, không comment out
10. Premature optimization = đừng. Profile trước.
