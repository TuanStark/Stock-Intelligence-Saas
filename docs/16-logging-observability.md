# Logging & Observability Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế logging & observability strategy cho Stock Intelligence SaaS, bao gồm structured logging, correlation IDs, metrics, tracing, dashboards, và alerting.

---

# 1. Observability Principles

1. **Observe Everything, Alert Selectively** — Log rộng, alert hẹp.
2. **Structured Always** — JSON logs, không free-text.
3. **Correlation First** — Mọi request phải trace được end-to-end.
4. **Metrics Before Logs** — Check dashboard trước khi grep logs.
5. **Cost-Aware** — Log retention có TTL, không log data lớn.
6. **No Sensitive Data** — Không log passwords, tokens, PII.

---

# 2. Three Pillars of Observability

| Pillar      | Tool                         | Purpose                          |
| ----------- | ---------------------------- | -------------------------------- |
| **Logs**    | Loki + Structured Logger     | What happened (events)           |
| **Metrics** | Prometheus + Grafana         | How much / how fast (aggregates) |
| **Traces**  | OpenTelemetry + Tempo/Jaeger | Where time was spent (flow)      |

---

# 3. Structured Logging

## Log Format

```json
{
  "level": "info",
  "timestamp": "2026-01-15T09:30:15.123Z",
  "service": "api",
  "traceId": "abc123def456",
  "requestId": "req_xyz789",
  "userId": "user_123",
  "message": "Quote fetched successfully",
  "context": {
    "symbol": "FPT",
    "source": "cache",
    "latencyMs": 3
  }
}
```

## Log Levels

| Level   | Usage                                 | Example                         |
| ------- | ------------------------------------- | ------------------------------- |
| `error` | System failures, unhandled exceptions | DB connection lost              |
| `warn`  | Recoverable issues, degradation       | Cache miss fallback to DB       |
| `info`  | Business events, request lifecycle    | User registered, quote fetched  |
| `debug` | Development details                   | Cache key checked, query params |

### Rules

- **Production:** `info` and above
- **Staging:** `debug` and above
- **Never:** `console.log` in production code

## Logger Implementation

```typescript
// packages/utils/src/logger.ts
import { pino } from "pino";

export function createLogger(service: string) {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service,
      env: process.env.NODE_ENV,
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    redact: {
      paths: ["password", "token", "apiKey", "passwordHash", "authorization"],
      censor: "[REDACTED]",
    },
  });
}
```

---

# 4. Correlation IDs

## Request ID Flow

```text
Client ──► API Gateway ──► Auth Service ──► Market Data ──► DB
  │              │               │               │           │
  │         requestId       requestId       requestId    requestId
  └── X-Request-Id: req_abc123 ──────────────────────────────┘
                          (same ID across all)
```

## Implementation

```typescript
// NestJS middleware
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    req["requestId"] = requestId;
    res.setHeader("X-Request-Id", requestId);

    // Attach to async context for logger
    AsyncLocalStorage.run({ requestId }, () => next());
  }
}
```

---

# 5. Metrics

## Business Metrics

| Metric                        | Type      | Description                      |
| ----------------------------- | --------- | -------------------------------- |
| `user.registrations.total`    | Counter   | Total registrations              |
| `user.dau`                    | Gauge     | Daily active users               |
| `subscription.upgrades.total` | Counter   | Tier upgrades                    |
| `api.requests.total`          | Counter   | Total API requests (by endpoint) |
| `api.response.latency`        | Histogram | Response latency (by endpoint)   |
| `api.errors.total`            | Counter   | Errors (by code)                 |

## Infrastructure Metrics

| Metric                      | Type      | Description             |
| --------------------------- | --------- | ----------------------- |
| `cache.hit.ratio`           | Gauge     | Cache hit rate          |
| `cache.latency`             | Histogram | Redis operation latency |
| `db.query.latency`          | Histogram | Database query latency  |
| `db.connections.active`     | Gauge     | Active DB connections   |
| `queue.depth`               | Gauge     | BullMQ pending jobs     |
| `queue.processing.duration` | Histogram | Job processing time     |
| `queue.dlq.depth`           | Gauge     | Dead letter queue size  |

