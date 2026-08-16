# 🚀 Hướng Dẫn Vận Hành Kiến Trúc Kubernetes (K3s) & Helm Chart — Stock Intelligence SaaS

Tài liệu này được biên soạn theo chuẩn vận hành SRE / DevOps Doanh nghiệp (Enterprise-Grade), hướng dẫn toàn diện từ việc thiết lập cluster K3s, triển khai ứng dụng qua Helm Chart, quản lý vòng đời phát hành (Release Lifecycle), bảo mật Zero-Trust cho đến sao lưu & phục hồi thảm họa.

---

## 1. 🏗️ Sơ đồ Kiến trúc Hạ tầng (Architecture Topology)

```mermaid
graph TD
    Client[Internet Clients] -->|HTTPS:443 / WSS| Ingress[K3s Ingress / Traefik Controller]
    CertMgr[Cert-Manager] -->|Let's Encrypt Auto SSL| Ingress

    subgraph K3s_Production_Cluster [K3s Production Cluster - Namespace: stock-prod]
        subgraph Helm_PreUpgrade_Hook [1. Lifecycle Database Migration]
            PrismaJob[Prisma Migration Job: prisma migrate deploy]
        end

        subgraph Stateless_Workloads [2. Stateless Services Layer]
            Web[Next.js Web Frontend: 2 Replicas + PDB + HPA]
            API[NestJS Backend API: 2 Replicas + PDB + HPA]
        end

        subgraph Async_Worker_Layer [3. Async BullMQ Workers Layer]
            W_Ingestion[Worker Ingestion: 1 Replica]
            W_Processing[Worker Processing: 2 Replicas]
            W_AI[Worker AI: 1 Replica]
            W_Payment[Worker Payment: 1 Replica]
        end

        subgraph Stateful_Data_Layer [4. Stateful Storage Layer: local-path PVCs]
            TimescaleDB[(PostgreSQL 17 + TimescaleDB: 25GB PVC)]
            Redis[(Redis 7 BullMQ & Cache: 5GB PVC)]
            MinIO[(MinIO Object Storage: 15GB PVC)]
        end

        subgraph Security_Control [5. Zero-Trust Network Policies]
            NP_Ingress[Allow Ingress -> Web/API]
            NP_WebAPI[Allow Web SSR -> API]
            NP_DataPlane[Allow API/Workers -> DB & Redis & MinIO]
            NP_DenyDirect[Deny Direct Outside Access to DB/Redis]
        end
    end

    Ingress -->|Route / | Web
    Ingress -->|Route /api/v1 & /socket.io | API
    PrismaJob -->|Migrate Schema| TimescaleDB
    API & W_Ingestion & W_Processing & W_AI & W_Payment --> TimescaleDB
    API & W_Ingestion & W_Processing & W_AI & W_Payment --> Redis
    API & W_AI --> MinIO
```

---

## 2. ⚙️ Bảng Phân Bổ Tài Nguyên Sản Xuất (Production Resource Sizing)

Được tối ưu đặc biệt cho các máy chủ Production có tài nguyên vừa và nhỏ (ví dụ VPS 4GB – 8GB RAM):

