# Data Contract Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Chuẩn hóa toàn bộ dữ liệu (canonical data contracts) cho Stock Intelligence SaaS để đảm bảo hệ thống nhất quán, dễ scale, dễ thay source, dễ maintain.

---

# 1. Mục tiêu của Data Contract Blueprint

Data Contract Blueprint định nghĩa:

- Dữ liệu trong hệ thống **phải có hình dạng gì**
- Mọi service **đọc / ghi / publish** theo format nào
- Mọi source bên ngoài phải normalize về schema nào
- Event giữa các service phải có payload chuẩn nào

Đây là **xương sống dữ liệu** của toàn hệ thống.

Nếu không có data contract:
- mỗi service trả 1 kiểu
- FE mapping loạn
- đổi source là vỡ
- duplicate logic
- scale rất đau

---

# 2. Nguyên tắc thiết kế (Data Contract Principles)

1. **Canonical First**  
   Mọi external source phải map về canonical schema nội bộ.

2. **Source Agnostic**  
   Schema nội bộ không phụ thuộc provider.

3. **Strict Typing**  
   Tất cả field phải có type rõ ràng.

4. **Versioned Contracts**  
   Mọi contract đều versioned (`v1`, `v2`).

5. **Backward Compatible by Default**  
   Thay đổi schema phải tránh breaking consumers.

6. **Explicit Nullability**  
   Field nào optional phải định nghĩa rõ.

7. **Time is First-Class**  
   Mọi record phải có timestamp chuẩn UTC ISO8601.

8. **Money & Precision Safe**  
   Giá / volume / ratios phải decimal-safe.

---

# 3. Canonical Data Domains

Toàn hệ thống chia thành 8 domain dữ liệu:

1. Instrument Domain
2. Market Data Domain
3. Fundamentals Domain
4. News Domain
5. Signal Domain
6. Intelligence Domain
7. Portfolio Domain
8. System Event Domain

---

# 4. Domain 1 — Instrument Contract

Định nghĩa một mã cổ phiếu chuẩn trong hệ thống.

```ts
type Instrument = {
  version: "v1";
  instrumentId: string;         // internal UUID
  symbol: string;               // FPT
  exchange: string;             // HOSE
  market: string;               // VN
  name: string;                 // CTCP FPT
  sector: string | null;        // Technology
  industry: string | null;      // IT Services
  currency: string;             // VND
  isin: string | null;
  status: "ACTIVE" | "HALTED" | "DELISTED";
  tradable: boolean;
  lotSize: number | null;
  createdAt: string;            // ISO8601 UTC
  updatedAt: string;            // ISO8601 UTC
};
```

### Rules

- `instrumentId` là internal identity duy nhất
- `symbol` không dùng làm primary key
- Mọi source map về `instrumentId`

---

# 5. Domain 2 — Market Data Contract

## 5.1 Realtime Quote Contract

```ts
type Quote = {
  version: "v1";
  instrumentId: string;
  symbol: string;
  price: string;                // decimal string
  change: string;
  changePercent: string;
  open: string;
  high: string;
  low: string;
  previousClose: string;
  volume: string;
  value: string;
  timestamp: string;            // market timestamp
  asOf: string;                 // ingestion timestamp UTC
  source: string;
};
```

## 5.2 OHLCV Candle Contract

```ts
type Candle = {
  version: "v1";
  instrumentId: string;
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d" | "1w" | "1mo";
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  value: string | null;
  timestamp: string;            // candle open time UTC
  source: string;
};
```

### Rules

- Numeric fields dùng `string` để tránh precision loss
- `timestamp` luôn là candle-open timestamp
- `asOf` khác `timestamp`

---

# 6. Domain 3 — Fundamentals Contract

## 6.1 Financial Snapshot

```ts
type FinancialSnapshot = {
  version: "v1";
  instrumentId: string;
  period: "QUARTER" | "YEAR";
  fiscalYear: number;
  fiscalQuarter: number | null;
  revenue: string | null;
  grossProfit: string | null;
  operatingIncome: string | null;
  netIncome: string | null;
  eps: string | null;
  roe: string | null;
  roa: string | null;
  debtToEquity: string | null;
  freeCashFlow: string | null;
  grossMargin: string | null;
  netMargin: string | null;
  reportDate: string;
  publishedAt: string | null;
  source: string;
};
```

