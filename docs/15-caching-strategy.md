# Caching Strategy Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế caching strategy production-ready cho Stock Intelligence SaaS, bao gồm cache layers, TTL policies, invalidation patterns, cache key design, và stale-while-revalidate strategy.

---

# 1. Caching Principles

1. **Cache is Mandatory** — Không optional. Mọi read-heavy path phải cache.
2. **Stale > Down** — Serve stale data tốt hơn không serve gì.
3. **TTL is King** — Mọi cache entry phải có TTL. Không có "cache forever".
4. **Key Naming Matters** — Cache key phải predictable, namespace rõ.
5. **Invalidation is Hard** — Prefer TTL-based expiry over manual invalidation.
6. **Cache What's Read, Not What's Written** — Cache output, not input.

---

# 2. Cache Layers

```text
┌───────────────────────────────────────────────────┐
│ Layer 1: CDN Cache (Cloudflare/CloudFront)        │
│ → Static assets, public API responses             │
├───────────────────────────────────────────────────┤
│ Layer 2: API Response Cache (Redis)               │
│ → Computed API responses, market data             │
├───────────────────────────────────────────────────┤
│ Layer 3: Application Cache (Redis)                │
│ → Computed signals, scores, quotes                │
├───────────────────────────────────────────────────┤
│ Layer 4: Query Cache (Prisma/DB-level)            │
│ → Frequently accessed DB queries                  │
├───────────────────────────────────────────────────┤
│ Layer 5: Client Cache (TanStack Query)            │
│ → Browser-side API response cache                 │
└───────────────────────────────────────────────────┘
```

---

# 3. TTL Policy Matrix

| Data Type | Redis TTL | CDN TTL | Client `staleTime` | Reasoning |
|---|---|---|---|---|
| Live quote | 10-15s | No cache | 10s | Near-realtime, frequent updates |
| Market overview | 15s | No cache | 15s | Aggregate, frequent updates |
| Candles (daily) | 5 min | 5 min | 5 min | Changes once per candle close |
| Candles (intraday) | 30s | No cache | 30s | Active trading hours |
| Instrument profile | 1 hour | 10 min | 10 min | Rarely changes |
| Financial snapshot | 24 hours | 1 hour | 1 hour | Quarterly updates |
| Signal (active) | 5 min | No cache | 5 min | Recomputed periodically |
| Stock score | 15 min | 5 min | 5 min | Recomputed batch |
| AI summary | 6 hours | 1 hour | 1 hour | Expensive, stable |
| News list | 2 min | No cache | 2 min | Frequent new articles |
| News detail | 1 hour | 30 min | 30 min | Content doesn't change |
| User portfolio | 30s | No cache | 15s | Per-user, price-dependent |
| Static assets | — | 1 year | — | Immutable builds |

---

# 4. Cache Key Design

## Naming Convention

```text
{namespace}:{domain}:{identifier}:{qualifier}

Examples:
  si:quote:FPT                    → Latest quote for FPT
  si:candles:FPT:1d               → Daily candles for FPT
  si:candles:FPT:1h:2026-01-15    → Hourly candles for FPT on date
  si:score:FPT                    → Latest stock score for FPT
  si:signal:FPT:active            → Active signals for FPT
  si:summary:FPT                  → AI summary for FPT
  si:market:overview              → Market overview snapshot
  si:instruments:list             → Instrument master list
  si:user:{userId}:watchlists     → User's watchlists
  si:user:{userId}:portfolio:{id} → User's portfolio snapshot
```

### Centralized Key Registry

```typescript
// packages/config/src/cache-keys.ts

export const CacheKeys = {
  quote:      (symbol: string) => `si:quote:${symbol}`,
  candles:    (symbol: string, tf: string) => `si:candles:${symbol}:${tf}`,
  score:      (symbol: string) => `si:score:${symbol}`,
  signal:     (symbol: string) => `si:signal:${symbol}:active`,
  summary:    (symbol: string) => `si:summary:${symbol}`,
  market:     () => `si:market:overview`,
  instruments:() => `si:instruments:list`,
  
  // Per-user keys
  userWatchlists: (userId: string) => `si:user:${userId}:watchlists`,
  userPortfolio:  (userId: string, portfolioId: string) =>
    `si:user:${userId}:portfolio:${portfolioId}`,
} as const;
```

---

# 5. Cache Patterns

## Pattern 1: Cache-Aside (Read-Through)

```typescript
async getQuote(symbol: string): Promise<Quote> {
  const cacheKey = CacheKeys.quote(symbol);
  
  // 1. Try cache
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // 2. Miss → fetch from source
  const quote = await this.marketDataRepo.getLatestQuote(symbol);
  
  // 3. Write to cache
  await this.redis.setex(cacheKey, TTL.QUOTE, JSON.stringify(quote));
  
  return quote;
}
```

## Pattern 2: Write-Through (Update + Cache)

