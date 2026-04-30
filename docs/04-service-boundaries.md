# Service Boundary Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế ranh giới service production-ready cho Stock Intelligence SaaS, xác định rõ ownership, bounded context, source of truth, inter-service communication và anti-coupling rules.

---

# 1. Mục tiêu của Service Boundary Blueprint

Service Boundary Blueprint định nghĩa:

- Service nào sở hữu domain nào
- Service nào là source of truth
- Service nào được phép đọc / ghi gì
- Service nào call sync
- Service nào publish async
- Boundary nằm ở đâu để scale không vỡ

Đây là lớp chống:

- service chồng trách nhiệm
- business logic duplicate
- tight coupling
- query chéo DB
- microservice split pain

---

# 2. Boundary Design Principles

1. **Single Ownership**  
   Mỗi domain chỉ có 1 service sở hữu.

2. **Source of Truth is Explicit**  
   Mỗi dữ liệu phải có 1 owner rõ ràng.

3. **No Shared Database**  
   Service không đọc DB của nhau.

4. **Async by Default**  
   Event-first cho internal propagation.

5. **Sync Only for User-Critical Paths**  
   Sync call chỉ dùng khi cần response ngay.

6. **Read Models Are Disposable**  
   Read model có thể rebuild từ events.

7. **Boundaries Before Microservices**  
   Chốt boundary trước, tách process sau.

---

# 3. Service Map Overview

Hệ thống chia thành 10 core services:

1. API Gateway
2. Auth Service
3. Market Data Service
4. Intelligence Service
5. Portfolio Service
6. Alert Service
7. News Service
8. AI Service
9. Billing Service
10. Admin Service

---

# 4. Bounded Context Map

| Bounded Context | Owner Service | Source of Truth |
|---|---|---|
| Identity & Access | Auth Service | users, sessions, roles |
| Market Data | Market Data Service | quotes, candles, instruments |
| Intelligence | Intelligence Service | signals, scores, rankings |
| Portfolio | Portfolio Service | portfolios, positions, pnl |
| Alerts | Alert Service | alert rules, alert events |
| News | News Service | news articles, sentiment |
| AI Intelligence | AI Service | ai summaries |
| Billing | Billing Service | subscriptions, invoices |
| Admin Ops | Admin Service | admin controls, moderation |

---

# 5. Service Ownership (Source of Truth)

## 5.1 API Gateway
### Owns
- Không sở hữu business data

### Responsibilities
- request routing
- auth verification
- rate limiting
- API composition
- response aggregation

### Rules
- không chứa business logic
- không sở hữu domain state
- chỉ orchestration

---

## 5.2 Auth Service
### Owns
- users
- sessions
- roles
- permissions
- api_keys

### Source of Truth
- identity
- access control

### Responsibilities
- signup/login
- JWT
- RBAC
- API key lifecycle

### Publishes
- `user.created`
- `user.updated`
- `api_key.created`
- `api_key.revoked`

---

## 5.3 Market Data Service
### Owns
- instruments
- exchanges
- quotes
- candles
- market snapshots

### Source of Truth
- market state

### Responsibilities
- ingest market feeds
- normalize market data
- publish quote updates
- maintain market cache

### Publishes
- `instrument.updated`
- `quote.updated`
- `candle.closed`
- `market.snapshot.updated`

### Rules
- không tính signals
- không tính AI
- không xử lý user logic

---

## 5.4 Intelligence Service
### Owns
- signals
- stock_scores
- rankings

### Source of Truth
- derived market intelligence

### Responsibilities
- compute indicators
- generate signals
- compute stock scores
- generate ranking models

### Consumes
- `quote.updated`
- `candle.closed`
- `report.published`
- `news.ingested`

### Publishes
- `signal.detected`
- `score.updated`
- `ranking.updated`

### Rules
- không ingest raw market data
- không sở hữu quotes
- không gọi AI trực tiếp trong sync path

---

## 5.5 Portfolio Service
### Owns
- portfolios
- positions
- transactions
- pnl snapshots

### Source of Truth
- portfolio state

### Responsibilities
- portfolio CRUD
- holdings
- pnl compute
- allocation analysis

### Consumes
- `quote.updated`

### Publishes
- `portfolio.updated`
- `portfolio.snapshot.updated`

### Rules
- không sở hữu market data
- chỉ consume latest market state

---

## 5.6 Alert Service
### Owns
- alert_rules
- alert_events
- notification state

### Source of Truth
- user alert state

### Responsibilities
- evaluate rules
- trigger alerts
- dedupe notifications
- delivery tracking

### Consumes
- `quote.updated`
- `signal.detected`
- `portfolio.snapshot.updated`

### Publishes
- `alert.triggered`
- `alert.delivered`
- `alert.failed`

