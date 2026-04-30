# Technology Stack Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Chọn tech stack production-ready cho Stock Intelligence SaaS với tiêu chí: scale tốt, cost-aware, maintainable, hiring-friendly, dev velocity cao và không over-engineered.

---

# 1. Tech Stack Selection Principles

Tech stack cho Stock Intelligence SaaS phải thỏa 6 tiêu chí:

1. **Scale tốt ở read-heavy workloads**
2. **Cost hợp lý khi mới launch**
3. **Dễ tuyển người / phổ biến**
4. **Dễ maintain lâu dài**
5. **Fast iteration cho MVP**
6. **Không over-engineered quá sớm**

Nguyên tắc:
> Chọn công nghệ boring, battle-tested, scale được.  
> Tránh chọn tech “ngầu” nhưng khó maintain.

---

# 2. Frontend Stack

## Core
- **Next.js 15**  
- **React 19**  
- **TypeScript**  
- **Tailwind CSS**  
- **TanStack Query**  
- **Zustand**

## Vì sao

### Next.js
Phù hợp nhất cho SaaS vì:
- SSR / ISR tốt cho SEO
- app router tốt cho dashboard
- dễ scale
- tốt cho landing page + app cùng repo

### React
UI ecosystem mạnh nhất.

### TypeScript
Bắt buộc cho shared contracts FE/BE.

### Tailwind
Nhanh, scale design system tốt.

### TanStack Query
Cache / API state / revalidation cực mạnh.

### Zustand
Client state nhẹ, đơn giản hơn Redux.

## Không chọn
- Redux (quá nặng)
- Vue/Nuxt (team market nhỏ hơn)
- Angular (overkill)
- CSS Modules (scale kém hơn Tailwind)

---

# 3. Backend Stack

## Core
- **Node.js 22 LTS**
- **TypeScript**
- **NestJS**
- **REST-first**
- **WebSocket**

## Vì sao

### Node.js
Phù hợp cho:
- I/O heavy
- API-heavy SaaS
- realtime
- shared TS contracts

### NestJS
Rất hợp với:
- modular monolith
- clean architecture
- DI
- scalable service boundaries

### REST-first
Đơn giản, dễ cache, dễ debug, dễ monetize hơn GraphQL giai đoạn đầu.

### WebSocket
Cho:
- realtime quotes
- alerts
- live portfolio refresh

### Prisma ORM
Dùng vì:
- Type-safe database access
- Auto-generated client từ schema
- Migration system tích hợp
- Ecosystem mạnh (Prisma Studio, seeding, extensions)
- Fit tốt với NestJS (@nestjs/prisma)
- AI-friendly schema format (dễ đọc, dễ generate)

## Không chọn
- Express (quá free-form)
- Fastify raw (Nest bọc đủ rồi)
- GraphQL-first (complexity cao quá sớm)
- Go (tốt nhưng chậm velocity hơn với team nhỏ)

---

# 4. Background Jobs / Async Stack

## Core
- **BullMQ**
- **Redis Streams** (optional later)
- **Node workers**

## Vì sao

BullMQ đủ mạnh cho:
- ingestion jobs
- retries
- delayed jobs
- DLQ
- worker concurrency

Giai đoạn đầu chưa cần Kafka.

## Khi scale lớn hơn
- Kafka / Redpanda cho event streaming
- Temporal cho orchestration phức tạp

## Không chọn sớm
- Kafka (quá sớm)
- RabbitMQ (ổn nhưng kém fit hơn Redis stack giai đoạn đầu)

---

# 5. Database Stack

## Core
- **PostgreSQL 17**
- **TimescaleDB** (Postgres extension)
- **Redis 7**
- **S3-compatible Object Storage**
- **OpenSearch**

---

## PostgreSQL
Dùng cho:
- users
- billing
- watchlists
- portfolios
- signals
- summaries
- metadata

Lý do:
- battle-tested
- ACID
- relational mạnh
- ecosystem mạnh

---

## TimescaleDB
Dùng cho:
- OHLCV
- candles
- timeseries analytics

