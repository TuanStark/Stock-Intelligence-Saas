# 📘 Sách Trắng Kiến Trúc DevSecOps, Kubernetes (K3s), GitOps & FinOps Chuẩn Doanh Nghiệp

> **Tác giả:** Senior / Principal DevSecOps & Platform Architect  
> **Dự án:** Stock Intelligence SaaS Platform  
> **Mục tiêu:** Cẩm nang đúc kết toàn diện các nguyên lý kiến trúc thực chiến, bảo mật đa tầng, tự động hóa GitOps và tối ưu hóa chi phí (FinOps) vận hành hệ thống phần mềm quy mô thực tế.

---

## 📑 MỤC LỤC

1. [Triết Lý Kiến Trúc & Vận Hành Thực Chiến](#1-triết-lý-kiến-trúc--vận-hành-thực-chiến)
2. [Thiết Kế Kubernetes (K3s) Trên Hạ Tầng Hạn Chế Tài Nguyên](#2-thiết-kế-kubernetes-k3s-trên-hạ-tầng-hạn-chế-tài-nguyên)
3. [Nghệ Thuật Đóng Gói Helm Chart Đa Môi Trường](#3-nghệ-thuật-đóng-gói-helm-chart-đa-môi-trường)
4. [Kiến Trúc GitOps với Standalone ArgoCD (2-Server Pattern)](#4-kiến-trúc-gitops-với-standalone-argocd-2-server-pattern)
5. [Tối Ưu Chi Phí & Tốc Độ CI/CD (FinOps & 8 Cổng DevSecOps)](#5-tối-ưu-chi-phí--tốc-độ-cicd-finops--8-cổng-devsecops)
6. [Quản Trị Bí Mật (Secrets Management) An Toàn Trong GitOps](#6-quản-trị-bí-mật-secrets-management-an-toàn-trong-gitops)
7. [Sổ Tay SRE: Khắc Phục Sự Cố & Vận Hành Khẩn Cấp (Runbook)](#7-sổ-tay-sre-khắc-phục-sự-cố--vận-hành-khẩn-cấp-runbook)

---

## 1. TRIẾT LÝ KIẾN TRÚC & VẬN HÀNH THỰC CHIẾN

Sau 20 năm thực chiến xây dựng và vận hành các hệ thống phân tán, 5 nguyên lý bất biến định hình nên một hạ tầng phần mềm thành công:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           5 NGUYÊN LÝ BẤT BIẾN                           │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. Git là Nguồn Chân Lý Duy Nhất (Single Source of Truth)                │
│    Không bao giờ can thiệp thủ công (No ClickOps / No SSH Ad-hoc).       │
│                                                                          │
│ 2. Shift-Left Security (Bảo Mật Từ Đầu)                                  │
│    Chi phí vá lỗi ở khâu Code/PR rẻ hơn 100 lần so với vá trên Prod.    │
│                                                                          │
│ 3. Assume Failure (Luôn Chuẩn Bị Cho Sự Cố)                              │
│    Pod sẽ crash, node sẽ reboot, mạng sẽ đứt -> Thiết kế tự phục hồi.     │
│                                                                          │
│ 4. Zero-Downtime & Graceful Degradation                                  │
│    Deploy không bao giờ làm gián đoạn người dùng; DB migrate trước code. │
│                                                                          │
│ 5. FinOps by Design (Tối Ưu Chi Phí Ngay Từ Thiết Kế)                    │
│    Tối ưu từng phút chạy CI, từng MB RAM trên máy chủ.                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. THIẾT KẾ KUBERNETES (K3S) TRÊN HẠ TẦNG HẠN CHẾ TÀI NGUYÊN

### 2.1. Tại sao chọn K3s thay vì Vanilla Kubernetes?

- **Tiết kiệm tài nguyên:** K3s thay thế `etcd` bằng SQLite/kine nhúng, lược bỏ các cloud provider driver dư thừa, giảm RAM của control plane từ ~2GB xuống chỉ còn **~500MB – 600MB**.
- **Tích hợp sẵn (Batteries-Included):** Tích hợp sẵn `Traefik Ingress Controller`, `local-path-provisioner` (dynamic PVC storage), `CoreDNS`, và `Metrics-Server`.

### 2.2. Kỹ Thuật Chống Treo Máy Chủ (Kernel OOM Freeze Prevention)

Trên các máy chủ VPS (4GB – 8GB RAM), khi RAM bị chạm ngưỡng 100%, Linux Kernel sẽ kích hoạt OOM-Killer hoặc rơi vào trạng thái swap thrashing gây treo cứng server. Để khắc phục triệt để:

1. **Kích hoạt 4GB Swap Space + Tinh chỉnh Swappiness:**
   ```bash
   # Giảm độ ưu tiên dùng swap xuống 10 (chỉ dùng khi thực sự cấp bách)
   sysctl -w vm.swappiness=10
   sysctl -w vm.vfs_cache_pressure=50
   ```
2. **Kubelet Eviction Guardrails (Cấu hình K3s Server):**
   ```yaml
   # /etc/rancher/k3s/config.yaml
   kubelet-arg:
     - "eviction-hard=memory.available<250Mi,nodefs.available<10%,nodefs.inodesFree<5%"
     - "eviction-soft=memory.available<500Mi"
     - "eviction-soft-grace-period=memory.available=1m"
     - "max-pods=110"
   ```
   _Cơ chế:_ Khi RAM khả dụng dưới 250MB, Kubernetes chủ động Evict (tắt) pod có độ ưu tiên thấp nhất theo chuẩn `QoS Class Burstable` thay vì để Linux Kernel crash toàn bộ máy chủ.

### 2.3. Ma Trận Phân Bổ Tài Nguyên (Resource Sizing Matrix)

| Thành phần             | CPU Request/Limit | Memory Request/Limit | QoS Class | Vai trò kỹ thuật                                     |
| :--------------------- | :---------------- | :------------------- | :-------- | :--------------------------------------------------- |
| **Web (Next.js)**      | `100m` / `600m`   | `200Mi` / `400Mi`    | Burstable | Server-Side Rendering (SSR) & Static HTML            |
| **API (NestJS)**       | `200m` / `1000m`  | `256Mi` / `600Mi`    | Burstable | REST API, WebSocket real-time stock quotes           |
| **Worker Ingestion**   | `50m` / `300m`    | `128Mi` / `256Mi`    | Burstable | Thu thập giá thị trường qua API (I/O bound)          |
| **Worker Processing**  | `150m` / `1000m`  | `256Mi` / `768Mi`    | Burstable | Tính toán chỉ báo kỹ thuật RSI, MACD, MA (CPU bound) |
| **Worker AI**          | `100m` / `500m`   | `180Mi` / `384Mi`    | Burstable | Prompt Engineering & tổng hợp báo cáo LLM            |
| **Worker Payment**     | `50m` / `300m`    | `128Mi` / `256Mi`    | Burstable | Webhook Verify PayOS & Sepay                         |
| **TimescaleDB (PG17)** | `200m` / `1500m`  | `512Mi` / `1536Mi`   | Burstable | CSDL quan hệ + Chuỗi thời gian nến giá               |
| **Redis 7**            | `50m` / `400m`    | `128Mi` / `384Mi`    | Burstable | Hàng đợi BullMQ + Bộ nhớ đệm (LRU Policy)            |
| **MinIO**              | `50m` / `300m`    | `128Mi` / `256Mi`    | Burstable | Lưu trữ đối tượng S3 (PDF báo cáo, avatar)           |

### 2.4. Zero-Downtime Deployment & Graceful Shutdown

1. **Lắng nghe tín hiệu SIGTERM:** Container không bị kill đột ngột.
2. **`preStop` Hook (10s delay):**
   ```yaml
   lifecycle:
     preStop:
       exec:
         command: ["/bin/sh", "-c", "sleep 10"]
   ```
   _Tác dụng:_ Khi pod chuẩn bị tắt, nó tạm dừng 10 giây để Ingress Controller gỡ IP của nó ra khỏi Endpoint pool, tránh tình trạng user gửi request trúng pod đang tắt gây lỗi 502/504.
3. **`terminationGracePeriodSeconds: 40-60s`:** Cho phép các background job đang xử lý dở dang (BullMQ jobs, Webhook payments) hoàn tất trước khi bị force kill.
4. **Bộ 3 Probes:**
   - `startupProbe`: Cho pod thời gian khởi động (đặc biệt là NestJS boot module hoặc Next.js compile).
   - `readinessProbe`: Chỉ chuyển traffic sang pod khi đã kết nối thành công tới Database & Redis.
   - `livenessProbe`: Tự động restart pod nếu bị deadlock / memory leak.

---

## 3. NGHỆ THUẬT ĐÓNG GÓI HELM CHART ĐA MÔI TRƯỜNG

Toàn bộ manifests được quản lý duy nhất tại thư mục `infra/k8s/`:

```
infra/k8s/
├── Chart.yaml                     # Metadata Chart API v2
├── values.yaml                    # Base values mặc định
├── values-dev.yaml                # Môi trường Dev (Tiết kiệm tối đa)
├── values-staging.yaml            # Môi trường Staging (Giống prod)
├── values-prod.yaml               # Môi trường Production (Multi-replicas, PDB, HPA)
├── values-prod-secrets.example.yaml # Template secrets
├── templates/
│   ├── _helpers.tpl               # Helper naming & labeling chuẩn
│   ├── hooks/
│   │   └── migration-job.yaml     # Helm Pre-Upgrade Hook chạy Prisma Migration
│   ├── apps/                      # Web, API, 4 Workers (Deployment, Service, PDB, HPA)
│   ├── stateful/                  # TimescaleDB, Redis, MinIO (StatefulSets + local-path PVCs)
│   ├── ingress.yaml               # Routing + Traefik/Nginx + Cert-Manager SSL
│   └── networkpolicies.yaml       # Zero-Trust Network Segmentation
└── bootstrap/                     # Scripts khởi tạo ban đầu (install-k3s, setup-argocd)
```

---

## 4. KIẾN TRÚC GITOPS VỚI STANDALONE ARGOCD (2-SERVER PATTERN)

### 4.1. Mô Hình Phân Tách 2 Máy Chủ (Control Plane vs Workload Plane)

- **Server A (ArgoCD Server):** Chuyên trách làm Control Plane, giám sát Git repo, so sánh trạng thái mong muốn (Desired State) với trạng thái thực tế (Live State).
- **Server B (K3s Production Server):** Chuyên chạy Workloads, không cần cài đặt ArgoCD để tiết kiệm RAM. Chỉ mở port API `6443/tcp` cho Server A truy cập.

```mermaid
graph LR
    subgraph Git_Repository [GitHub Repository]
        Git[Git Commits: infra/k8s]
    end

    subgraph Server_A [Server A: Standalone ArgoCD]
        Engine[ArgoCD Sync Engine]
    end

    subgraph Server_B [Server B: K3s Production Node]
        K3s[K3s API :6443]
        Pods[Pods: Web, API, Workers, DB, Redis]
    end

    Git -->|Polls every 3m| Engine
    Engine -->|HTTPS :6443 / RBAC Token| K3s
    K3s -->|Rolling Update Zero-Downtime| Pods
```

### 4.2. Khai Báo ArgoCD Application Chuẩn Doanh Nghiệp

File `infra/k8s/argocd/application-prod.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: stock-intel-production
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: "https://github.com/TuanStark/Stock-Intelligence-Saas.git"
    targetRevision: main
    path: infra/k8s
    helm:
      valueFiles:
        - values-prod.yaml
  destination:
    name: k3s-production
    namespace: stock-prod
  syncPolicy:
    automated:
      prune: true # Xóa các resource không còn khai báo trên Git
      selfHeal: true # Tự động ghi đè nếu có ai sửa pod thủ công
    syncOptions:
      - CreateNamespace=true
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### 4.3. Helm PreSync Hook (Prisma Migration Lifecycle)

Trong `templates/hooks/migration-job.yaml`:

```yaml
annotations:
  "helm.sh/hook": "pre-install,pre-upgrade"
  "helm.sh/hook-weight": "-5"
  "helm.sh/hook-delete-policy": "before-hook-creation,hook-succeeded"
```

_Cơ chế:_ Khi ArgoCD đồng bộ bản mới, nó sẽ chạy Job `prisma migrate deploy` trước tiên. **Chỉ khi Job hoàn thành thành công (Exit Code 0)**, ArgoCD mới tiến hành cập nhật image cho các Pod API/Workers. Điều này loại bỏ hoàn toàn lỗi 500 do lệch schema database giữa code mới và DB cũ.

---

## 5. TỐI ƯU CHI PHÍ & TỐC ĐỘ CI/CD (FINOPS & 8 CỔNG DEVSECOPS)

### 5.1. Bài Toán Chi Phí & Năng Suất (FinOps Metrics)

- **Chi phí điện toán (Compute Cost):** GitHub tính tiền theo số phút chạy của Runner. Giảm thời gian CI từ 15 phút xuống 2.5 phút giúp cắt giảm **80% chi phí hóa đơn CI**.
- **Chi phí cơ hội (Developer Velocity):** Giảm thời gian chờ đợi giúp lập trình viên không bị ngắt mạch tư duy (context switching).

### 5.2. 5 Vũ Khí Kỹ Thuật Tối Ưu Chi Phí Đột Phá

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   5 VŨ KHÍ TỐI ƯU HÓA CHI PHÍ CI/CD                      │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. cancel-in-progress: true                                              │
│    Tự động hủy ngay runner của commit cũ khi dev push commit mới         │
│    -> Tiết kiệm 30% - 40% chi phí runner rác.                            │
│                                                                          │
│ 2. paths-ignore                                                          │
│    Bỏ qua 100% việc chạy CI khi chỉ sửa file *.md, docs/, .gitignore     │
│    -> Tiết kiệm 10% - 15% tổng số lần trigger.                           │
│                                                                          │
│ 3. Multi-tier Caching                                                    │
│    - PNPM Cache + --prefer-offline: Cài thư viện trong 8s thay vì 180s.  │
│    - Turborepo Cache (.turbo): Trả về kết quả sau 0.05s cho file không đổi│
│    - Docker Buildx GHA Cache: Build Docker < 1 phút nhờ layer cache.     │
│                                                                          │
│ 4. Parallel Execution & Fail-Fast                                        │
│    Tầng 1 (Lint, Types, SAST, SCA, Unit Test) chạy đồng loạt trong 45s.  │
│    Nếu có lỗi cú pháp hoặc lộ API Key -> Dừng ngay lập tức, không tốn    │
│    tiền chạy các bước nặng đằng sau.                                     │
│                                                                          │
│ 5. Ephemeral In-Memory Test DB/Redis                                     │
│    Khởi tạo PostgreSQL 17 và Redis 7 dạng RAM service container trong    │
│    runner để test E2E thực tế mà không cần thuê server test tốn kém.     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3. 8 Cổng Kiểm Soát DevSecOps Toàn Diện (`.github/workflows/ci.yml`)

```mermaid
graph TD
    PR[Pull Request Event] --> Parallel_Stage

    subgraph Parallel_Stage [Stage 1: Chạy Song Song - Hoàn tất trong 45s]
        Gate1["1 & 2. 🔍 Lint, Format, Types, Helm Lint"]
        Gate5["5. 🛡️ SAST (Semgrep) & Secret Scan (Gitleaks)"]
        Gate6["6. 📦 Dependency Vulnerability Scan (Trivy SCA)"]
        Gate3["3. 🧪 Unit Tests (Jest + Turbo Cache)"]
    end

    Parallel_Stage --> Gate4["4. 🔗 Integration & E2E Tests (RAM Postgres/Redis)"]
    Gate4 --> Gate7_8["7 & 8. 🐳 Docker Buildx Test & Image Scan (Trivy)"]
    Gate7_8 --> Gateway["🎯 All DevSecOps Gates Passed -> Merge to Main"]
```

---

## 6. QUẢN TRỊ BÍ MẬT (SECRETS MANAGEMENT) AN TOÀN TRONG GITOPS

### 6.1. Nguyên Tắc Vàng

> **"Không bao giờ commit mật khẩu, Private Key, JWT Secret hoặc API Key thô lên Git repository, kể cả là repo private."**

### 6.2. Pattern `ExistingSecret`

1. Trên cụm K3s Production, tạo Secret một lần duy nhất:

   ```bash
   kubectl create namespace stock-prod --dry-run=client -o yaml | kubectl apply -f -

   kubectl create secret generic stock-intel-production-secrets \
     --from-literal=DATABASE_URL="postgresql://postgres:PASSWORD@stock-intel-postgres:5432/stockintel?schema=public" \
     --from-literal=REDIS_PASSWORD="PASSWORD" \
     --from-literal=JWT_SECRET="YOUR_JWT_SECRET_32_CHARS" \
     --from-literal=OPENAI_API_KEY="sk-proj-..." \
     --from-literal=MARKET_DATA_API_KEY="KEY" \
     --from-literal=PAYOS_WEBHOOK_SECRET="SECRET" \
     --from-literal=SEPAY_WEBHOOK_SECRET="SECRET" \
     -n stock-prod
   ```

2. Trong `infra/k8s/values-prod.yaml`:
   ```yaml
   secrets:
     existingSecret: "stock-intel-production-secrets"
   ```
3. ArgoCD và Git chỉ quản lý manifest cấu hình hạ tầng, ứng dụng sẽ tự động mount secret trực tiếp từ cụm K3s tại thời điểm runtime.

---

## 7. SỔ TAY SRE: KHẮC PHỤC SỰ CỐ & VẬN HÀNH KHẨN CẤP (RUNBOOK)

### 7.1. Bảng Tra Cứu Xử Lý Sự Cố Nhanh

| Hiện tượng                            | Nguyên nhân gốc rễ (Root Cause)                          | Lệnh chẩn đoán & Cách xử lý                                                                                                                                   |
| :------------------------------------ | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pod bị `OOMKilled`**                | RAM tiêu thụ vượt quá `resources.limits.memory`          | `kubectl describe pod <pod-name> -n stock-prod`<br>$\rightarrow$ Tăng `memory.limits` trong `values-prod.yaml` và commit Git.                                 |
| **Pod bị `CrashLoopBackOff`**         | Lỗi runtime (kết nối DB thất bại, thiếu biến môi trường) | `kubectl logs <pod-name> -n stock-prod --previous`<br>$\rightarrow$ Kiểm tra log khởi động để fix bug hoặc bổ sung env.                                       |
| **Migration Job bị Timeout**          | PostgreSQL chưa sẵn sàng hoặc connection string sai      | `kubectl logs job/stock-intel-migration-<rev> -n stock-prod`<br>$\rightarrow$ Kiểm tra trạng thái pod `postgres` và `DATABASE_URL`.                           |
| **SSL Certificate chưa cấp phát**     | DNS chưa trỏ đúng IP hoặc cert-manager bị rate-limit     | `kubectl describe certificate stock-intel-production-tls -n stock-prod`<br>`kubectl describe challenge -n stock-prod`<br>$\rightarrow$ Kiểm tra A-Record DNS. |
| **ArgoCD báo trạng thái `OutOfSync`** | Có ai đó chỉnh sửa pod thủ công bằng lệnh `kubectl edit` | Trên giao diện ArgoCD bấm **Sync** (hoặc `selfHeal: true` sẽ tự động ghi đè về trạng thái Git).                                                               |

### 7.2. Lệnh Khôi Phục Khẩn Cấp (Emergency Rollback)

Nếu bản build mới gặp lỗi logic nghiêm trọng sau khi deploy:

1. **Cách 1 (Chuẩn GitOps):**
   ```bash
   # Revert commit trên Git -> ArgoCD tự động rollback
   git revert HEAD
   git push origin main
   ```
2. **Cách 2 (Trực tiếp qua ArgoCD CLI nếu cần khẩn cấp tức thì):**
   ```bash
   argocd app rollback stock-intel-production <PREVIOUS_REVISION_ID>
   ```

### 7.3. Sao Lưu & Phục Hồi Dữ Liệu Thảm Họa (Disaster Recovery)

```bash
# 1. Backup PostgreSQL TimescaleDB
kubectl exec -it -n stock-prod stock-intel-postgres-0 -- pg_dump -U postgres stockintel > backup_$(date +%F).sql

# 2. Restore PostgreSQL TimescaleDB
cat backup_2026-08-15.sql | kubectl exec -i -n stock-prod stock-intel-postgres-0 -- psql -U postgres -d stockintel

# 3. Backup Redis Snapshot
kubectl exec -it -n stock-prod stock-intel-redis-0 -- redis-cli bgsave
kubectl cp stock-prod/stock-intel-redis-0:/data/dump.rdb ./redis_backup.rdb
```

---

> 💡 **Lời Kết:** Tài liệu này là kim chỉ nam giúp toàn bộ đội ngũ Kỹ sư, DevOps và SRE duy trì một tiêu chuẩn kỹ thuật đẳng cấp quốc tế: **Hệ thống chạy mượt mà, bảo mật tuyệt đối, triển khai tự động, và chi phí vận hành luôn ở mức tối ưu nhất.**
