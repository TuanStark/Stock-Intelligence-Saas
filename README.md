# **Stock Intelligence SaaS Platform**

> Nền tảng SaaS phân tích và cung cấp thông tin thị trường chứng khoán thông minh dựa trên dữ liệu chuỗi thời gian thực (Time-series) và tích hợp AI.

<div align="left">
  <img src="https://img.shields.io/badge/Node.js-v18+-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/package_manager-pnpm_v9.15.0-F7DF1E.svg" alt="PNPM Workspace" />
  <img src="https://img.shields.io/badge/monorepo-Turborepo-000000.svg?logo=turborepo" alt="Turborepo" />
  <img src="https://img.shields.io/badge/backend-NestJS_v11-E0234E.svg?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/frontend-Next.js-000000.svg?logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/ORM-Prisma_v6-2D3748.svg?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/DB-PostgreSQL_/_TimescaleDB-4169E1.svg?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/cache-Redis-DC382D.svg?logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/infrastructure-Docker-2496ED.svg?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
</div>

---

## 📌 Giới thiệu (About the Project)

**Stock Intelligence SaaS** là một giải pháp toàn diện được thiết kế nhằm giúp các nhà đầu tư cá nhân, tổ chức tài chính nhỏ hoặc các nhà phát triển FinTech tiếp cận nguồn thông tin thị trường chứng khoán sâu sắc. Hệ thống giải quyết các bài toán cốt lõi:
- **Tối ưu hóa dữ liệu chuỗi thời gian:** Sử dụng **TimescaleDB** để lưu trữ và truy vấn hàng triệu bản ghi giá chứng khoán (Quotes) và dữ liệu biểu đồ nến (Candles) một cách mượt mà.
- **Phân tích kỹ thuật tự động:** Công cụ quét nền tảng liên tục tính toán các chỉ số và kích hoạt các tín hiệu mua/bán (RSI, MACD, Breakout, Đột biến khối lượng) theo thời gian thực.
- **Tích hợp Trí tuệ Nhân tạo (AI):** Tổng hợp tin tức thị trường và áp dụng mô hình LLM (OpenAI & LiteLLM Router) để tự động xuất bản báo cáo phân tích rủi ro, động lực tăng trưởng và đánh giá tâm lý thị trường cho từng mã cổ phiếu.
- **Cảnh báo thông minh & Quản lý danh mục:** Hỗ trợ thiết lập thông báo tự động khi đạt ngưỡng điều kiện và theo dõi chi tiết hiệu quả đầu tư thực tế (Portfolio) kèm phí giao dịch, giá vốn trung bình.

---

## 🚀 Tính năng chính (Key Features)

*   **📊 Dữ liệu thị trường thời gian thực (Real-time Market Data):** Cung cấp biểu đồ nến (Historical Candles) đa khung thời gian và thông tin giá thị trường cập nhật liên tục từ các sàn giao dịch.
*   **🧠 Báo cáo Phân tích AI (AI-Powered Stock Insights):** Tự động tóm tắt tin tức, trích xuất động lực tăng trưởng (`drivers`), rủi ro (`risks`), xếp hạng tâm lý (`BULLISH/NEUTRAL/BEARISH`) của doanh nghiệp thông qua OpenAI và LiteLLM.
*   **⚡ Hệ thống Tín hiệu Tự động (Automated Technical Signals):** Phát hiện tức thời các cơ hội giao dịch dựa trên các tín hiệu chỉ báo phổ biến: RSI quá mua/quá bán, đường trung bình cắt nhau, MACD Bullish/Bearish, Volume Spike, breakout đột biến.
*   **📈 Quản lý Danh mục & Giao dịch (Portfolio & Transaction Tracking):** Theo dõi danh mục đầu tư thực tế, ghi nhận các giao dịch mua/bán, tính toán tỷ lệ lợi nhuận, giá vốn trung bình (Average Cost) và phí giao dịch.
*   **🔔 Thiết lập Cảnh báo Tự động (Smart Alert Rules):** Người dùng tự định nghĩa quy tắc cảnh báo (giá tăng/giảm qua ngưỡng, tín hiệu kỹ thuật mới kích hoạt) để nhận thông báo tức thời qua Email.
*   **🔑 Phân quyền và Cấp phát API Key (SaaS Subscription & API Access):** Hệ thống phân quyền người dùng theo các gói dịch vụ (`FREE`, `PRO`, `API`) và cho phép cấp phát, thu hồi API Key bảo mật để tích hợp ứng dụng bên thứ ba.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

