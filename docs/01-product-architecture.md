# Product Architecture Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế kiến trúc tổng thể production-ready, scale tốt, cost-aware cho một Stock Intelligence SaaS

---

# 1. Tóm tắt sản phẩm (Executive Summary)

## Định nghĩa sản phẩm

Đây không phải là một website xem cổ phiếu.

Đây là một nền tảng phân tích & intelligence tài chính giúp nhà đầu tư ra quyết định nhanh hơn và tốt hơn thông qua:

- dữ liệu thị trường sạch
- tín hiệu phân tích đã được tính sẵn
- insight dễ hiểu
- watchlist & alerts
- AI summary
- portfolio intelligence

Sản phẩm này không bán chart.

Sản phẩm này bán:

- tốc độ ra quyết định
- tín hiệu rõ ràng
- độ tin cậy
- tiết kiệm thời gian phân tích

> Chart là giao diện.  
> Insight mới là sản phẩm.

---

# 2. Phạm vi sản phẩm (Product Scope)

## Core Product

Một nền tảng SaaS production-grade cung cấp:

- Tổng hợp dữ liệu thị trường
- Phân tích cổ phiếu
- Tín hiệu kỹ thuật
- Phân tích tài chính
- AI-generated stock summary
- Watchlist & alerts
- Portfolio insights
- API access (giai đoạn monetization)

## Loại sản phẩm

**Hybrid SaaS**

Sản phẩm được thiết kế theo mô hình:

- **B2C SaaS** → Nhà đầu tư cá nhân
- **B2B-lite SaaS** → Analyst / Power users
- **API SaaS** → Bán dữ liệu / tín hiệu qua API (tương lai)

Mục tiêu:

- có recurring revenue
- có premium tier margin cao
- mở rộng được sang API monetization

---

# 3. Mục tiêu sản phẩm (Product Goals)

## Business Goals

- Xây recurring subscription revenue
- Tăng retention bằng habit loop hằng ngày
- Tạo moat bằng chất lượng data + signal
- Giữ infra cost đủ thấp để đảm bảo margin
- Mở rộng từ UI SaaS → API SaaS

## Technical Goals

- Read latency thấp
- Chịu được traffic spike
- Compute theo mô hình precompute-first
- Ingestion resilient, multi-source
- AI integration có kiểm soát chi phí
- Scale tới 10k DAU mà không cần rewrite

---

# 4. Non-Goals (Rất quan trọng)

Để tránh feature sprawl, v1 **không tối ưu** cho:

- order execution / brokerage
- đặt lệnh giao dịch thật
- high-frequency trading
- social feed / copy trading
- derivatives phức tạp
- institutional quant workloads

Những thứ này làm hệ thống phình rất nhanh và không phù hợp giai đoạn đầu.

---

# 5. Tệp người dùng (User Segments)

## Primary ICP — Retail Investors

### Nhu cầu

- ra quyết định nhanh
- tín hiệu rõ
- summary dễ đọc
- alerts
- theo dõi danh mục

### Pain

- quá nhiều noise
- quá nhiều raw data
- không có thời gian phân tích sâu

## Secondary ICP — Power Users

### Nhu cầu

- screening
- so sánh doanh nghiệp
- ranking
- export
- API

### Pain

- workflow thủ công
- tool rời rạc

---

# 6. Nguyên tắc sản phẩm (Product Principles)

- Signal > Raw Data
- Insight > Dashboard
- Precompute > On-demand compute
- Trust > Volume
- Speed > Feature Bloat
- Cost-aware by design
- Mọi external dependency đều có thể fail

---

# 7. Kiến trúc tổng thể (High-Level System Architecture)

Hệ thống được chia thành 6 lớp:

1. Data Source Layer
2. Ingestion Layer
3. Processing Layer
4. Storage Layer
5. Delivery Layer
6. Intelligence Layer

Mỗi layer có trách nhiệm riêng, boundary rõ ràng.

---

# 8. Layer 1 — Data Source Layer

## Trách nhiệm

Thu thập dữ liệu từ bên ngoài.

## Input

- Giá thị trường
- OHLCV history
- Báo cáo tài chính
- Corporate actions
- News feeds
- Macro indicators
- Market breadth

## Nguyên tắc thiết kế

- Không phụ thuộc 1 provider
- Luôn có fallback source
- Normalize schema ngay từ đầu
- Dùng Source Adapter Pattern

## Thiết kế

Mỗi provider được bọc trong 1 adapter:

- ProviderAAdapter
- ProviderBAdapter
- ProviderCAdapter

Tất cả output về cùng 1 normalized schema.

=> tránh vendor lock-in.

---

# 9. Layer 2 — Ingestion Layer

## Trách nhiệm

Pull, validate, normalize, deduplicate, enqueue.

## Nhiệm vụ

- fetch data
- validate schema
- dedupe
- normalize timestamp
- reconcile source conflict
- publish vào queue

## Nguyên tắc

- ingestion tách biệt hoàn toàn khỏi API
- ingestion là write-only
- ingestion không phục vụ user trực tiếp

## Output

Các normalized events:

- price.updated
- report.published
- news.ingested

---

# 10. Layer 3 — Processing Layer

## Trách nhiệm

