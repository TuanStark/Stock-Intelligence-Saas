# API Contract Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế external API contract production-ready cho Stock Intelligence SaaS, bao gồm public API surface, request/response contracts, ownership, pagination, filtering, error model và versioning strategy.

---

# 1. Mục tiêu của API Contract Blueprint

API Contract Blueprint định nghĩa:

- Frontend / Mobile / API clients sẽ gọi endpoint nào
- Public API surface gồm những gì
- Request / Response shape chuẩn là gì
- Pagination / filtering / sorting chuẩn ra sao
- Error contract thống nhất như thế nào
- Versioning và backward compatibility được quản lý ra sao

Đây là lớp chống:

- FE gọi API tùy hứng
- response shape loạn
- mobile/web mismatch
- API drift
- version chaos

---

# 2. API Design Principles

1. **API First**  
   API là contract sản phẩm, không phải implementation detail.

2. **Consumer-Centric**  
   Design theo nhu cầu consumer, không theo DB schema.

3. **Stable Response Shapes**  
   Response phải ổn định, predictable.

4. **Explicit Versioning**  
   Public API luôn versioned.

5. **Backward Compatible by Default**  
   Ưu tiên additive changes.

6. **Read-Optimized**  
   API tối ưu cho read-heavy traffic.

7. **Consistent Error Model**  
   Tất cả errors cùng 1 contract.

---

# 3. API Surface Overview

API chia thành 3 lớp:

1. Public Web API
2. Authenticated User API
3. External Developer API

---

# 4. API Namespacing Strategy

```text
/api/v1/public/*
/api/v1/me/*
/api/v1/dev/*
```

### Namespaces

- `/public` → public market data, anonymous reads
- `/me` → authenticated user actions
- `/dev` → metered developer/API customer access

---

# 5. Response Envelope Standard

Tất cả API responses phải theo envelope chuẩn.

