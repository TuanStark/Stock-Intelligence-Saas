# Error Handling Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế error handling strategy nhất quán cho toàn bộ hệ thống. Đảm bảo errors rõ ràng, actionable, không leak internals, và handle gracefully ở mọi layer.

---

# 1. Error Handling Principles

1. **Errors are First-Class** — Không swallow errors, không empty catch blocks.
2. **Fail Fast, Fail Loud** — Validation errors phải phát hiện sớm nhất có thể.
3. **Never Leak Internals** — Stack traces, DB errors, provider details không leak ra client.
4. **Errors Must Be Actionable** — User phải biết: lỗi gì, do đâu, làm gì tiếp.
5. **Structured Logging** — Mọi error phải log structured data cho debugging.
6. **Graceful Degradation** — Hệ thống degrade, không crash hàng loạt.

---

# 2. Error Hierarchy

```text
BaseError
├── DomainError (business logic violations)
│   ├── NotFoundError
│   ├── ConflictError
│   ├── ValidationError
│   └── BusinessRuleError
├── AuthError (authentication/authorization)
│   ├── UnauthorizedError
│   ├── ForbiddenError
│   ├── TokenExpiredError
│   └── QuotaExceededError
├── InfraError (infrastructure failures)
│   ├── UpstreamError
│   ├── DatabaseError
│   ├── CacheError
│   └── QueueError
└── SystemError (unexpected/unknown)
    └── InternalError
```

---

# 3. Error Contract (Shared)

```typescript
// packages/contracts/src/errors/base-error.ts

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
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}
```

## Domain Errors

```typescript
export class NotFoundError extends BaseError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(entity: string, identifier: string) {
    super(`${entity} not found: ${identifier}`);
  }
}

export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(errors: Record<string, string[]>) {
    super('Validation failed');
    this.details = errors;
  }
}

export class ConflictError extends BaseError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

export class BusinessRuleError extends BaseError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;

  constructor(rule: string, message: string) {
    super(message);
    this.details = { rule };
  }
}
```

## Auth Errors

```typescript
export class UnauthorizedError extends BaseError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
  constructor(message = 'Authentication required') { super(message); }
}

export class ForbiddenError extends BaseError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
  constructor(message = 'Insufficient permissions') { super(message); }
}

export class TokenExpiredError extends BaseError {
  readonly code = 'TOKEN_EXPIRED';
  readonly statusCode = 401;
  constructor() { super('Token has expired'); }
}

export class QuotaExceededError extends BaseError {
  readonly code = 'QUOTA_EXCEEDED';
  readonly statusCode = 429;
  constructor(resource: string) { super(`Quota exceeded for ${resource}`); }
}
```

## Infrastructure Errors

```typescript
export class UpstreamError extends BaseError {
  readonly code = 'UPSTREAM_UNAVAILABLE';
  readonly statusCode = 503;
  readonly isOperational = true;

  constructor(source: string, cause?: Error) {
    super(`Upstream service unavailable: ${source}`, undefined, cause);
  }
}

export class DatabaseError extends BaseError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
  readonly isOperational = false;

  constructor(operation: string, cause?: Error) {
    super(`Database error during: ${operation}`, undefined, cause);
  }
}
```

---

# 4. API Error Response Format

Mọi API error response phải tuân theo format chuẩn:

```typescript
type ApiErrorResponse = {
  success: false;
  error: {
    code: string;          // Machine-readable error code
    message: string;       // Human-readable message
    details?: unknown;     // Validation errors, field-level details
  };
  meta: {
    requestId: string;     // Correlation ID
    timestamp: string;     // Error timestamp
  };
};
```

### Example Responses

```json
// 400 - Validation Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["must be a valid email"],
      "password": ["must be at least 8 characters"]
    }
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-01-15T10:30:00Z"
  }
}

// 404 - Not Found
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Instrument not found: XYZ"
  },
  "meta": {
    "requestId": "req_def456",
    "timestamp": "2026-01-15T10:30:00Z"
  }
}

// 503 - Upstream Unavailable
{
  "success": false,
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Market data service temporarily unavailable"
  },
  "meta": {
    "requestId": "req_ghi789",
    "timestamp": "2026-01-15T10:30:00Z"
  }
}
```

---

# 5. NestJS Global Exception Filter