| Workload                   | Replicas | CPU Request / Limit | Memory Request / Limit | QoS Class | Ghi chú vận hành                                     |
| :------------------------- | :------: | :------------------ | :--------------------- | :-------- | :--------------------------------------------------- |
| **Web (Next.js)**          |    2     | `100m` / `600m`     | `200Mi` / `400Mi`      | Burstable | Phục vụ SSR & Static assets                          |
| **API (NestJS)**           |    2     | `200m` / `1000m`    | `256Mi` / `600Mi`      | Burstable | Core REST API, WebSocket real-time quotes            |
| **Worker Ingestion**       |    1     | `50m` / `300m`      | `128Mi` / `256Mi`      | Burstable | Lấy dữ liệu giá chứng khoán (I/O-bound)              |
| **Worker Processing**      |    2     | `150m` / `1000m`    | `256Mi` / `768Mi`      | Burstable | Tính toán chỉ báo kỹ thuật RSI, MACD, MA (CPU-bound) |
| **Worker AI**              |    1     | `100m` / `500m`     | `180Mi` / `384Mi`      | Burstable | Giao tiếp OpenAI/Litellm phân tích cổ phiếu          |
| **Worker Payment**         |    1     | `50m` / `300m`      | `128Mi` / `256Mi`      | Burstable | Xác thực webhook PayOS / Sepay                       |
| **TimescaleDB (PG17)**     |    1     | `200m` / `1500m`    | `512Mi` / `1536Mi`     | Burstable | Lưu trữ quan hệ & dữ liệu chuỗi thời gian nến giá    |
| **Redis 7**                |    1     | `50m` / `400m`      | `128Mi` / `384Mi`      | Burstable | Hàng đợi BullMQ + Cache (Maxmemory 256MB LRU)        |
| **MinIO**                  |    1     | `50m` / `300m`      | `128Mi` / `256Mi`      | Burstable | Lưu trữ PDF báo cáo AI và avatar                     |
| **K3s Control Plane + OS** |    -     | `200m` / -          | ~`600Mi`               | -         | K3s Core, Containerd, Flannel CNI, Traefik           |

> [!IMPORTANT]
> Để chống treo máy chủ (Kernel OOM Freeze) khi tải đột biến, script cài đặt K3s tự động kích hoạt **4GB Swap Space** và tinh chỉnh `vm.swappiness=10` cùng ngưỡng `eviction-hard=memory.available<250Mi`.

---

## 3. 🐙 Quy Trình Triển Khai GitOps với Standalone ArgoCD

Nếu bạn sử dụng **ArgoCD Server độc lập**, toàn bộ quá trình phát hành Production sẽ chạy tự động 100% qua GitOps:

### Bước 1: Chuẩn bị Cluster K3s & Tạo Secret An Toàn (Chỉ làm 1 lần)

1. Chạy script bootstrap K3s trên máy chủ Production:
   ```bash
   sudo bash gitops/bootstrap/install-k3s.sh
   sudo bash gitops/bootstrap/setup-argocd-cluster.sh
   ```
2. Tạo Secret `stock-intel-production-secrets` trực tiếp trên K3s để ArgoCD không cần chứa raw secrets:

   ```bash
   kubectl create namespace stock-prod --dry-run=client -o yaml | kubectl apply -f -

   kubectl create secret generic stock-intel-production-secrets \
     --from-literal=DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@stock-intel-postgres:5432/stockintel?schema=public" \
     --from-literal=REDIS_PASSWORD="YOUR_REDIS_PASSWORD" \
     --from-literal=JWT_SECRET="YOUR_JWT_SECRET_AT_LEAST_32_CHARACTERS" \
     --from-literal=OPENAI_API_KEY="sk-proj-..." \
     --from-literal=MARKET_DATA_API_KEY="your-key" \
     --from-literal=PAYOS_WEBHOOK_SECRET="your-payos-secret" \
     --from-literal=SEPAY_WEBHOOK_SECRET="your-sepay-secret" \
     -n stock-prod
   ```

### Bước 2: Thêm Cụm K3s vào Standalone ArgoCD Server

Trên máy chủ **ArgoCD**:

```bash
# 1. Đăng nhập ArgoCD CLI
argocd login <ARGOCD_SERVER_IP> --username admin --password <ARGOCD_ADMIN_PASSWORD>

# 2. Add cụm K3s Production
argocd cluster add <K3S_CONTEXT_NAME> --name k3s-production
```

### Bước 3: Đăng Ký ArgoCD Application

Trên máy chủ **ArgoCD**:

```bash
kubectl apply -f gitops/argocd/application-prod.yaml -n argocd
```

### Bước 4: Vận Hành Phát Hành Tự Động (Day-to-Day GitOps)

Khi Developer push code lên `main`:

