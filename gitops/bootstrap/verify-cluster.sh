#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# verify-cluster.sh — Pre-flight checks trước khi đưa traffic thật
# Chạy script này sau khi deploy production để xác nhận mọi thứ hoạt động
# ════════════════════════════════════════════════════════════════════════
set -uo pipefail

NAMESPACE="stock-prod"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  ✅ $desc"
    ((PASS++))
  else
    echo "  ❌ $desc"
    ((FAIL++))
  fi
}

echo "════════════════════════════════════════════════════════════════"
echo "🔍 Stock Intelligence Production Cluster Verification"
echo "   Namespace: $NAMESPACE"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "▶ 1. Pod Health"
check "API pods Running (min 2)" \
  "[ $(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=api --field-selector=status.phase=Running --no-headers | wc -l) -ge 2 ]"
check "Web pods Running (min 2)" \
  "[ $(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/component=web --field-selector=status.phase=Running --no-headers | wc -l) -ge 2 ]"
check "PostgreSQL Running" \
  "kubectl get pod -n $NAMESPACE -l app.kubernetes.io/component=postgres --field-selector=status.phase=Running --no-headers | grep -q Running"
check "Redis Running" \
  "kubectl get pod -n $NAMESPACE -l app.kubernetes.io/component=redis --field-selector=status.phase=Running --no-headers | grep -q Running"
check "MinIO Running" \
  "kubectl get pod -n $NAMESPACE -l app.kubernetes.io/component=minio --field-selector=status.phase=Running --no-headers | grep -q Running"

echo ""
echo "▶ 2. Metrics & HPA"
check "metrics-server có thể thu thập node metrics" \
  "kubectl top nodes"
check "metrics-server có thể thu thập pod metrics" \
  "kubectl top pods -n $NAMESPACE"
check "HPA api hoạt động" \
  "kubectl get hpa -n $NAMESPACE stock-intel-api-hpa"
check "HPA web hoạt động" \
  "kubectl get hpa -n $NAMESPACE stock-intel-web-hpa"

echo ""
echo "▶ 3. NetworkPolicy"
check "NetworkPolicy enabled" \
  "kubectl get networkpolicies -n $NAMESPACE | grep -q default-deny-all"
check "Số NetworkPolicy >= 10" \
  "[ $(kubectl get networkpolicies -n $NAMESPACE --no-headers | wc -l) -ge 10 ]"

echo ""
echo "▶ 4. Backup"
check "Backup CronJob tồn tại" \
  "kubectl get cronjob -n $NAMESPACE | grep -q pg-backup"

echo ""
echo "▶ 5. TLS & Ingress"
check "TLS certificate issued" \
  "kubectl get secret -n $NAMESPACE stock-intel-production-tls"
check "Ingress tồn tại" \
  "kubectl get ingress -n $NAMESPACE | grep -q stock-intel"

echo ""
echo "▶ 6. Monitoring"
check "Prometheus running" \
  "kubectl get pods -n monitoring -l app.kubernetes.io/name=prometheus --field-selector=status.phase=Running --no-headers | grep -q Running"
check "Grafana running" \
  "kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana --field-selector=status.phase=Running --no-headers | grep -q Running"
check "Loki running" \
  "kubectl get pods -n monitoring -l app=loki --field-selector=status.phase=Running --no-headers | grep -q Running"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 KQKT: $PASS passed | $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "🎉 Cluster sẵn sàng nhận traffic production!"
else
  echo "⚠️  Có $FAIL check thất bại — cần xem lại trước khi go-live"
fi
echo "════════════════════════════════════════════════════════════════"