```typescript
// apps/api/src/common/filters/global-exception.filter.ts

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const requestId = request.headers['x-request-id'] || uuid();

    if (exception instanceof BaseError) {
      // Known operational error → structured response
      this.logger.warn({
        code: exception.code,
        message: exception.message,
        requestId,
        path: request.url,
        ...(exception.cause && { cause: exception.cause.message }),
      });

      return response.status(exception.statusCode).json({
        success: false,
        error: exception.toJSON(),
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }

    if (exception instanceof HttpException) {
      // NestJS HTTP exceptions
      const status = exception.getStatus();
      return response.status(status).json({
        success: false,
        error: { code: 'HTTP_ERROR', message: exception.message },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
    }

    // Unknown error → log full, respond generic
    this.logger.error({
      message: 'Unhandled exception',
      error: exception instanceof Error ? exception.message : 'Unknown',
      stack: exception instanceof Error ? exception.stack : undefined,
      requestId,
      path: request.url,
    });

    return response.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
}
```

---

# 6. Retry & Circuit Breaker Patterns

## Retry Strategy

```typescript
// packages/utils/src/retry.ts

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.maxAttempts) throw error;
      if (!isRetryable(error, options.retryableErrors)) throw error;

      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt - 1),
        options.maxDelayMs,
      );
      await sleep(delay + jitter(delay * 0.1));
    }
  }
  throw new Error('Unreachable');
}
```

### Retry Configuration per Service

| Service | Max Attempts | Base Delay | Retryable Errors |
|---|---|---|---|
| Market Data Adapter | 3 | 1000ms | `UPSTREAM_UNAVAILABLE`, `TIMEOUT` |
| AI Provider | 2 | 2000ms | `RATE_LIMITED`, `TIMEOUT` |
| Database | 2 | 500ms | `CONNECTION_ERROR` |
| Cache (Redis) | 1 | 0ms | — (fail fast, serve stale) |

## Circuit Breaker

```text
States:
  CLOSED  → Normal operation, count failures
  OPEN    → Fast-fail all requests (after threshold)
  HALF_OPEN → Allow 1 test request to check recovery

Thresholds:
  Failure threshold: 5 failures in 60 seconds
  Open duration: 30 seconds
  Half-open test: 1 request
```

---

# 7. Dead Letter Queue (DLQ)

Mọi async job fail sau max retries → DLQ.

```text
Main Queue ──► Worker ──► Success
                 │
                 ├─► Retry (attempt 1)
                 ├─► Retry (attempt 2)
                 ├─► Retry (attempt 3)
                 │
                 └─► DLQ ──► Alert ──► Manual Review
```

### DLQ Rules

1. Mỗi queue có 1 DLQ tương ứng
2. DLQ jobs tagged: `originalQueue`, `failureReason`, `attempts`, `lastError`
3. DLQ phải có monitoring/alerting
4. Admin can replay DLQ jobs
5. DLQ retention: 7 days

---

# 8. Error Handling by Layer

| Layer | Error Strategy |
|---|---|
| Controller | Catch nothing — let GlobalExceptionFilter handle |
| Service | Throw domain errors, wrap infra errors |
| Repository | Catch Prisma errors, rethrow as domain errors |
| Adapter | Catch provider errors, rethrow as UpstreamError |
| Worker | Log + retry + DLQ |
| WebSocket | Send error frame, don't close connection |

### Example: Repository Error Wrapping

```typescript
async findInstrumentBySymbol(symbol: string): Promise<Instrument> {
  try {
    const instrument = await this.prisma.instrument.findUnique({
      where: { symbol_exchangeId: { symbol, exchangeId } },
    });
    
    if (!instrument) {
      throw new NotFoundError('Instrument', symbol);
    }
    
    return instrument;
  } catch (error) {
    if (error instanceof BaseError) throw error;
    throw new DatabaseError('findInstrumentBySymbol', error as Error);
  }
}
```

---

# 9. Frontend Error Handling

```typescript
// Global error boundary
class ErrorBoundary extends React.Component {
  // Catch rendering errors → show fallback UI
}

// API error handling via TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error.code === 'UNAUTHORIZED') return false;
        if (error.code === 'NOT_FOUND') return false;
        return failureCount < 3;
      },
      onError: (error) => {
        if (error.code === 'UNAUTHORIZED') {
          // Redirect to login
        }
      },
    },
  },
});
```

---

# 10. Error Monitoring & Alerting

| Error Type | Action |
|---|---|
| Validation errors | Log, no alert (expected) |
| Not found | Log, no alert (expected) |
| Unauthorized | Log, alert if spike |
| Upstream errors | Log, alert, circuit breaker |
| Database errors | Log, alert immediately, page on-call |
| Unhandled exceptions | Log, alert immediately, Sentry capture |
| DLQ accumulation | Alert when > 10 items |

---

# 11. Final Thesis

Error handling tốt = hệ thống tự giải thích khi có vấn đề.

1. **User thấy**: message rõ ràng, error code stable
2. **Developer thấy**: structured log, requestId, stack trace
3. **Ops thấy**: alerts, dashboards, DLQ counts
4. **Nobody thấy**: internals, credentials, DB schema
