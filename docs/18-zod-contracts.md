# Zod Contract Blueprints — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Định nghĩa runtime validation schemas cho toàn bộ canonical data contracts bằng Zod. Zod schemas là **single source of truth** — TypeScript types được infer từ đây.

---

# 1. Zod Contract Principles

1. **Zod First** — Define schema bằng Zod, infer TypeScript types từ Zod.
2. **Validate at Boundaries** — Validate khi data enter/exit system.
3. **Decimal as String** — Financial values luôn là string để tránh precision loss.
4. **Nullable Explicit** — Dùng `.nullable()` cho optional fields.
5. **Versioned** — Mọi schema có `version` field.
6. **Shared Package** — Tất cả schemas nằm trong `@stock-intel/contracts`.

---

# 2. Shared Utilities

```typescript
// packages/contracts/src/utils/schemas.ts

import { z } from "zod";

/** UUID v4 format */
export const uuid = z.string().uuid();

/** ISO8601 UTC timestamp */
export const timestamp = z.string().datetime({ offset: true });

/** Decimal-safe numeric string */
export const decimal = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Must be a valid decimal string");

/** Positive decimal */
export const positiveDecimal = decimal.refine(
  (v) => parseFloat(v) > 0,
  "Must be positive",
);

/** Score 0-100 */
export const score = decimal.refine((v) => {
  const n = parseFloat(v);
  return n >= 0 && n <= 100;
}, "Score must be between 0 and 100");

/** Confidence 0-1 */
export const confidence = decimal.refine((v) => {
  const n = parseFloat(v);
  return n >= 0 && n <= 1;
}, "Confidence must be between 0 and 1");
```

---

# 3. Domain 1 — Instrument Schema

```typescript
// packages/contracts/src/instrument/instrument.schema.ts

import { z } from "zod";
import { uuid, timestamp } from "../utils/schemas";

export const InstrumentStatusEnum = z.enum(["ACTIVE", "HALTED", "DELISTED"]);

export const InstrumentSchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  symbol: z.string().min(1).max(20),
  exchange: z.string().min(1).max(20),
  market: z.string().min(1).max(10),
  name: z.string().min(1).max(255),
  sector: z.string().max(100).nullable(),
  industry: z.string().max(150).nullable(),
  currency: z.string().min(1).max(10),
  isin: z.string().max(20).nullable(),
  status: InstrumentStatusEnum,
  tradable: z.boolean(),
  lotSize: z.number().int().positive().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type Instrument = z.infer<typeof InstrumentSchema>;
```

---

# 4. Domain 2 — Market Data Schemas

```typescript
// packages/contracts/src/market-data/quote.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal } from "../utils/schemas";

export const QuoteSchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  symbol: z.string().min(1).max(20),
  price: decimal,
  change: decimal,
  changePercent: decimal,
  open: decimal,
  high: decimal,
  low: decimal,
  previousClose: decimal,
  volume: decimal,
  value: decimal,
  timestamp: timestamp,
  asOf: timestamp,
  source: z.string().min(1),
});

export type Quote = z.infer<typeof QuoteSchema>;
```

```typescript
// packages/contracts/src/market-data/candle.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal } from "../utils/schemas";

export const TimeframeEnum = z.enum([
  "1m",
  "5m",
  "15m",
  "1h",
  "1d",
  "1w",
  "1mo",
]);

export const CandleSchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  timeframe: TimeframeEnum,
  open: decimal,
  high: decimal,
  low: decimal,
  close: decimal,
  volume: decimal,
  value: decimal.nullable(),
  timestamp: timestamp,
  source: z.string().min(1),
});

export type Candle = z.infer<typeof CandleSchema>;
```

---

# 5. Domain 3 — Fundamentals Schemas

```typescript
// packages/contracts/src/fundamentals/financial-snapshot.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal } from "../utils/schemas";

export const PeriodEnum = z.enum(["QUARTER", "YEAR"]);

export const FinancialSnapshotSchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  period: PeriodEnum,
  fiscalYear: z.number().int().min(2000).max(2100),
  fiscalQuarter: z.number().int().min(1).max(4).nullable(),
  revenue: decimal.nullable(),
  grossProfit: decimal.nullable(),
  operatingIncome: decimal.nullable(),
  netIncome: decimal.nullable(),
  eps: decimal.nullable(),
  roe: decimal.nullable(),
  roa: decimal.nullable(),
  debtToEquity: decimal.nullable(),
  freeCashFlow: decimal.nullable(),
  grossMargin: decimal.nullable(),
  netMargin: decimal.nullable(),
  reportDate: timestamp,
  publishedAt: timestamp.nullable(),
  source: z.string().min(1),
});

export type FinancialSnapshot = z.infer<typeof FinancialSnapshotSchema>;
```