## Data Pipeline Metrics

| Metric                    | Type      | Description           |
| ------------------------- | --------- | --------------------- |
| `ingestion.success.total` | Counter   | Successful ingestions |
| `ingestion.failure.total` | Counter   | Failed ingestions     |
| `ingestion.latency`       | Histogram | Ingestion lag         |
| `source.health`           | Gauge     | Provider health (1/0) |
| `ai.requests.total`       | Counter   | AI API calls          |
| `ai.cost.total`           | Counter   | AI cost (in cents)    |
| `ai.latency`              | Histogram | AI generation time    |

---

# 6. Tracing (OpenTelemetry)

## What to Trace

| Span              | Attributes                                       |
| ----------------- | ------------------------------------------------ |
| HTTP Request      | method, url, status, latency                     |
| Database Query    | operation, table, latency                        |
| Cache Operation   | operation, key, hit/miss, latency                |
| External API Call | provider, endpoint, status, latency              |
| Queue Job         | queue, jobType, status, duration                 |
| AI Generation     | model, prompt_tokens, completion_tokens, latency |

## NestJS Integration

```typescript
// apps/api/src/main.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({
  serviceName: "stock-intel-api",
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

---

# 7. Dashboards (Grafana)

## Dashboard 1: API Health

- Request rate (by endpoint)
- P50 / P95 / P99 latency
- Error rate (by code)
- Active connections

## Dashboard 2: Data Pipeline

- Ingestion success/failure rate
- Source provider health
- Queue depth + processing rate
- DLQ accumulation

## Dashboard 3: Market Data

- Quote freshness (last update per symbol)
- Cache hit ratio
- WebSocket connections
- Data staleness alerts

## Dashboard 4: Business

- DAU / MAU
- Registration funnel
- Subscription tier distribution
- API usage (dev tier)

## Dashboard 5: Infrastructure

- CPU / Memory / Disk per pod
- DB connections + query latency
- Redis memory + hit ratio
- Pod restart count

---

# 8. Alerting Rules

| Alert                   | Condition                             | Severity    | Action              |
| ----------------------- | ------------------------------------- | ----------- | ------------------- |
| API error rate spike    | > 5% errors in 5 min                  | 🔴 Critical | Page on-call        |
| P95 latency high        | > 1s for 5 min                        | 🟡 Warning  | Investigate         |
| DB connection pool full | > 90% used                            | 🔴 Critical | Scale + investigate |
| Redis memory high       | > 80% maxmemory                       | 🟡 Warning  | Review eviction     |
| Queue DLQ growing       | > 10 items                            | 🟡 Warning  | Review failed jobs  |
| Ingestion failure       | > 3 consecutive failures              | 🔴 Critical | Check source        |
| AI cost spike           | > $10/hour                            | 🟡 Warning  | Review usage        |
| Pod crash loop          | > 3 restarts in 10 min                | 🔴 Critical | Page on-call        |
| Source provider down    | Health check failing                  | 🟡 Warning  | Activate fallback   |
| Data staleness          | Quote > 5 min old during market hours | 🟡 Warning  | Check ingestion     |

---

# 9. Log Retention

| Environment | Retention    | Storage |
| ----------- | ------------ | ------- |
| Production  | 30 days      | Loki    |
| Staging     | 7 days       | Loki    |
| Development | Session only | Console |

## Cost Optimization

- Log sampling: 100% errors, 10% info in high-traffic endpoints
- No logging request/response bodies (except errors)
- Metrics preferred over logs for aggregates

---

# 10. What NOT to Log

- Passwords, tokens, API keys
- Full request/response bodies
- PII (email in access logs)
- Health check requests
- Successful cache hits (use metrics instead)
- High-frequency market data (use metrics for rate/latency)

---

# 11. Final Thesis

Observability tốt = debug nhanh, sleep ngon.

1. **Structured logs** — Machine-parseable, human-readable
2. **Correlation IDs** — Trace any request end-to-end
3. **Metrics first** — Dashboards trước, logs sau
4. **Smart alerting** — Alert on symptoms, not noise
5. **Cost-aware** — Retention policies, sampling
6. **Redact sensitive** — Automatic PII redaction