## 6.2 Valuation Snapshot

```ts
type ValuationSnapshot = {
  version: "v1";
  instrumentId: string;
  pe: string | null;
  pb: string | null;
  ps: string | null;
  evEbitda: string | null;
  dividendYield: string | null;
  marketCap: string | null;
  sharesOutstanding: string | null;
  asOf: string;
  source: string;
};
```

---

# 7. Domain 4 — News Contract

```ts
type NewsArticle = {
  version: "v1";
  newsId: string;
  instrumentIds: string[];
  headline: string;
  summary: string | null;
  content: string | null;
  url: string;
  source: string;
  language: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  relevanceScore: string | null;
  publishedAt: string;
  ingestedAt: string;
};
```

### Rules

- `newsId` là internal UUID, không dùng URL làm PK
- 1 bài news có thể map nhiều instrument
- `sentiment` là derived field, không phải source truth

---

# 8. Domain 5 — Signal Contract

```ts
type Signal = {
  version: "v1";
  signalId: string;
  instrumentId: string;
  type:
    | "RSI_OVERBOUGHT"
    | "RSI_OVERSOLD"
    | "MACD_BULLISH"
    | "MACD_BEARISH"
    | "BREAKOUT"
    | "BREAKDOWN"
    | "VOLUME_SPIKE";
  strength: "LOW" | "MEDIUM" | "HIGH";
  score: string;                // 0-100
  value: string | null;         // raw signal value
  explanation: string | null;
  detectedAt: string;
  expiresAt: string | null;
  source: "SYSTEM";
};
```

### Rules

- Signals luôn là derived data
- `source` luôn là `SYSTEM`
- Signal phải có TTL (`expiresAt`) nếu cần invalidate

---

# 9. Domain 6 — Intelligence Contract

## 9.1 Stock Score

```ts
type StockScore = {
  version: "v1";
  instrumentId: string;
  score: string;                // 0-100
  rating: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  factors: {
    technical: string;
    fundamentals: string;
    momentum: string;
    valuation: string;
    sentiment: string;
  };
  asOf: string;
};
```

## 9.2 AI Summary

```ts
type AISummary = {
  version: "v1";
  instrumentId: string;
  summary: string;
  sentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  confidence: string;           // 0-1
  drivers: string[];
  risks: string[];
  generatedAt: string;
  expiresAt: string | null;
  model: string;
};
```

---

# 10. Domain 7 — Portfolio Contract

## 10.1 Portfolio Position

```ts
type PortfolioPosition = {
  version: "v1";
  portfolioId: string;
  instrumentId: string;
  quantity: string;
  averageCost: string;
  marketPrice: string;
  marketValue: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  updatedAt: string;
};
```

## 10.2 Portfolio Snapshot

```ts
type PortfolioSnapshot = {
  version: "v1";
  portfolioId: string;
  totalValue: string;
  totalCost: string;
  totalPnl: string;
  totalPnlPercent: string;
  diversificationScore: string | null;
  riskScore: string | null;
  updatedAt: string;
};
```

---

# 11. Domain 8 — System Event Contracts

Tất cả event nội bộ publish qua queue phải có envelope chuẩn.

```ts
type DomainEvent<T> = {
  version: "v1";
  eventId: string;
  eventType: string;
  producer: string;
  occurredAt: string;
  traceId: string;
  payload: T;
};
```

### Standard Event Types

- `price.updated`
- `quote.updated`
- `candle.closed`
- `report.published`
- `valuation.updated`
- `news.ingested`
- `signal.detected`
- `score.updated`
- `summary.generated`

---

# 12. Contract Governance Rules

1. Không service nào được tự ý đổi schema
2. Contract thay đổi phải bump version
3. Event consumers không được assume field ngoài contract
4. Optional field phải explicit nullable
5. Mọi numeric tài chính phải decimal-safe
6. Mọi timestamp phải UTC ISO8601
7. Internal contracts không expose raw provider schema

---

# 13. Serialization Rules

- JSON only
- UTF-8
- ISO8601 UTC timestamps
- Decimal as string
- Enum uppercase
- `null` explicit
- `snake_case` cho persistence
- `camelCase` cho API contracts