---

## 5.7 News Service
### Owns
- news_articles
- news_instruments
- news sentiment (rule-based / base NLP)

### Source of Truth
- normalized news corpus

### Responsibilities
- ingest news
- dedupe
- classify
- instrument linking
- sentiment baseline

### Publishes
- `news.ingested`
- `news.classified`

### Rules
- không generate AI summary
- chỉ produce normalized news

---

## 5.8 AI Service
### Owns
- ai_summaries
- ai generation jobs
- ai prompt templates

### Source of Truth
- generated AI intelligence

### Responsibilities
- summarize stock
- summarize news
- generate AI insights
- cache AI outputs

### Consumes
- `score.updated`
- `news.classified`
- `portfolio.snapshot.updated`

### Publishes
- `summary.generated`
- `summary.failed`

### Rules
- async only
- không nằm trong request path
- cached output only

---

## 5.9 Billing Service
### Owns
- subscriptions
- invoices
- usage
- quotas

### Source of Truth
- monetization state

### Responsibilities
- plans
- quotas
- premium access
- usage metering

### Publishes
- `subscription.updated`
- `quota.updated`

---

## 5.10 Admin Service
### Owns
- admin actions
- moderation
- operational overrides

### Source of Truth
- admin operational state

### Responsibilities
- admin dashboards
- data repair tools
- manual replays
- source controls

---

# 6. Inter-Service Communication Rules

## Sync Communication (HTTP/gRPC)
Chỉ dùng cho:
- user-facing request path
- auth checks
- API composition

### Allowed Sync Paths
- API Gateway → Auth Service
- API Gateway → Market Data Service
- API Gateway → Intelligence Service
- API Gateway → Portfolio Service
- API Gateway → Billing Service

### Rules
- sync chỉ cho reads / auth / immediate UX
- timeout ngắn
- retry hạn chế
- fallback bắt buộc

---

## Async Communication (Event Bus)
Default cho internal propagation.

### Event Bus Flow
- Market Data → quote.updated
- News → news.ingested
- Intelligence → signal.detected
- Intelligence → score.updated
- Portfolio → portfolio.snapshot.updated
- AI → summary.generated
- Alert → alert.triggered

### Rules
- async first
- idempotent consumers
- replayable events
- dead-letter bắt buộc

---

# 7. Canonical Runtime Flow

## Flow 1 — Market Update
1. Market Data ingests quote
2. publish `quote.updated`
3. Intelligence consumes → compute signal
4. publish `signal.detected`
5. Alert consumes → evaluate rules
6. publish `alert.triggered`

---

## Flow 2 — News Intelligence
1. News ingests article
2. publish `news.ingested`
3. Intelligence consumes for score impact
4. AI consumes for summary
5. publish `summary.generated`

---

## Flow 3 — Portfolio Revaluation
1. Market publishes `quote.updated`
2. Portfolio consumes
3. recompute PnL snapshot
4. publish `portfolio.snapshot.updated`
5. Alert / AI consume

---

# 8. Read Ownership Rules

## User-facing reads
- Market screen → Market Data Service
- Stock score → Intelligence Service
- Portfolio screen → Portfolio Service
- Alerts screen → Alert Service
- News screen → News Service
- AI summary → AI Service

### Rule
Mỗi read endpoint chỉ có 1 owner.

API Gateway chỉ aggregate.

---

# 9. Write Ownership Rules

### Rule tối quan trọng
Chỉ owner service được write domain của nó.

Ví dụ:
- chỉ Portfolio Service write portfolios
- chỉ Alert Service write alert_rules
- chỉ Intelligence Service write signals

Không service nào write domain của service khác.

---

# 10. Anti-Coupling Rules (Non-Negotiable)

1. Không service nào đọc DB của service khác  
2. Không shared domain ownership  
3. Không duplicate business rules  
4. Không sync chaining quá 2 hops  
5. Internal propagation ưu tiên event  
6. Read models có thể denormalize  
7. Write ownership luôn strict  
8. API Gateway không chứa business logic  
9. AI không nằm trong synchronous request path  
10. Service boundary không được phá vì “tiện”

---

# 11. Migration Strategy

Phase 1:
- modular monolith
- shared runtime
- strict module boundaries

Phase 2:
- split workers
- split async consumers

Phase 3:
- extract independent services
- isolate scale hotspots

Boundary giữ nguyên từ đầu, chỉ đổi deployment topology.

---

# 12. Final Thesis

Service Boundary Blueprint là lớp giữ hệ thống không biến thành distributed monolith.

Nó đảm bảo:

- ownership rõ
- scale đúng chỗ
- không query chéo loạn
- không duplicate logic
- tách service không đau

Đây là ranh giới sống còn để Stock Intelligence SaaS scale sạch và bền.