```typescript
async processQuoteUpdate(quote: Quote): Promise<void> {
  // 1. Store in DB
  await this.marketDataRepo.upsertQuote(quote);
  
  // 2. Update cache immediately
  const cacheKey = CacheKeys.quote(quote.symbol);
  await this.redis.setex(cacheKey, TTL.QUOTE, JSON.stringify(quote));
  
  // 3. Publish event
  this.eventBus.emit('quote.updated', quote);
}
```

## Pattern 3: Stale-While-Revalidate

```typescript
async getStockScore(symbol: string): Promise<StockScore> {
  const cacheKey = CacheKeys.score(symbol);
  
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    const age = Date.now() - new Date(data._cachedAt).getTime();
    
    if (age > SOFT_TTL.SCORE) {
      // Stale → return stale, revalidate in background
      this.revalidateScore(symbol).catch(log);
    }
    
    return data;
  }
  
  // Hard miss → fetch sync
  return this.fetchAndCacheScore(symbol);
}
```

## Pattern 4: Precompute + Cache (Batch)

```typescript
// Worker process — runs on schedule (every 5 min)
async precomputeAllScores(): Promise<void> {
  const instruments = await this.prisma.instrument.findMany({
    where: { status: 'ACTIVE' },
  });
  
  const pipeline = this.redis.pipeline();
  
  for (const inst of instruments) {
    const score = await this.computeScore(inst);
    pipeline.setex(
      CacheKeys.score(inst.symbol),
      TTL.SCORE,
      JSON.stringify(score),
    );
  }
  
  await pipeline.exec();
}
```

---

# 6. Cache Invalidation Strategy

## Strategy 1: TTL-Based (Default)

- Mọi cache entry có TTL
- Hết TTL → auto-evict → next read re-populates
- **Dùng cho:** quotes, candles, market overview

## Strategy 2: Event-Based Invalidation

- Khi data thay đổi → delete cache key
- **Dùng cho:** user-specific data (watchlists, portfolios)

```typescript
// On watchlist update → invalidate cache
async addToWatchlist(userId: string, instrumentId: string): Promise<void> {
  await this.prisma.watchlistItem.create({ ... });
  
  // Invalidate user's watchlist cache
  await this.redis.del(CacheKeys.userWatchlists(userId));
}
```

## Strategy 3: Versioned Cache

- Bump version → all old keys become invalid
- **Dùng cho:** instrument list, sector list (reference data)

```typescript
const cacheKey = `si:instruments:list:v${CACHE_VERSION}`;
```

---

# 7. Redis Configuration

## Connection

```typescript
// packages/config/src/redis.config.ts
export const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 500, 3000),
  enableReadyCheck: true,
  lazyConnect: true,
};
```

## Memory Policy

```text
maxmemory 512mb              # Adjust based on infrastructure
maxmemory-policy allkeys-lru  # Evict least recently used
```

---

# 8. Client-Side Caching (TanStack Query)

```typescript
// apps/web/src/lib/query-client.ts

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30s default stale time
      gcTime: 5 * 60_000,     // 5 min garbage collection
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

// Per-query stale time overrides
export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => api.getQuote(symbol),
    staleTime: 10_000,        // 10s for realtime quotes
    refetchInterval: 15_000,  // Auto-refresh every 15s
  });
}

export function useAISummary(symbol: string) {
  return useQuery({
    queryKey: ['ai-summary', symbol],
    queryFn: () => api.getAISummary(symbol),
    staleTime: 60 * 60_000,   // 1 hour — expensive, stable
  });
}
```

---

# 9. Cache Monitoring

| Metric | Target | Alert |
|---|---|---|
| Cache hit ratio | > 90% | Alert if < 80% |
| Redis memory usage | < 80% of maxmemory | Alert if > 80% |
| Redis connection count | < 200 | Alert if > 150 |
| Cache latency (P95) | < 5ms | Alert if > 10ms |
| Eviction rate | Low | Alert if spike |

---

# 10. Anti-Patterns to Avoid

| ❌ Anti-Pattern | ✅ Correct Approach |
|---|---|
| Cache everything | Cache read-heavy, frequently accessed data |
| No TTL | Always set TTL |
| Cache user-specific data without namespace | Namespace by userId |
| Cache large objects (> 1MB) | Break into smaller keys |
| Ignore cache thundering herd | Use locking or stale-while-revalidate |
| Cache DB result directly | Cache API-ready response |
| Invalidate cache from multiple services | Single owner invalidates |

---

# 11. Final Thesis

Caching tốt = performance tốt + cost thấp.

1. **TTL-first** — Let caches expire naturally
2. **Stale > Down** — Serve stale when source unavailable
3. **Precompute** — Batch compute → cache → serve reads
4. **Namespace keys** — Predictable, discoverable
5. **Monitor** — Hit ratio là north star metric
6. **Layer** — CDN → Redis → DB → Client, mỗi layer một mục đích
