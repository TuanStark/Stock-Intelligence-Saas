# Infrastructure Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế hạ tầng production-ready cho Stock Intelligence SaaS, bao gồm runtime topology, deployment strategy, environment strategy, networking, secrets, observability và ops foundation để hệ thống scale ổn định, cost-aware và dễ vận hành.

---

# 1. Mục tiêu của Infrastructure Blueprint

Infrastructure Blueprint định nghĩa:

- Hệ thống chạy ở đâu
- Chạy như thế nào ở local / dev / staging / production
- Service deploy theo topology nào
- Networking hoạt động ra sao
- Secrets quản lý thế nào
- Observability / backups / DR setup ra sao

Đây là lớp chống:

- local mỗi máy chạy 1 kiểu
- staging ≠ production
- deploy drift
- config drift
- secrets loạn
- scale không kiểm soát
- ops mù

---

# 2. Infrastructure Design Principles

1. **Environment Parity**  
   Local → staging → production càng giống nhau càng tốt.

2. **Immutable Deployments**  
   Build 1 lần, promote nhiều môi trường.

3. **Container-First**  
   Mọi runtime đều containerized.

4. **Infra as Code**  
   Infra phải versioned.

5. **Config Externalized**  
   Config không hardcode.

6. **Observability by Default**  
   Logs / metrics / traces bắt buộc.

7. **Failure is Expected**  
   Infra phải assume failure.

8. **Cost-Aware by Design**  
   Scale phải có cost guardrails.

---

# 3. Runtime Topology Overview

Hệ thống có 4 môi trường:

1. Local
2. Development
3. Staging
4. Production

Mỗi môi trường có topology khác nhau nhưng contract giống nhau.

---

# 4. Environment Topology

## 4.1 Local
Mục tiêu:
- developer productivity
- fast feedback
- reproducible local stack

Chạy bằng:
- Docker Compose
- local Postgres
- local Redis
- local MinIO
- mock external providers

### Rules
- local không gọi provider thật mặc định
- local deterministic
- local bootstrap 1 command

---

## 4.2 Development
Mục tiêu:
- shared integration env
- feature validation
- lightweight CI deploy target

Chạy bằng:
- shared K8s namespace
- lightweight managed DB
- shared Redis
- mock / sandbox providers

### Rules
- unstable allowed
- cost tối ưu
- resettable

---

## 4.3 Staging
Mục tiêu:
- pre-production validation
- production-like testing
- release verification

Chạy bằng:
- production-like K8s
- prod-like config
- real integrations (guarded)

### Rules
- staging ≈ production
- no experimental infra
- release candidate only

---

## 4.4 Production
Mục tiêu:
- customer traffic
- stable operations
- reliability first

Chạy bằng:
- multi-node K8s
- managed stateful infra
- autoscaling
- full observability

---

# 5. Deployment Topology

## Runtime Units

Deploy theo 4 loại runtime:

1. Web App
2. API Services
3. Workers
4. Stateful Infra

---

## 5.1 Web App
- Next.js app
- stateless
- horizontally scalable
- CDN fronted

Deploy:
- containerized web pods

---

## 5.2 API Services
- stateless services
- internal service-to-service traffic
- scale independently

Deploy:
- 1 deployment / service

---

## 5.3 Workers
- async consumers
- queue-driven
- independently scalable

Deploy:
- dedicated worker deployments

---

## 5.4 Stateful Infra
- PostgreSQL
- Redis
- OpenSearch
- Object Storage

Rule:
stateful components tách lifecycle khỏi app workloads.

---

# 6. Kubernetes Topology

## Namespaces
- `stock-dev`
- `stock-staging`
- `stock-prod`

## Core Resources
- Deployments
- StatefulSets
- Services
- Ingress
- ConfigMaps
- Secrets
- HPA
- CronJobs

### Rules
- app per deployment
- stateful per StatefulSet / managed service
- workers scale riêng

---

# 7. Networking Blueprint

## Traffic Layers

1. External Traffic
2. Internal Service Traffic
3. Data Plane Traffic

---

## 7.1 External Traffic
Internet → CDN → Ingress → Web / API Gateway

### Rules
- TLS bắt buộc
- CDN cache first
- ingress rate limiting

---

## 7.2 Internal Traffic
Service ↔ Service trong cluster

### Rules
- internal-only service discovery
- mTLS later
- short timeout
- retry budget enforced

---

## 7.3 Data Plane Traffic
Service ↔ DB / Cache / Queue

### Rules
- private network only
- least privilege
- no public DB access

---

# 8. Environment Configuration Strategy

## Config Layers
1. default config
2. env config
3. runtime overrides

## Rules
- config typed
- config validated on boot
- no hidden envs
- fail fast on invalid config

---

# 9. Secrets Management

Secrets gồm:
- DB credentials
- JWT secrets
- API keys
- provider credentials
- webhook secrets

## Rules
- không commit secrets
- secret rotation supported
- secrets inject runtime only
- access scoped per service

---

# 10. Storage Topology

## PostgreSQL
- managed primary
- read replicas
- PITR backups

## Redis
- primary + replica
- persistence enabled

## Object Storage
- raw files
- exports
- backups
- archive

## OpenSearch
- search cluster
- hot/warm retention

---

# 11. Scaling Blueprint

## Horizontal Scale
Dùng cho:
- web
- api
- workers

## Vertical Scale
Dùng cho:
- DB
- OpenSearch

## Autoscaling Signals
- CPU
- memory
- queue lag
- request latency

### Rules
- workers scale by queue lag
- API scale by latency / CPU
- DB scale conservative

---

# 12. Deployment Strategy

## Rules
- build once
- promote artifact
- immutable image
- no manual patching

## Strategy
- rolling deploy
- zero-downtime
- health checks required
- auto rollback on failure

---

# 13. CI/CD Infrastructure Flow

1. build image
2. run tests
3. push artifact
4. deploy dev
5. promote staging
6. promote prod

### Rules
- same artifact promoted
- no rebuild per env

---

# 14. Observability Blueprint

## Must Have
- centralized logs
- metrics
- traces
- dashboards
- alerts

## Stack
- OpenTelemetry
- Prometheus
- Grafana
- Loki
- Sentry

### Rules
- request tracing end-to-end
- queue lag monitored
- error budget tracked
- business metrics tracked

---

# 15. Reliability Blueprint

## Must Have
- retries
- circuit breakers
- timeouts
- DLQ
- health probes

## Rules
- graceful degradation
- stale cache serving
- fallback providers
- worker replay safe

---

# 16. Backup & Disaster Recovery

## Backups
- DB daily snapshots
- PITR enabled
- object storage versioning
- config backup

## DR Rules
- restore tested
- RPO defined
- RTO defined
- documented runbooks

---

# 17. Security Blueprint

## Must Have
- TLS
- RBAC
- network policies
- WAF later
- audit logs
- encryption at rest
- encryption in transit

---

# 18. Cost Control Blueprint

## Cost Controls
- autoscaling guardrails
- aggressive caching
- cold storage archive
- staging right-sized
- AI quota controls
- log retention caps

---

# 19. Ownership Model

Infra ownership phải rõ:
- app team owns app deploy
- platform owns shared infra
- security owns policies
- SRE / platform owns observability

---

# 20. Final Thesis

Infrastructure Blueprint là lớp biến architecture thành hệ thống chạy được ngoài đời thật.

Nó đảm bảo:

- local → prod nhất quán
- deploy ổn định
- scale có kiểm soát
- secrets an toàn
- ops quan sát được
- reliability đủ tốt để monetization

Đây là runtime foundation bắt buộc trước khi implementation.