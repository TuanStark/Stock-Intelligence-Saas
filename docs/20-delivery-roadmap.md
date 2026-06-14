# Delivery Roadmap — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Xây dựng roadmap triển khai 12 tuần cho Stock Intelligence SaaS, đảm bảo có thể ship MVP usable nhanh, giảm execution risk và giữ đúng kiến trúc production-ready.

---

# 1. Delivery Strategy

Roadmap được chia theo 4 milestone lớn:

1. Foundation Ready
2. MVP Usable
3. Beta Ready
4. Launch Ready

Mỗi milestone phải:

- deployable
- testable
- measurable
- demoable

Không milestone nào được tính là complete nếu chỉ “code xong”.

---

# 2. Delivery Timeline Overview

## Total Timeline: 12 Weeks

- **Weeks 1–2** → Foundation
- **Weeks 3–6** → MVP Build
- **Weeks 7–9** → Intelligence + Beta
- **Weeks 10–12** → Monetization + Hardening + Launch Prep

---

# 3. Milestone Map

| Milestone        | Target Week | Outcome                                |
| ---------------- | ----------: | -------------------------------------- |
| Foundation Ready |      Week 2 | Repo, infra, auth, DB chạy ổn          |
| MVP Usable       |      Week 6 | User có thể dùng sản phẩm end-to-end   |
| Beta Ready       |      Week 9 | Signals + alerts + AI summary usable   |
| Launch Ready     |     Week 12 | Billing + hardening + production-ready |

---

# 4. Weeks 1–2 — Foundation Ready

## Goal

Dựng toàn bộ foundation để team build không block nhau.

## Build Scope

- monorepo scaffold
- pnpm + Turbo setup
- CI baseline
- local infra (Postgres, Redis, MinIO)
- base NestJS services
- Next.js app shell
- shared contracts package
- shared config package
- database bootstrap
- auth skeleton
- observability bootstrap
- Docker local stack

## Deliverables

- repo chạy local 1 lệnh
- FE boot được
- BE boot được
- DB migrate được
- auth skeleton usable
- CI pass

## Exit Criteria

- `pnpm dev` chạy full local stack
- CI chạy lint + typecheck + test pass
- login flow skeleton hoạt động
- migrations chạy ổn

---

# 5. Weeks 3–4 — Core Market Experience

## Goal

Ship vertical slice đầu tiên: market read experience.

## Build Scope

- market overview API
- instrument search API
- stock detail API
- candles API
- market overview UI
- search UI
- stock detail page
- chart rendering
- market cache layer
- seed market data ingestion

## Deliverables

User có thể:

- xem market overview
- tìm mã cổ phiếu
- xem stock detail
- xem candles chart

## Exit Criteria

- market overview usable end-to-end
- stock detail usable end-to-end
- candles load ổn
- P95 < 400ms local/staging

---

# 6. Weeks 5–6 — MVP Usable

## Goal

Biến sản phẩm thành usable MVP.

## Build Scope

- watchlist CRUD
- watchlist UI
- portfolio CRUD
- transactions
- portfolio PnL
- dashboard shell
- `/me` APIs
- auth hardening
- basic websocket quote updates

## Deliverables

User có thể:

- login
- tạo watchlist
- thêm mã
- tạo portfolio
- theo dõi PnL

## Exit Criteria

- watchlist usable
- portfolio usable
- login stable
- dashboard usable
- MVP demo được end-to-end

## Milestone

**MVP Usable achieved**

---

# 7. Weeks 7–8 — Intelligence Layer

## Goal

Thêm lớp value thật sự cho sản phẩm.

## Build Scope

- indicator engine
- stock score engine
- signal generation
- signal API
- signal UI
- rankings
- alert rules
- alert worker
- notification pipeline

## Deliverables

User có:

- stock signals
- stock score
- alert rules
- alert notifications

## Exit Criteria

- signals xuất hiện ổn định
- alerts trigger đúng
- ranking usable
- worker retry-safe

---

# 8. Week 9 — Beta Ready

## Goal

Thêm AI layer và hoàn tất beta loop.

## Build Scope

- news ingestion
- news linking
- AI summary worker
- AI summary API
- AI summary UI
- AI cache
- prompt templates
- async AI jobs

## Deliverables

User có:

- stock news
- AI summary
- AI explanation

## Exit Criteria

- AI summary async ổn định
- cache hit hợp lý
- summary usable
- beta flow hoàn chỉnh

## Milestone

**Beta Ready achieved**

---

# 9. Weeks 10–11 — Monetization

## Goal

Biến product thành SaaS.

## Build Scope

- subscription model
- billing service
- plan gating
- quotas
- premium feature gating
- pricing page
- usage metering
- API key management

## Deliverables

- free / pro plans
- paywall
- premium access
- usage tracking

## Exit Criteria

- plan gating đúng
- quota enforcement đúng
- billing flow testable

---

# 10. Week 12 — Hardening + Launch Prep

## Goal

Đưa hệ thống về trạng thái launch-ready.

## Build Scope

- retries / DLQ
- rate limiting
- audit logs
- dashboards
- alerts
- backup verification
- restore test
- staging soak test
- production checklist
- launch runbook

## Deliverables

- production-safe system
- launch checklist
- runbooks
- observability dashboards

## Exit Criteria

- staging stable
- rollback tested
- backup restore tested
- launch checklist green

## Milestone

**Launch Ready achieved**

---

# 11. Release Plan

## Internal Demo

- End Week 2

## MVP Demo

- End Week 6

## Closed Beta

- End Week 9

## Production Launch

- End Week 12

---

# 12. Scope Cut Rules (Risk Control)

Nếu trễ timeline:

## Cut First

- advanced rankings
- fancy chart UX
- AI explanation depth
- developer APIs
- admin polish

## Never Cut

- auth
- market read path
- watchlist
- portfolio
- signals
- observability
- deployment stability

---

# 13. Weekly Risk Hotspots

| Week | Risk                                |
| ---- | ----------------------------------- |
| 1    | repo / infra bootstrap drag         |
| 3    | data ingestion instability          |
| 5    | auth + user state complexity        |
| 7    | signal correctness                  |
| 9    | AI latency / cost                   |
| 10   | billing edge cases                  |
| 12   | staging drift / release instability |

---

# 14. Success Criteria

Roadmap thành công khi:

- Week 2 có foundation stable
- Week 6 có MVP usable
- Week 9 có beta usable
- Week 12 launch được không rewrite

---

# 15. Final Thesis

Delivery Roadmap là lớp biến architecture thành timeline có thể ship.

Nó đảm bảo:

- build đúng thứ tự
- có milestone rõ
- MVP usable sớm
- beta có value thật
- launch không hoảng loạn

Đây là roadmap thực thi để biến Stock Intelligence SaaS từ blueprint thành sản phẩm thật.