Lý do:
- scale time-series tốt
- vẫn là Postgres
- không phải maintain DB khác quá sớm

=> tốt hơn Influx cho use case này giai đoạn đầu.

---

## Redis
Dùng cho:
- hot cache
- quote cache
- session
- queue backend

Redis là bắt buộc.

---

## Object Storage
Dùng:
- raw files
- exports
- archived reports

Chọn:
- AWS S3 / Cloudflare R2 / MinIO

---

## OpenSearch
Dùng cho:
- ticker search
- news full-text
- semantic search later

Không cần Elasticsearch commercial complexity.

---

# 6. Messaging / Event Stack

## Giai đoạn đầu
- **BullMQ + Redis**

## Giai đoạn scale
- **Kafka / Redpanda**

### Strategy
Bắt đầu đơn giản, upgrade khi throughput thật sự cần.

---

# 7. AI Stack

## Core
- **OpenAI / Gemini / Claude (pluggable)**
- **LiteLLM** (provider abstraction)
- **Prompt templates**
- **Async AI workers**
- **Redis AI cache**

## Vì sao
Không lock 1 model provider.

Dùng abstraction layer từ đầu để:
- fallback model
- cost control
- model routing

### Rule
AI luôn:
- async
- cached
- precomputed

Không bao giờ sync trong request path.

---

# 8. Auth Stack

## Core
- **JWT**
- **Refresh Token**
- **RBAC**
- **API Keys**

## Vì sao
Đủ cho:
- user auth
- SaaS auth
- API monetization

Không cần OAuth provider phức tạp ở v1 (có thể thêm sau).

---

# 9. Infra / DevOps Stack

## Core
- **Docker**
- **Kubernetes**
- **Terraform**
- **GitHub Actions**
- **NGINX Ingress**

## Vì sao

### Docker
Chuẩn local + deploy.

### Kubernetes
Scale services/workers đúng cách.

### Terraform
Infra versioned.

### GitHub Actions
Đủ tốt cho CI/CD.

### NGINX Ingress
Đơn giản, battle-tested.

## Không chọn sớm
- ECS (ok nhưng kém portable hơn)
- Nomad (team familiarity thấp)
- Argo quá sớm (có thể thêm sau)

---

# 10. Observability Stack

## Core
- **OpenTelemetry**
- **Prometheus**
- **Grafana**
- **Loki**
- **Sentry**

## Vì sao
Đây là minimum production stack.

- traces → OTel
- metrics → Prometheus
- dashboards → Grafana
- logs → Loki
- app errors → Sentry

---

# 11. Testing Stack

## Core
- **Vitest**
- **Playwright**
- **Supertest**
- **Testcontainers**

## Vì sao
- unit → Vitest
- e2e UI → Playwright
- API integration → Supertest
- real infra tests → Testcontainers

---

# 12. Monorepo Tooling

## Core
- **pnpm**
- **TurboRepo**
- **TypeScript Project References**

## Vì sao
- fast installs
- workspace-native
- incremental build
- remote caching

---

# 13. Recommended Production Stack (Final)

## Frontend
- Next.js
- React
- TypeScript
- Tailwind
- TanStack Query
- Zustand

## Backend
- Node.js
- TypeScript
- NestJS
- REST
- WebSocket

## Async
- BullMQ
- Redis

## Data
- PostgreSQL
- TimescaleDB
- Redis
- S3
- OpenSearch

## AI
- LiteLLM
- OpenAI / Gemini / Claude

## Infra
- Docker
- Kubernetes
- Terraform
- GitHub Actions

## Observability
- OpenTelemetry
- Prometheus
- Grafana
- Loki
- Sentry

---

# 14. Final Thesis

Tech stack tốt nhất cho Stock Intelligence SaaS không phải stack “xịn” nhất.

Mà là stack:

- scale đủ lâu
- cost hợp lý
- dễ tuyển
- dễ maintain
- build nhanh
- không tự giết velocity

Stack trên là pragmatic, production-ready và đủ mạnh để scale từ MVP tới real SaaS.