### 💻 Frontend
*   **Next.js (App Router)** - Framework React tối ưu SEO và Server-Side Rendering.
*   **TypeScript** & **TailwindCSS** - Đảm bảo tính nhất quán của code và giao diện responsive, hiện đại.
*   **Shadcn/ui** & **Lucide React** - Hệ thống components tinh tế, mượt mà.

### ⚙️ Backend & Workers
*   **NestJS (v11)** - Framework Node.js kiến trúc module chặt chẽ cho API Gateway và dịch vụ lõi.
*   **Worker AI (`worker-ai`)** - Xử lý tích hợp OpenAI API và LiteLLM để phân tích ngữ nghĩa, phân tích tâm lý tin tức và sinh báo cáo.
*   **Worker Ingestion (`worker-ingestion`)** - Chuyên trách thu thập dữ liệu thô từ các API chứng khoán bên ngoài.
*   **Worker Processing (`worker-processing`)** - Chạy nền xử lý số liệu, tính toán các chỉ báo kỹ thuật và tạo tín hiệu giao dịch.

### 🗄️ Database & Cache & Storage
*   **PostgreSQL & TimescaleDB** - Cơ sở dữ liệu chính tối ưu hóa cho dữ liệu Time-series.
*   **Prisma ORM** - Công cụ quản lý schema, di chuyển dữ liệu (Migrations) và Seeding dữ liệu nhanh.
*   **Redis** - Bộ nhớ đệm (Caching) tốc độ cao, quản lý phiên và làm hàng đợi điều phối tác vụ (Queues).
*   **MinIO** - Hệ thống Object Storage tương thích S3 lưu trữ các báo cáo tài chính tài liệu PDF/JSON tĩnh.

### 🐳 Infrastructure & Development Tools
*   **Docker & Docker Compose** - Đóng gói toàn bộ hạ tầng phát triển (Postgres, Redis, MinIO, Mailpit).
*   **Mailpit** - SMTP Server cục bộ dùng cho việc giả lập và kiểm thử gửi email/cảnh báo.
*   **Redis Commander** - Giao diện Web trực quan quản lý dữ liệu lưu trong Redis.
*   **Turborepo** & **PNPM Workspaces** - Quản lý cấu trúc Monorepo hiệu năng cao, tối ưu hóa thời gian build và chia sẻ mã nguồn dùng chung (`packages/*`).

---

## 📂 Cấu trúc thư mục (Project Structure)

```struct
Stock-Intelligence-Saas/
├── apps/
│   ├── api/                 # NestJS API Server (chạy ở cổng 3001)
│   ├── web/                 # Next.js Frontend Web Application (chạy ở cổng 3000)
│   ├── worker-ai/           # Worker xử lý các tác vụ AI & phân tích LLM
│   ├── worker-ingestion/    # Worker thu thập dữ liệu thị trường thực tế
│   └── worker-processing/   # Worker xử lý số liệu kỹ thuật & sinh tín hiệu
├── packages/
│   ├── config/              # Cấu hình dùng chung (ESLint, TSConfig, Prettier)
│   ├── contracts/           # API Contracts, Shared DTOs & TypeScript Types
│   ├── db/                  # Prisma Schema, Migrations và file Seed Database
│   └── utils/               # Các helper functions & Module tiện ích dùng chung
├── infra/
│   └── docker/              # Cấu hình Docker Compose cho các dịch vụ phụ trợ
├── scripts/
│   └── dev-setup.sh         # Script Bash tự động thiết lập môi trường phát triển local
├── package.json             # Root package.json quản lý Monorepo
├── turbo.json               # Cấu hình luồng build/chạy lệnh của Turborepo
└── pnpm-workspace.yaml      # Định nghĩa các package thuộc pnpm workspace
```

---

