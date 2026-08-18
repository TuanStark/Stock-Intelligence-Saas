# 📣 Alertmanager → Telegram Setup Guide

Hướng dẫn cài đặt cảnh báo tự động qua Telegram cho Stock Intelligence SaaS monitoring stack.

## Kiến trúc

```
Prometheus → PrometheusRule triggers → Alertmanager → Webhook → telegram-bot → Telegram Group
```

## Bước 1 — Tạo Telegram Bot

1. Mở Telegram, nhắn tin với **@BotFather**
2. Gõ `/newbot` → đặt tên bot (VD: `StockIntelAlert Bot`)
3. Sao chép **BOT_TOKEN** (dạng `1234567890:ABCdef...`)

## Bước 2 — Lấy CHAT_ID

1. Tạo Telegram Group mới (VD: `🚨 Stock Intel Alerts`)
2. Thêm bot vừa tạo vào group
3. Thêm **@RawDataBot** vào group → xem JSON response để lấy `chat.id` (số âm, VD: `-1001234567890`)
4. Xóa @RawDataBot khỏi group sau khi lấy được ID

## Bước 3 — Tạo Kubernetes Secret (KHÔNG commit vào Git)

```bash
# Chạy trên K3s server hoặc máy có kubectl đã cấu hình:
kubectl create secret generic telegram-bot-secret \
  --namespace monitoring \
  --from-literal=TELEGRAM_ADMIN="-1001234567890" \  # CHAT_ID của group
  --from-literal=TELEGRAM_TOKEN="1234567890:ABCdef..."  # BOT_TOKEN
```

## Bước 4 — Deploy Telegram Bot

```bash
kubectl apply -f gitops/monitoring/alertmanager-telegram-bot.yaml -n monitoring

# Verify bot đang chạy:
kubectl get pods -n monitoring | grep telegram
kubectl logs -n monitoring -l app=telegram-bot-alertmanager
```

## Bước 5 — Verify Alertmanager Config

Alertmanager đã được cấu hình (trong `values-prometheus.yaml`) để gọi webhook vào:
- `http://telegram-bot-alertmanager.monitoring:8080/alert` (default alerts)
- `http://telegram-bot-alertmanager.monitoring:8080/alert/critical` (critical alerts)

```bash
# Test webhook thủ công:
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
# Mở http://localhost:9093 → Alerts tab → xem trạng thái
```

## Bước 6 — Test Alert End-to-End

```bash
# Tạo alert test (simulate pod crash):
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093 &

curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "namespace": "stock-prod"
    },
    "annotations": {
      "summary": "🧪 Test alert từ Stock Intelligence",
      "description": "Đây là alert test để verify Telegram integration"
    },
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }]'
```

→ Telegram group sẽ nhận được message trong vài giây.

## Bảng Alert Rules (15 rules đang active)

| Alert | Severity | Trigger |
|---|---|---|
| ApiHighErrorRate | critical | HTTP 5xx > 1% trong 2 phút |
| PodCrashLooping | critical | Pod restart > 3 lần / 15 phút |
| ContainerOOMKilled | critical | Container bị kill vì hết RAM |
| NodeDiskCritical | critical | Disk còn < 15% |
| BackupJobFailed | critical | pg-backup CronJob thất bại |
| PostgresPodDown | critical | Postgres pod không Running |
| RedisPodDown | critical | Redis pod không Running |
| PodNotReady | warning | Pod không Ready 5 phút |
| DeploymentReplicasMismatch | warning | Replica count mismatch |
| HighMemoryUsage | warning | Memory > 85% |
| NodeDiskWarning | warning | Disk còn < 25% |
| HighCPUSustained | warning | CPU > 90% trong 10 phút |
| PVCDiskUsageHigh | warning | PVC volume > 80% |
| BackupNotRunIn36h | warning | Không có backup 36h |
| HPAMaxReplicasReached | warning | HPA đạt maxReplicas |

## Troubleshooting

```bash
# Bot không nhận alert:
kubectl logs -n monitoring -l app=telegram-bot-alertmanager -f

# Alertmanager không gửi webhook:
kubectl logs -n monitoring -l alertmanager=monitoring -f

# Kiểm tra PrometheusRule đã load:
kubectl get prometheusrule -n monitoring
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# Mở http://localhost:9090/rules → tìm "stock-intel-alerts"
```