1. **GitHub Actions**: Tự động test, build Docker images, tag với `sha-${{ github.sha }}` và push lên Docker Hub.
2. **GitOps Write-back**: Workflow tự động cập nhật `global.image.tag` trong `gitops/envs/prod/values.yaml` và commit lên Git (`[skip ci]`).
3. **ArgoCD Sync**: ArgoCD phát hiện commit mới, chạy Prisma Migration PreSync hook, và thực hiện Rolling Update Zero-Downtime lên K3s.

---

## 4. 🚀 Hướng Dẫn Triển Khai Thủ Công Bằng Helm (Nếu Không Dùng ArgoCD)

---

## 4. 🔄 Quản lý Vòng đời & Vận hành (Day-2 Operations)

### Kiểm tra Trạng thái Rollout

```bash
kubectl get all -n stock-prod
kubectl get ingress -n stock-prod
kubectl get certificates -n stock-prod
```

### Xem Lịch sử Phát hành (Release History)

```bash
helm history stock-intel -n stock-prod
```

### Rollback Tức thì khi Có Sự Cố

Nếu phát hiện bản build mới gặp lỗi logic sau khi deploy, rollback về phiên bản trước đó:

```bash
# Rollback về revision 2
helm rollback stock-intel 2 -n stock-prod
```

### Xem Logs Thời gian Thực

```bash
# Xem log API
kubectl logs -n stock-prod -l app.kubernetes.io/component=api -f --tail=100

# Xem log Worker Processing
kubectl logs -n stock-prod -l app.kubernetes.io/component=worker-processing -f --tail=100

# Xem log Worker AI
kubectl logs -n stock-prod -l app.kubernetes.io/component=worker-ai -f --tail=100
```

---

## 5. 💾 Kế hoạch Sao Lưu & Khôi Phục Dữ Liệu (Backup & Disaster Recovery)

### Sao lưu TimescaleDB thủ công

```bash
kubectl exec -it -n stock-prod stock-intel-postgres-0 -- pg_dump -U postgres stockintel > backup_$(date +%F_%H%M%S).sql
```

### Khôi phục TimescaleDB từ file backup

```bash
cat backup_2026-08-15_120000.sql | kubectl exec -i -n stock-prod stock-intel-postgres-0 -- psql -U postgres -d stockintel
```

### Sao lưu Redis RDB

```bash
kubectl exec -it -n stock-prod stock-intel-redis-0 -- redis-cli bgsave
kubectl cp stock-prod/stock-intel-redis-0:/data/dump.rdb ./redis_dump_$(date +%F).rdb
```

---

## 6. 🛠️ Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 1. Pod bị `CrashLoopBackOff` hoặc `OOMKilled`

- **Triệu chứng:** `kubectl get pods -n stock-prod` hiển thị pod restart nhiều lần hoặc trạng thái `OOMKilled`.
- **Cách xử lý:**
  1. Kiểm tra nguyên nhân: `kubectl describe pod <pod-name> -n stock-prod`.
  2. Xem log trước khi crash: `kubectl logs <pod-name> -n stock-prod --previous`.
  3. Tăng `memory.limits` trong `values-prod.yaml` và chạy `helm upgrade`.

### 2. Migration Job bị treo (`Pending` hoặc `Error`)

- **Triệu chứng:** Lệnh `helm upgrade` bị timeout ở bước Pre-Upgrade Hook.
- **Cách xử lý:**
  1. Kiểm tra log migration: `kubectl logs job/stock-intel-migration-<revision> -n stock-prod`.
  2. Đảm bảo Pod PostgreSQL đang `Running` và `DATABASE_URL` trong secrets chính xác.

### 3. Ingress không nhận được chứng chỉ SSL HTTPS

- **Triệu chứng:** Truy cập web báo lỗi "Certificate Not Secure".
- **Cách xử lý:**
  1. Kiểm tra trạng thái Certificate: `kubectl describe certificate stock-intel-production-tls -n stock-prod`.
  2. Kiểm tra log Challenge: `kubectl get challenges -n stock-prod` và `kubectl describe challenge <challenge-name> -n stock-prod`.
  3. Đảm bảo tên miền DNS (A Record) đã trỏ đúng vào địa chỉ Public IP của máy chủ K3s.