Biến raw data thành intelligence.

## Nhiệm vụ

- compute technical indicators
- generate signals
- stock scoring
- anomaly detection
- AI summary generation
- ranking

## Nguyên tắc sống còn

**Không compute trong request path.**

Mọi thứ có thể tính trước thì phải precompute.

User chỉ đọc kết quả đã tính sẵn.

---

# 11. Layer 4 — Storage Layer

Sử dụng **polyglot storage**.

## PostgreSQL

Dùng cho:

- users
- billing
- subscriptions
- watchlists
- portfolios
- metadata

## Timeseries Store

Dùng cho:

- tick / candle / OHLCV
- technical history

## Redis

Dùng cho:

- hot cache
- market snapshots
- computed signals cache
- session cache

## Object Storage

Dùng cho:

- raw files
- exports
- report archives

## Search Index

Dùng cho:

- news search
- ticker search
- semantic retrieval

---

# 12. Layer 5 — Delivery Layer

## Trách nhiệm

Phục vụ user với latency thấp.

## Delivery Channels

### REST API

Cho:

- business data
- user data
- metadata

### WebSocket

Cho:

- live price
- market updates

### CDN

Cho:

- static assets
- public resources

### Cache Layer

Cho:

- repeated reads
- market endpoints traffic cao

## Nguyên tắc

User traffic chỉ được đi vào **read path**.

Không compute trong request.

---

# 13. Layer 6 — Intelligence Layer

## Trách nhiệm

Tạo giá trị monetizable.

Đây là moat của sản phẩm.

## Bao gồm

- stock score
- AI summary
- signal explanation
- portfolio insights
- alert intelligence
- ranking engine

Đây là thứ user trả tiền.

Không phải raw prices.

---

# 14. Core Services

Các service chính:

1. API Gateway
2. Auth Service
3. Market Data Service
4. Stock Intelligence Service
5. Portfolio Service
6. Alert Service
7. News Service
8. AI Service
9. Billing Service
10. Admin Service

Có thể bắt đầu bằng modular monolith, nhưng boundaries phải rõ từ ngày đầu.

---

# 15. Chiến lược scale (Scalability Strategy)

## Các rủi ro scale chính

- market open read spikes
- chart read amplification
- indicator compute load
- news ingestion noise
- AI cost explosion

## Chiến lược

- precompute-first
- cache-first reads
- async compute
- queue-backed workloads
- read replicas
- worker autoscaling

---

# 16. Chiến lược reliability

Thiết kế theo giả định: failure là bình thường.

## Failure assumptions

- source providers fail
- queue backlog
- workers lag
- AI timeout
- data đến trễ

Hệ thống phải degrade gracefully.

## Pattern bắt buộc

- retries
- circuit breakers
- dead-letter queues
- idempotent workers
- fallback providers
- stale cache serving

---

# 17. Observability Blueprint

Bắt buộc có từ ngày đầu.

## Must-have

- centralized logs
- metrics
- traces
- queue lag monitoring
- ingestion success rate
- cache hit ratio
- AI cost metrics
- source reliability dashboard

Không có observability = scale mù.

---

# 18. Security Blueprint

Bắt buộc có:

- JWT auth
- RBAC
- rate limiting
- API key management
- secrets management
- audit logging
- encryption at rest
- encryption in transit

Phải future-ready cho API monetization.

---

# 19. Cost Control Blueprint

Rất quan trọng để sống.

## Cost risks

- market data cost
- infra reads
- AI summarization
- websocket fanout

## Cost controls

- aggressive caching
- summarize once
- batch compute
- premium AI gating
- rate-limited API
- archive cold data

---

# 20. Monetization Architecture

## Free Tier

- delayed data
- watchlist giới hạn
- alerts giới hạn

## Pro Tier

- realtime
- advanced signals
- AI summary
- screener
- portfolio intelligence

## API Tier

- metered usage
- API keys
- quotas
- usage billing

Kiến trúc phải support monetization từ ngày đầu.

---

# 21. Delivery Strategy (Execution Plan)

## Phase 1 — Foundation

- contracts
- ingestion
- market data
- watchlist

## Phase 2 — Intelligence

- indicators
- signals
- rankings

## Phase 3 — Monetization

- billing
- premium gating
- AI summary

## Phase 4 — Scale

- replicas
- autoscaling
- queue tuning

---

# 22. Architecture Rules (Non-Negotiable)

1. Không compute trong request path  
2. Precompute mọi thứ có thể  
3. Cache là bắt buộc, không phải optional  
4. External sources luôn có thể fail  
5. Reads luôn lớn hơn writes  
6. AI phải async + cached  
7. User traffic luôn bursty  
8. Stale-but-fast tốt hơn fresh-but-down  
9. Observability là bắt buộc  
10. Cost là first-class concern

---

# 23. Architectural Thesis (Kết luận)

Đây không phải là một dashboard.

Đây là một **data platform có intelligence layer**.

Thành công của nó phụ thuộc vào:

- dữ liệu đáng tin
- delivery latency thấp
- precomputed signals
- scale hiệu quả
- cost hợp lý
- insights đủ giá trị để monetization

Đó là kiến trúc production-ready đúng cho một **Stock Intelligence SaaS**.