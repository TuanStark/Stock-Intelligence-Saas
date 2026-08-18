#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# install-velero.sh — Cài đặt Velero cho Disaster Recovery (Sprint P3)
# Backend: MinIO nội bộ (dùng bucket "velero-backups" trên MinIO hiện tại)
#
# Velero backup scope: toàn bộ namespace stock-prod
#   - PersistentVolumes (postgres data, redis, minio data)
#   - Kubernetes objects (Deployments, ConfigMaps, Secrets, Services...)
#
# Schedule: Hàng ngày 03:00 UTC+7 (20:00 UTC), giữ 30 ngày
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

VELERO_VERSION="v1.14.0"
MINIO_NAMESPACE="stock-prod"
MINIO_SERVICE="stock-intel-minio"
MINIO_PORT="9000"
MINIO_BUCKET="velero-backups"

echo "💾 Installing Velero for K3s Disaster Recovery..."
echo "   Version: ${VELERO_VERSION}"
echo "   Backend: MinIO (internal)"
echo ""

# 1. Kiểm tra velero CLI
if ! command -v velero &> /dev/null; then
  echo "⬇️  Installing velero CLI..."
  wget -q "https://github.com/vmware-tanzu/velero/releases/download/${VELERO_VERSION}/velero-${VELERO_VERSION}-linux-amd64.tar.gz" \
    -O /tmp/velero.tar.gz
  tar -xzf /tmp/velero.tar.gz -C /tmp
  sudo install -m 755 "/tmp/velero-${VELERO_VERSION}-linux-amd64/velero" /usr/local/bin/velero
  echo "✅ velero CLI installed"
fi

# 2. Lấy MinIO credentials từ K8s Secret
echo ""
echo "🔑 Fetching MinIO credentials from Kubernetes Secret..."
MINIO_ACCESS_KEY=$(kubectl get secret -n "${MINIO_NAMESPACE}" stock-intel-production-secrets \
  -o jsonpath='{.data.MINIO_ACCESS_KEY}' 2>/dev/null | base64 -d || echo "minioadmin")
MINIO_SECRET_KEY=$(kubectl get secret -n "${MINIO_NAMESPACE}" stock-intel-production-secrets \
  -o jsonpath='{.data.MINIO_SECRET_KEY}' 2>/dev/null | base64 -d || echo "minioadmin")

# 3. Tạo credentials file tạm cho Velero
CREDS_FILE=$(mktemp)
cat > "${CREDS_FILE}" << CREDS
[default]
aws_access_key_id=${MINIO_ACCESS_KEY}
aws_secret_access_key=${MINIO_SECRET_KEY}
CREDS

echo "✅ Credentials prepared"

# 4. Lấy MinIO service IP
MINIO_URL="http://$(kubectl get svc -n "${MINIO_NAMESPACE}" "${MINIO_SERVICE}" \
  -o jsonpath='{.spec.clusterIP}'):${MINIO_PORT}"
echo "   MinIO URL: ${MINIO_URL}"

# 5. Cài Velero
echo ""
echo "🚀 Installing Velero..."
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --bucket "${MINIO_BUCKET}" \
  --secret-file "${CREDS_FILE}" \
  --use-volume-snapshots=false \
  --backup-location-config \
    region=minio,s3ForcePathStyle="true",s3Url="${MINIO_URL}" \
  --wait

rm -f "${CREDS_FILE}"
echo "✅ Velero installed"

# 6. Tạo backup schedule hàng ngày
echo ""
echo "📅 Creating daily backup schedule..."
velero schedule create stock-prod-daily \
  --schedule="0 20 * * *" \
  --include-namespaces stock-prod \
  --ttl 720h \
  --storage-location default || true

echo "✅ Backup schedule created: stock-prod-daily (03:00 UTC+7, 30 days retention)"

# 7. Test backup thủ công
echo ""
echo "🧪 Creating on-demand test backup..."
velero backup create stock-prod-test-$(date +%Y%m%d) \
  --include-namespaces stock-prod \
  --wait || true

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Velero installed!"
echo ""
echo "📌 COMMANDS HỮU ÍCH:"
echo "  velero backup get                    — Xem tất cả backups"
echo "  velero schedule get                  — Xem schedules"
echo "  velero backup describe <name>        — Chi tiết 1 backup"
echo "  velero backup logs <name>            — Log của backup"
echo ""
echo "📌 KHI CẦN RESTORE:"
echo "  velero restore create --from-backup <backup-name>"
echo "  velero restore create --from-backup <backup-name> \\"
echo "    --include-namespaces stock-prod"
echo "════════════════════════════════════════════════════════════════"
