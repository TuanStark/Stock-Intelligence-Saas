import { z } from 'zod';

// ─── Environment Variables (validated at startup) ─────────

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3001),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().default(''),

    // Auth
    JWT_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // AI (optional — not needed in Phase 1)
    OPENAI_API_KEY: z.string().optional(),
    LITELLM_API_BASE: z.string().url().optional(),

    // Market Data (optional — not needed in Phase 1)
    MARKET_DATA_API_KEY: z.string().optional(),

    // URLs
    WEB_URL: z.string().url().default('http://localhost:3000'),
    API_URL: z.string().url().default('http://localhost:3001'),
});

export type Env = z.infer<typeof EnvSchema>;

/** Validates environment at startup — throws if invalid */
export function validateEnv(): Env {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.flatten().fieldErrors);
        process.exit(1);
    }
    return result.data;
}

// ─── Cache Keys ───────────────────────────────────────────

export const CacheKeys = {
    quote: (symbol: string) => `si:quote:${symbol}`,
    candles: (symbol: string, tf: string) => `si:candles:${symbol}:${tf}`,
    score: (symbol: string) => `si:score:${symbol}`,
    signal: (symbol: string) => `si:signal:${symbol}:active`,
    summary: (symbol: string) => `si:summary:${symbol}`,
    market: () => `si:market:overview`,
    instruments: () => `si:instruments:list`,
    userWatchlists: (userId: string) => `si:user:${userId}:watchlists`,
    userPortfolio: (userId: string, portfolioId: string) =>
        `si:user:${userId}:portfolio:${portfolioId}`,
} as const;

// ─── Cache TTL (milliseconds) ─────────────────────────────

export const CacheTTL = {
    QUOTE: 15_000,            // 15 seconds
    MARKET_OVERVIEW: 15_000,  // 15 seconds
    CANDLES_DAILY: 5 * 60_000,   // 5 minutes
    CANDLES_INTRADAY: 30_000,    // 30 seconds
    INSTRUMENT_PROFILE: 60 * 60_000, // 1 hour
    FINANCIAL_SNAPSHOT: 24 * 60 * 60_000, // 24 hours
    SIGNAL: 5 * 60_000,       // 5 minutes
    SCORE: 15 * 60_000,       // 15 minutes
    AI_SUMMARY: 6 * 60 * 60_000, // 6 hours
    NEWS_LIST: 2 * 60_000,    // 2 minutes
    NEWS_DETAIL: 60 * 60_000, // 1 hour
} as const;

// ─── Queue Names ──────────────────────────────────────────

export const QueueNames = {
    PRICE_INGESTION: 'price-ingestion',
    NEWS_INGESTION: 'news-ingestion',
    FUNDAMENTALS_INGESTION: 'fundamentals-ingestion',
    SIGNAL_COMPUTE: 'signal-compute',
    SCORE_COMPUTE: 'score-compute',
    RANKING_COMPUTE: 'ranking-compute',
    AI_SUMMARY: 'ai-summary',
    ALERT_EVALUATE: 'alert-evaluate',
    NOTIFICATION_SEND: 'notification-send',
} as const;

// ─── Constants ────────────────────────────────────────────

export const Constants = {
    MAX_WATCHLISTS_FREE: 3,
    MAX_WATCHLISTS_PRO: 50,
    MAX_WATCHLIST_ITEMS: 100,
    MAX_PORTFOLIOS: 10,
    MAX_ALERTS_FREE: 5,
    MAX_ALERTS_PRO: 100,
    MAX_API_SYMBOLS_PER_REQUEST: 50,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    BCRYPT_SALT_ROUNDS: 12,
} as const;
