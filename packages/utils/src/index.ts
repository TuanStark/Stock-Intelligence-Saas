
// ─── Decimal-Safe Arithmetic ──────────────────────────────

/**
 * Safely adds two decimal strings.
 * Uses integer arithmetic to avoid floating point precision issues.
 */
export function decimalAdd(a: string, b: string): string {
    const maxDecimals = Math.max(getDecimalPlaces(a), getDecimalPlaces(b));
    const multiplier = Math.pow(10, maxDecimals);
    const result = Math.round(parseFloat(a) * multiplier + parseFloat(b) * multiplier) / multiplier;
    return result.toString();
}

/**
 * Safely subtracts two decimal strings.
 */
export function decimalSubtract(a: string, b: string): string {
    const maxDecimals = Math.max(getDecimalPlaces(a), getDecimalPlaces(b));
    const multiplier = Math.pow(10, maxDecimals);
    const result = Math.round(parseFloat(a) * multiplier - parseFloat(b) * multiplier) / multiplier;
    return result.toString();
}

/**
 * Calculate percent change between two decimal strings.
 */
export function percentChange(from: string, to: string): string {
    const f = parseFloat(from);
    const t = parseFloat(to);
    if (f === 0) return '0';
    return ((t - f) / Math.abs(f) * 100).toFixed(2);
}

function getDecimalPlaces(num: string): number {
    const parts = num.split('.');
    return parts.length > 1 ? parts[1].length : 0;
}

// ─── Date Utilities ───────────────────────────────────────

/** Returns current UTC timestamp in ISO8601 format */
export function nowUTC(): string {
    return new Date().toISOString();
}

/** Checks if a timestamp is older than the given TTL in milliseconds */
export function isStale(timestamp: string, ttlMs: number): boolean {
    return Date.now() - new Date(timestamp).getTime() > ttlMs;
}

// ─── Retry ────────────────────────────────────────────────

export interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

/**
 * Retry a function with exponential backoff + jitter.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
): Promise<T> {
    const { maxAttempts, baseDelayMs, maxDelayMs } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) throw error;

            const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
            const jitter = delay * 0.2 * Math.random();
            await sleep(delay + jitter);
        }
    }

    throw new Error('Unreachable');
}

// ─── Result Type ──────────────────────────────────────────

export type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

// ─── General Utilities ────────────────────────────────────

/** Sleep for ms milliseconds */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a random hex string */
export function randomHex(bytes: number = 32): string {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Logger ───────────────────────────────────────────────

export { Logger, createLogger } from './logger';