## 📋 Yêu cầu hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
*   [Node.js](https://nodejs.org/) (Phiên bản `>= 18.0.0`)
*   [PNPM](https://pnpm.io/) (Phiên bản `>= 9.15.0`)
*   [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
*   [Git](https://git-scm.com/)

---

## 🔧 Hướng dẫn cài đặt và khởi chạy (Installation & Setup)

### Bước 1: Clone Repository
```bash
git clone https://github.com/TuanStark/Stock-Intelligence-Saas.git
cd Stock-Intelligence-Saas
```

### Bước 2: Thiết lập môi trường nhanh (Tự động)
Dự án cung cấp sẵn một script giúp bạn thiết lập nhanh môi trường phát triển cục bộ chỉ bằng một câu lệnh:
```bash
# Cấp quyền thực thi cho script (trên macOS/Linux)
chmod +x ./scripts/dev-setup.sh

# Chạy script cài đặt tự động
./scripts/dev-setup.sh
```
> [!NOTE]
> **Script trên sẽ tự động:**
> 1. Tạo file `.env` từ file `.env.example`.
> 2. Cài đặt các dependencies toàn hệ thống qua `pnpm install`.
> 3. Khởi động các container Docker (TimescaleDB, Redis, MinIO, Mailpit).
> 4. Chờ cho Database và Redis sẵn sàng.
> 5. Khởi tạo Prisma Client và chạy Database Migrations.
> 6. Chạy database seed tạo dữ liệu mẫu ban đầu.

*Nếu bạn sử dụng Windows (PowerShell/Command Prompt) hoặc muốn chạy từng bước thủ công:*
```powershell
# 1. Tạo file .env
copy .env.example .env

# 2. Cài đặt các gói thư viện
pnpm install

# 3. Khởi chạy các dịch vụ Docker
pnpm infra:up

# 4. Tạo Prisma Client
pnpm db:generate

# 5. Đồng bộ cấu trúc Database
pnpm db:migrate:dev

# 6. Nạp dữ liệu mẫu
pnpm db:seed
```

### Bước 3: Chạy ứng dụng ở chế độ Development
Khởi động đồng loạt Web, API và các Worker trong môi trường phát triển:
```bash
pnpm dev
```

### 📍 Các cổng kết nối cục bộ (Local Services Mapping)

| Dịch vụ | Địa chỉ truy cập | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện Web** | [http://localhost:3000](http://localhost:3000) | Next.js Client App |
| **API Gateway** | [http://localhost:3001/api/v1](http://localhost:3001/api/v1) | NestJS Server Endpoint |
| **Health Check API** | [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health) | Trạng thái API & Services |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Quản lý Object Storage (User/Pass: `minioadmin` / `minioadmin`) |
| **Redis Commander** | [http://localhost:8081](http://localhost:8081) | Giao diện quản lý bộ nhớ đệm Redis |
| **Mailpit Interface** | [http://localhost:8025](http://localhost:8025) | Hộp thư local để kiểm thử email gửi đi |

---

## 💡 Tài liệu API chính (API Documentation)

### 🔒 Xác thực & Người dùng (Authentication)
*   `POST /api/v1/auth/register` - Đăng ký tài khoản mới.
*   `POST /api/v1/auth/login` - Đăng nhập nhận mã JWT (lưu vào HTTP-only Cookie).
*   `POST /api/v1/auth/logout` - Đăng xuất hệ thống, thu hồi token.

### 📈 Dữ liệu thị trường (Market Data)
*   `GET /api/v1/market/instruments` - Danh sách các mã cổ phiếu hỗ trợ giao dịch.
*   `GET /api/v1/market/quotes?symbol=AAPL` - Lấy thông tin giá hiện tại của cổ phiếu.
*   `GET /api/v1/market/candles?symbol=AAPL&timeframe=1d` - Lấy lịch sử nến biểu đồ kỹ thuật.

### Ví dụ truy vấn dữ liệu giá (Request Example)
```bash
curl -X GET "http://localhost:3001/api/v1/market/quotes?symbol=AAPL" \
     -H "Accept: application/json"
```

**Response mẫu (200 OK):**
```json
{
  "symbol": "AAPL",
  "price": 178.45,
  "change": 1.25,
  "changePercent": 0.7042,
  "open": 177.20,
  "high": 179.05,
  "low": 176.85,
  "previousClose": 177.20,
  "volume": 52430000,
  "timestamp": "2026-05-23T09:30:00Z"
}
```

---

## 🤝 Hướng dẫn đóng góp (Contributing)

Chúng tôi rất hoan nghênh sự đóng góp của bạn để phát triển dự án này tốt hơn! Hãy làm theo các bước dưới đây để bắt đầu đóng góp:

1. **Fork** repository này về tài khoản cá nhân của bạn.
2. Tạo một nhánh (branch) mới để phát triển tính năng:
   ```bash
   git checkout -b feature/tinh-nang-moi
   ```
3. Commit những thay đổi của bạn kèm thông điệp rõ ràng:
   ```bash
   git commit -m "feat: thêm tính năng phân tích kỹ thuật mới"
   ```
4. Push nhánh của bạn lên Remote GitHub:
   ```bash
   git push origin feature/tinh-nang-moi
   ```
5. Mở một **Pull Request** hướng về nhánh `main` của repository gốc để được kiểm duyệt.

---

## 📝 Giấy phép (License)

Dự án này được phân phối dưới giấy phép **MIT License**. Chi tiết vui lòng xem tại file [LICENSE](LICENSE) (nếu có).
