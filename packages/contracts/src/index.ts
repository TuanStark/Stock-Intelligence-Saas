import { z } from 'zod';

// ─── Shared Utilities ─────────────────────────────────────

/** UUID v4 format */
export const uuid = z.string().uuid();

/** ISO8601 UTC timestamp */
export const timestamp = z.string().datetime({ offset: true });

/** Decimal-safe numeric string */
export const decimal = z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string');

/** Positive decimal */
export const positiveDecimal = decimal.refine(
    (v) => parseFloat(v) > 0,
    'Must be positive',
);

/** Score 0–100 */
export const score = decimal.refine(
    (v) => {
        const n = parseFloat(v);
        return n >= 0 && n <= 100;
    },
    'Score must be between 0 and 100',
);

/** Confidence 0–1 */
export const confidence = decimal.refine(
    (v) => {
        const n = parseFloat(v);
        return n >= 0 && n <= 1;
    },
    'Confidence must be between 0 and 1',
);

// ─── Enums ────────────────────────────────────────────────

export const InstrumentStatusEnum = z.enum(['ACTIVE', 'HALTED', 'DELISTED']);
export const TimeframeEnum = z.enum(['1m', '5m', '15m', '1h', '1d', '1w', '1mo']);
export const PeriodEnum = z.enum(['QUARTER', 'YEAR']);
export const NewsSentimentEnum = z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
export const SignalTypeEnum = z.enum([
    'RSI_OVERBOUGHT',
    'RSI_OVERSOLD',
    'MACD_BULLISH',
    'MACD_BEARISH',
    'BREAKOUT',
    'BREAKDOWN',
    'VOLUME_SPIKE',
]);
export const SignalStrengthEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const StockRatingEnum = z.enum([
    'STRONG_BUY',
    'BUY',
    'HOLD',
    'SELL',
    'STRONG_SELL',
]);
export const AISentimentEnum = z.enum(['BULLISH', 'NEUTRAL', 'BEARISH']);

// ─── Domain 1: Instrument ─────────────────────────────────

export const InstrumentSchema = z.object({
    version: z.literal('v1'),
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

// ─── Domain 2: Market Data ────────────────────────────────

export const QuoteSchema = z.object({
    version: z.literal('v1'),
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

export const CandleSchema = z.object({
    version: z.literal('v1'),
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

// ─── Domain 3: Fundamentals ──────────────────────────────

export const FinancialSnapshotSchema = z.object({
    version: z.literal('v1'),
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

export const ValuationSnapshotSchema = z.object({
    version: z.literal('v1'),
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

// ─── Domain 4: News ───────────────────────────────────────

export const NewsArticleSchema = z.object({
    version: z.literal('v1'),
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

// ─── Domain 5: Signals ────────────────────────────────────

export const SignalSchema = z.object({
    version: z.literal('v1'),
    signalId: uuid,
    instrumentId: uuid,
    type: SignalTypeEnum,
    strength: SignalStrengthEnum,
    score: score,
    value: decimal.nullable(),
    explanation: z.string().max(1000).nullable(),
    detectedAt: timestamp,
    expiresAt: timestamp.nullable(),
    source: z.literal('SYSTEM'),
});
export type Signal = z.infer<typeof SignalSchema>;

// ─── Domain 6: Intelligence ───────────────────────────────

export const StockScoreSchema = z.object({
    version: z.literal('v1'),
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

export const AISummarySchema = z.object({
    version: z.literal('v1'),
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

// ─── Domain 7: Portfolio ──────────────────────────────────

export const PortfolioPositionSchema = z.object({
    version: z.literal('v1'),
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
    version: z.literal('v1'),
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

// ─── Domain 8: System Events ──────────────────────────────

export const DomainEventSchema = <T extends z.ZodType>(payloadSchema: T) =>
    z.object({
        version: z.literal('v1'),
        eventId: uuid,
        eventType: z.string().min(1),
        producer: z.string().min(1),
        occurredAt: timestamp,
        traceId: z.string().min(1),
        payload: payloadSchema,
    });

export type DomainEvent<T> = {
    version: 'v1';
    eventId: string;
    eventType: string;
    producer: string;
    occurredAt: string;
    traceId: string;
    payload: T;
};

// ─── API Response Schemas ─────────────────────────────────

export const PaginationMetaSchema = z.object({
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable(),
    limit: z.number().int().positive(),
    hasMore: z.boolean(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

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

// ─── API Query Schemas ────────────────────────────────────

export const GetCandlesQuerySchema = z.object({
    timeframe: TimeframeEnum.default('1d'),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(100),
});
export type GetCandlesQuery = z.infer<typeof GetCandlesQuerySchema>;

export const SearchInstrumentsQuerySchema = z.object({
    q: z.string().max(100).optional(),
    exchange: z.string().max(20).optional(),
    sector: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
});
export type SearchInstrumentsQuery = z.infer<typeof SearchInstrumentsQuerySchema>;

export const GetNewsQuerySchema = z.object({
    sentiment: NewsSentimentEnum.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
});
export type GetNewsQuery = z.infer<typeof GetNewsQuerySchema>;

// ─── Error Types ──────────────────────────────────────────

export abstract class BaseError extends Error {
    abstract readonly code: string;
    abstract readonly statusCode: number;
    readonly isOperational: boolean = true;
    readonly timestamp: string = new Date().toISOString();

    constructor(
        message: string,
        public readonly details?: unknown,
        public readonly cause?: Error,
    ) {
        super(message);
        this.name = this.constructor.name;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            ...(this.details !== undefined ? { details: this.details } : {}),
        };
    }
}

export class NotFoundError extends BaseError {
    readonly code = 'NOT_FOUND' as const;
    readonly statusCode = 404;
    constructor(entity: string, identifier: string) {
        super(`${entity} not found: ${identifier}`);
    }
}

export class ValidationError extends BaseError {
    readonly code = 'VALIDATION_ERROR' as const;
    readonly statusCode = 400;
    constructor(errors: Record<string, string[]>) {
        super('Validation failed', errors);
    }
}

export class ConflictError extends BaseError {
    readonly code = 'CONFLICT' as const;
    readonly statusCode = 409;
    constructor(message: string) {
        super(message);
    }
}

export class UnauthorizedError extends BaseError {
    readonly code = 'UNAUTHORIZED' as const;
    readonly statusCode = 401;
    constructor(message = 'Authentication required') {
        super(message);
    }
}

export class ForbiddenError extends BaseError {
    readonly code = 'FORBIDDEN' as const;
    readonly statusCode = 403;
    constructor(message = 'Insufficient permissions') {
        super(message);
    }
}

export class QuotaExceededError extends BaseError {
    readonly code = 'QUOTA_EXCEEDED' as const;
    readonly statusCode = 429;
    constructor(resource: string) {
        super(`Quota exceeded for ${resource}`);
    }
}

export class UpstreamError extends BaseError {
    readonly code = 'UPSTREAM_UNAVAILABLE' as const;
    readonly statusCode = 503;
    constructor(source: string, cause?: Error) {
        super(`Upstream service unavailable: ${source}`, undefined, cause);
    }
}
