# I. Product Definition

Ta không build “website xem cổ phiếu”.

Ta build: **Stock Intelligence SaaS Platform**  
_Một nền tảng cung cấp dữ liệu, tín hiệu, phân tích và insight cho nhà đầu tư._

Sản phẩm này **không** bán chart. Sản phẩm này bán:

- Tốc độ ra quyết định
- Chất lượng insight
- Tín hiệu đáng tin
- Tiết kiệm thời gian phân tích

> **Chart chỉ là UI. Insight mới là product.**

## 2. ICP (Ideal Customer Profile)

Nếu target sai, toàn bộ feature sai. Chọn ICP đầu tiên:

### Primary ICP — Retail Investors (B2C)

**Người dùng:**

- 23–40 tuổi, đầu tư cá nhân, có vốn.
- Không có thời gian tự phân tích sâu.
- Muốn quyết định nhanh hơn.

Họ không cần quá nhiều raw data. Họ cần:

- _“Mã nào đáng xem?”_
- _“Có tín hiệu gì?”_
- _“Đang rẻ hay đắt?”_
- _“Có gì bất thường?”_

=> **Đây là nhóm dễ kiếm user đầu tiên.**

### Secondary ICP — Power Users

**Người dùng nâng cao:**

- Trader, Analyst, Team research nhỏ.

Họ cần:

- Screener mạnh, Compare companies, Export, Signals, API.

=> **Đây là tier trả tiền cao.**

## 3. Value Proposition

User không trả tiền để xem chart. User trả tiền để:

- Lọc nhiễu
- Thấy tín hiệu sớm
- Đọc nhanh
- Ra quyết định nhanh hơn

**Core value proposition:**

> _"Giúp nhà đầu tư ra quyết định nhanh hơn với dữ liệu sạch, tín hiệu rõ và insight dễ hiểu."_

_(Đây là câu định nghĩa toàn bộ product)._

---

# II. Product Strategy (Để không build sai)

### Rule 1: Don’t build a stock portal

Không build cổng thông tin.

- ❌ **Sai hướng:** Nhồi news, nhồi data, nhồi chỉ số. Đó là data portal. Không ai trả tiền cho data portal.
- ✅ **Đúng hướng:** Lọc, chấm điểm, xếp hạng, giải thích, cảnh báo. Đó là intelligence product.

### Rule 2: Build for decisions, not for browsing

- ❌ **Sai:** User vào xem cho biết.
- ✅ **Đúng:** User vào để quyết định: **Mua? Giữ? Bán? Bỏ qua?**  
  _(Mọi feature phải phục vụ quyết định)._

### Rule 3: Signal > Raw Data

Raw data miễn phí ở khắp nơi. Signal mới có giá trị.

- Người dùng **không cần:** 300 chỉ số.
- Người dùng **cần:** _“Có gì đáng chú ý?”_

---

# III. System Architecture (Thiết kế như production SaaS)

Bây giờ mới tới system. Kiến trúc chuẩn production sẽ chia thành 6 lớp. Tách rõ ngay từ đầu, không build monolith _"API + cron + worker + UI"_ nhét chung. Lúc đầu nhanh, sau đó chết.

### 1. Data Source Layer

Đây là foundation. Không có data tốt thì mọi thứ phía trên vô nghĩa.

- **Nguồn dữ liệu:** Market price feed, Historical OHLCV, Financial statements, Corporate actions, Market breadth, News feeds, Macro data.
- **Nguyên tắc:** Không phụ thuộc 1 source, luôn có fallback, normalize schema từ đầu.
- **Thiết kế:** Dùng _Source Adapter Pattern_ (mỗi provider là 1 adapter, output chung 1 schema normalize). Đổi provider không phải rewrite system.

### 2. Ingestion Layer

Tách riêng hoàn toàn. Đây là lớp chống chaos. Không cho frontend/backend chạm source trực tiếp. Tất cả data đi qua ingestion.

- **Nhiệm vụ:** Pull data ➔ Validate ➔ Normalize ➔ Dedupe ➔ Enqueue.

### 3. Processing Layer

Đây là compute engine.

- **Nhiệm vụ:** Compute indicators, signals, ranking, anomalies, summaries.
- **Nguyên tắc sống còn:** **Never compute on user request.** Compute trước, user chỉ đọc kết quả. _(Đây là khác biệt giữa toy app và SaaS)._

### 4. Storage Layer

Không dùng 1 DB cho mọi thứ. Phải chia đúng vai trò (sai phổ biến nhất là nhét hết vào PostgreSQL):

- **PostgreSQL:** User, billing, metadata
- **Timeseries store:** Market data
- **Redis:** Hot cache
- **Object storage:** Raw files
- **Search index:** News/search

### 5. Delivery Layer

Phục vụ user theo kiểu phù hợp. _User không bao giờ được chạm compute path, chỉ chạm read path._

- **REST:** Static/business
- **WebSocket:** Live price
- **Cache-first API:** Repeated reads
- **CDN:** Static

### 6. Intelligence Layer

Đây là "moat" (hào cản vệ) và là thứ user trả tiền.

- **Bao gồm:** Stock score, AI summary, Signal explanation, Smart alerts, Portfolio insight.

---

# IV. Scaling Strategy (Thiết kế để không chết)

Muốn không stuck, phải design theo bottleneck trước. 4 bottleneck chắc chắn tới:

1. **Read Explosion** (Hàng nghìn user mở chart cùng lúc)
   - _Giải pháp:_ Pre-aggregated candles, Redis, CDN cache, Read replicas.
2. **Compute Explosion** (Indicators cho hàng nghìn mã)
   - _Giải pháp:_ Batch compute, Worker queues, Incremental updates.
3. **News Explosion** (Spam / duplicate / noisy feeds)
   - _Giải pháp:_ Dedupe, Score, Classify, TTL cache.
4. **AI Cost Explosion** (AI rất đắt)
   - _Giải pháp:_ Summarize once, Cache forever (until invalidated), Async generate, Premium only.

---

# V. Engineering Rules (Bắt buộc để sống lâu)

Đây là những rule sống còn:

- Compute async
- Cache aggressively
- Precompute everything possible
- Treat data as product
- Design for failure
- Every external source is unreliable
- User traffic is bursty
- AI is expensive
- Reads dominate writes
- Observability is mandatory

---

# VI. Execution Plan (Triển khai đúng thứ tự)

- **Phase 1 — Foundation:** Product scope, data contracts, DB design, source adapters, ingestion pipeline.
- **Phase 2 — Core Platform:** Market data, stock detail, watchlist, caching, websocket.
- **Phase 3 — Intelligence:** Indicators, signals, ranking, AI summary.
- **Phase 4 — Monetization:** Billing, subscription, rate limit, premium gating.
- **Phase 5 — Scale:** Workers, queue, replicas, observability, autoscaling.

---

# VII. Điều Senior quan tâm nhất

**Junior hỏi:**

> _"Dùng framework gì?"_

**Senior hỏi:**

- Bottleneck đầu tiên ở đâu?
- Source nào fail trước?
- Cost chết ở đâu?
- Cache invalidation ra sao?
- Data stale bao lâu chấp nhận được?
- Compute nào phải async?
- Cái gì đáng precompute?
- Phần nào user trả tiền?

_Đó là sự khác biệt._