## Success Response

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
};
```

## Error Response

```ts
type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
};
```

---

# 6. Pagination Contract

Cursor-first cho list APIs.

```ts
type PaginationMeta = {
  nextCursor: string | null;
  prevCursor: string | null;
  limit: number;
  hasMore: boolean;
};
```

### Rules

- Cursor pagination mặc định
- Offset chỉ dùng cho admin
- Max limit enforced
- Stable sorting bắt buộc

---

# 7. Filtering / Sorting Contract

## Query Pattern

```text
?limit=20
&cursor=abc123
&sort=-publishedAt
&filter[sentiment]=POSITIVE
&filter[exchange]=HOSE
```

### Rules

- `sort=-field` → desc
- `sort=field` → asc
- `filter` namespace bắt buộc
- Unknown filter → reject

---

# 8. Authentication Contract

## Auth Types

| API Layer  | Auth Method |
| ---------- | ----------- |
| Public API | No auth     |
| User API   | JWT Bearer  |
| Dev API    | API Key     |

## Headers

```text
Authorization: Bearer <jwt>
X-API-Key: <key>
X-Request-Id: <uuid>
```

---

# 9. Public Web API Surface (`/api/v1/public`)

## 9.1 Market Overview

```
GET /api/v1/public/market/overview
```

Trả về:

- Market status
- VNINDEX / major indexes
- Top gainers
- Top losers
- Top volume

### Response

```ts
type MarketOverviewResponse = {
  status: "OPEN" | "CLOSED";
  indices: {
    symbol: string;
    price: string;
    change: string;
    changePercent: string;
  }[];
  topGainers: Quote[];
  topLosers: Quote[];
  topVolume: Quote[];
};
```

**Owner:** API Gateway (aggregate)

---

## 9.2 Instruments Search

```
GET /api/v1/public/instruments
```

**Query:** `q`, `exchange`, `sector`, `limit`

**Owner:** Market Data Service

---

## 9.3 Instrument Detail

```
GET /api/v1/public/instruments/:symbol
```

Trả về: instrument profile, latest quote, latest score, latest summary

**Owner:** API Gateway (aggregate)

---

## 9.4 Candles

```
GET /api/v1/public/instruments/:symbol/candles
```

**Query:** `timeframe`, `from`, `to`, `limit`

**Owner:** Market Data Service

---

## 9.5 Signals

```
GET /api/v1/public/instruments/:symbol/signals
```

**Owner:** Intelligence Service

---

## 9.6 News

```
GET /api/v1/public/instruments/:symbol/news
```

**Owner:** News Service

---

## 9.7 AI Summary

```
GET /api/v1/public/instruments/:symbol/summary
```

**Owner:** AI Service

---

# 10. User API Surface (`/api/v1/me`)

## 10.1 Profile

```
GET    /api/v1/me/profile
PATCH  /api/v1/me/profile
```

**Owner:** Auth Service

---

## 10.2 Watchlists

```
GET    /api/v1/me/watchlists
POST   /api/v1/me/watchlists
PATCH  /api/v1/me/watchlists/:id
DELETE /api/v1/me/watchlists/:id
```

**Owner:** Portfolio Service

---

## 10.3 Watchlist Items

```
POST   /api/v1/me/watchlists/:id/items
DELETE /api/v1/me/watchlists/:id/items/:instrumentId
```

**Owner:** Portfolio Service

---

## 10.4 Portfolios

```
GET    /api/v1/me/portfolios
POST   /api/v1/me/portfolios
GET    /api/v1/me/portfolios/:id
PATCH  /api/v1/me/portfolios/:id
DELETE /api/v1/me/portfolios/:id
```

**Owner:** Portfolio Service

---

## 10.5 Portfolio Transactions

```
POST   /api/v1/me/portfolios/:id/transactions
GET    /api/v1/me/portfolios/:id/transactions
```

**Owner:** Portfolio Service

---

## 10.6 Alerts

```
GET    /api/v1/me/alerts
POST   /api/v1/me/alerts
PATCH  /api/v1/me/alerts/:id
DELETE /api/v1/me/alerts/:id
```

**Owner:** Alert Service

---

## 10.7 Subscription

```
GET /api/v1/me/subscription
```

**Owner:** Billing Service

---

# 11. Developer API Surface (`/api/v1/dev`)

## 11.1 Quotes API

```
GET /api/v1/dev/quotes?symbols=FPT,VCB,HPG
```

**Owner:** Market Data Service

---

## 11.2 Candles API

```
GET /api/v1/dev/candles
```

**Owner:** Market Data Service

---

## 11.3 Signals API

```
GET /api/v1/dev/signals
```

**Owner:** Intelligence Service

---

## 11.4 Scores API

```
GET /api/v1/dev/scores
```

**Owner:** Intelligence Service

---

## 11.5 Usage API

```
GET /api/v1/dev/usage
```

**Owner:** Billing Service

---

# 12. API Ownership Rules

### Gateway-owned (aggregate)

- Market overview
- Instrument detail

### Direct service-owned

- Auth endpoints
- Portfolio endpoints
- Alerts endpoints
- Signals endpoints
- News endpoints

### Rule

Gateway chỉ aggregate, không chứa domain logic.

---

# 13. Error Contract

### Standard Error Codes

| Code                   | Description              |
| ---------------------- | ------------------------ |
| `UNAUTHORIZED`         | Missing or invalid auth  |
| `FORBIDDEN`            | Insufficient permissions |
| `NOT_FOUND`            | Resource not found       |
| `VALIDATION_ERROR`     | Invalid request data     |
| `RATE_LIMITED`         | Rate limit exceeded      |
| `QUOTA_EXCEEDED`       | API quota exceeded       |
| `INTERNAL_ERROR`       | Server error             |
| `UPSTREAM_UNAVAILABLE` | External dependency down |

### Rules

- Error code stable
- Message human-readable
- Internal details không leak

---

# 14. Versioning Strategy

### URL Versioning

```
/api/v1/...
```

### Rules

- Public APIs luôn versioned
- Breaking change → new version
- Additive change → same version
- Field removal bị cấm trong active version

---

# 15. Deprecation Policy

1. Announce deprecation
2. Support overlap window
3. Sunset date required
4. Telemetry before removal

---

# 16. API Performance Rules

1. Read APIs cache-first
2. No compute in request path
3. P95 response target < 300ms
4. Cursor pagination bắt buộc cho list lớn
5. Max limit enforced
6. Aggregation tối đa 2 service hops