```typescript
// packages/contracts/src/fundamentals/valuation-snapshot.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal } from "../utils/schemas";

export const ValuationSnapshotSchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  pe: decimal.nullable(),
  pb: decimal.nullable(),
  ps: decimal.nullable(),
  evEbitda: decimal.nullable(),
  dividendYield: decimal.nullable(),
  marketCap: decimal.nullable(),
  sharesOutstanding: decimal.nullable(),
  asOf: timestamp,
  source: z.string().min(1),
});

export type ValuationSnapshot = z.infer<typeof ValuationSnapshotSchema>;
```

---

# 6. Domain 4 — News Schema

```typescript
// packages/contracts/src/news/news.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal } from "../utils/schemas";

export const NewsSentimentEnum = z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]);

export const NewsArticleSchema = z.object({
  version: z.literal("v1"),
  newsId: uuid,
  instrumentIds: z.array(uuid).min(0),
  headline: z.string().min(1).max(500),
  summary: z.string().max(2000).nullable(),
  content: z.string().nullable(),
  url: z.string().url(),
  source: z.string().min(1).max(100),
  language: z.string().min(2).max(10),
  sentiment: NewsSentimentEnum.nullable(),
  relevanceScore: decimal.nullable(),
  publishedAt: timestamp,
  ingestedAt: timestamp,
});

export type NewsArticle = z.infer<typeof NewsArticleSchema>;
```

---

# 7. Domain 5 — Signal Schema

```typescript
// packages/contracts/src/signal/signal.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal, score } from "../utils/schemas";

export const SignalTypeEnum = z.enum([
  "RSI_OVERBOUGHT",
  "RSI_OVERSOLD",
  "MACD_BULLISH",
  "MACD_BEARISH",
  "BREAKOUT",
  "BREAKDOWN",
  "VOLUME_SPIKE",
]);

export const SignalStrengthEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const SignalSchema = z.object({
  version: z.literal("v1"),
  signalId: uuid,
  instrumentId: uuid,
  type: SignalTypeEnum,
  strength: SignalStrengthEnum,
  score: score,
  value: decimal.nullable(),
  explanation: z.string().max(1000).nullable(),
  detectedAt: timestamp,
  expiresAt: timestamp.nullable(),
  source: z.literal("SYSTEM"),
});

export type Signal = z.infer<typeof SignalSchema>;
```

---

# 8. Domain 6 — Intelligence Schemas

```typescript
// packages/contracts/src/intelligence/stock-score.schema.ts

import { z } from "zod";
import { uuid, timestamp, score } from "../utils/schemas";

export const StockRatingEnum = z.enum([
  "STRONG_BUY",
  "BUY",
  "HOLD",
  "SELL",
  "STRONG_SELL",
]);

export const StockScoreSchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  score: score,
  rating: StockRatingEnum,
  factors: z.object({
    technical: score,
    fundamentals: score,
    momentum: score,
    valuation: score,
    sentiment: score,
  }),
  asOf: timestamp,
});

export type StockScore = z.infer<typeof StockScoreSchema>;
```

```typescript
// packages/contracts/src/intelligence/ai-summary.schema.ts

import { z } from "zod";
import { uuid, timestamp, confidence } from "../utils/schemas";

export const AISentimentEnum = z.enum(["BULLISH", "NEUTRAL", "BEARISH"]);

export const AISummarySchema = z.object({
  version: z.literal("v1"),
  instrumentId: uuid,
  summary: z.string().min(1).max(5000),
  sentiment: AISentimentEnum,
  confidence: confidence,
  drivers: z.array(z.string().max(200)).max(10),
  risks: z.array(z.string().max(200)).max(10),
  generatedAt: timestamp,
  expiresAt: timestamp.nullable(),
  model: z.string().min(1).max(100),
});

export type AISummary = z.infer<typeof AISummarySchema>;
```

---

# 9. Domain 7 — Portfolio Schemas

```typescript
// packages/contracts/src/portfolio/portfolio.schema.ts

import { z } from "zod";
import { uuid, timestamp, decimal } from "../utils/schemas";

export const PortfolioPositionSchema = z.object({
  version: z.literal("v1"),
  portfolioId: uuid,
  instrumentId: uuid,
  quantity: decimal,
  averageCost: decimal,
  marketPrice: decimal,
  marketValue: decimal,
  unrealizedPnl: decimal,
  unrealizedPnlPercent: decimal,
  updatedAt: timestamp,
});

export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;

export const PortfolioSnapshotSchema = z.object({
  version: z.literal("v1"),
  portfolioId: uuid,
  totalValue: decimal,
  totalCost: decimal,
  totalPnl: decimal,
  totalPnlPercent: decimal,
  diversificationScore: decimal.nullable(),
  riskScore: decimal.nullable(),
  updatedAt: timestamp,
});

export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshotSchema>;
```

---

# 10. Domain 8 — System Event Schema

```typescript
// packages/contracts/src/events/event-envelope.schema.ts

import { z } from "zod";
import { uuid, timestamp } from "../utils/schemas";

export const DomainEventSchema = <T extends z.ZodType>(payloadSchema: T) =>
  z.object({
    version: z.literal("v1"),
    eventId: uuid,
    eventType: z.string().min(1),
    producer: z.string().min(1),
    occurredAt: timestamp,
    traceId: z.string().min(1),
    payload: payloadSchema,
  });

// Concrete event schemas
export const QuoteUpdatedEventSchema = DomainEventSchema(QuoteSchema);
export const SignalDetectedEventSchema = DomainEventSchema(SignalSchema);
export const ScoreUpdatedEventSchema = DomainEventSchema(StockScoreSchema);
export const SummaryGeneratedEventSchema = DomainEventSchema(AISummarySchema);

// Inferred types
export type QuoteUpdatedEvent = z.infer<typeof QuoteUpdatedEventSchema>;
export type SignalDetectedEvent = z.infer<typeof SignalDetectedEventSchema>;
```

---

# 11. API Response Schemas

```typescript
// packages/contracts/src/api/response.schema.ts

import { z } from "zod";
import { uuid, timestamp } from "../utils/schemas";

export const PaginationMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
  limit: z.number().int().positive(),
  hasMore: z.boolean(),
});

export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string(),
        timestamp: timestamp,
        pagination: PaginationMetaSchema.optional(),
      })
      .optional(),
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z.object({
    requestId: z.string(),
    timestamp: timestamp,
  }),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
```

---

# 12. API Query Schemas

```typescript
// packages/contracts/src/api/queries.schema.ts

import { z } from "zod";

export const GetCandlesQuerySchema = z.object({
  timeframe: z.enum(["1m", "5m", "15m", "1h", "1d", "1w", "1mo"]).default("1d"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const SearchInstrumentsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  exchange: z.string().max(20).optional(),
  sector: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const GetNewsQuerySchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type GetCandlesQuery = z.infer<typeof GetCandlesQuerySchema>;
export type SearchInstrumentsQuery = z.infer<
  typeof SearchInstrumentsQuerySchema
>;
export type GetNewsQuery = z.infer<typeof GetNewsQuerySchema>;
```

---

# 13. Package Exports

```typescript
// packages/contracts/src/index.ts

// Shared utilities
export * from "./utils/schemas";

// Domain schemas & types
export * from "./instrument";
export * from "./market-data";
export * from "./fundamentals";
export * from "./news";
export * from "./signal";
export * from "./intelligence";
export * from "./portfolio";
export * from "./events";

// API schemas & types
export * from "./api/response.schema";
export * from "./api/queries.schema";

// Error types
export * from "./errors";
```

---

# 14. Usage Examples

## Validate External Data (Ingestion)

```typescript
// worker-ingestion: validate data from external source
import { QuoteSchema } from "@stock-intel/contracts";

async function processRawQuote(rawData: unknown): Promise<void> {
  const result = QuoteSchema.safeParse(rawData);

  if (!result.success) {
    logger.warn({
      message: "Invalid quote data from source",
      errors: result.error.flatten(),
    });
    return; // Skip invalid data
  }

  const validQuote = result.data; // Fully typed Quote
  await this.quoteRepo.upsert(validQuote);
}
```

## NestJS DTO Integration

```typescript
// API: validate request input
import { createZodDto } from 'nestjs-zod';
import { GetCandlesQuerySchema } from '@stock-intel/contracts';

export class GetCandlesDto extends createZodDto(GetCandlesQuerySchema) {}

// Controller
@Get(':symbol/candles')
async getCandles(
  @Param('symbol') symbol: string,
  @Query() query: GetCandlesDto, // Auto-validated by Zod
) { ... }
```

## Frontend Type Safety

```typescript
// Frontend: same types, no drift
import type { Quote, Instrument } from '@stock-intel/contracts';

function StockCard({ instrument, quote }: {
  instrument: Instrument;
  quote: Quote;
}) {
  return <div>{instrument.name}: {quote.price}</div>;
}
```

---

# 15. Final Thesis

Zod contracts = type safety + runtime safety + no drift.

1. **Single source of truth** — Schema defined once, used everywhere
2. **Compile-time safety** — TypeScript types inferred from Zod
3. **Runtime safety** — Validate at system boundaries
4. **No FE/BE mismatch** — Shared package, same contract
5. **Self-documenting** — Schema IS the documentation
6. **Evolution-safe** — Versioned, backward-compatible
