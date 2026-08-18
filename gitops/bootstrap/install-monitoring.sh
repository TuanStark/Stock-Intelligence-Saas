#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# install-monitoring.sh — Cài đặt Monitoring Stack cho K3s Production
#
# Chạy script này MỘT LẦN trên K3s server để bootstrap.
# Sau đó ArgoCD (application-monitoring.yaml) quản lý lifecycle.
#
# Usage: ./gitops/bootstrap/install-monitoring.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

PROMETHEUS_VERSION="61.3.2"
LOKI_VERSION="2.10.2"
NAMESPACE="monitoring"

echo "📊 Installing Monitoring Stack for Stock Intelligence K3s..."
echo "   Prometheus: v${PROMETHEUS_VERSION}"
echo "   Loki:       v${LOKI_VERSION}"
echo ""

# 1. Add Helm repos
echo "⬇️  Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
echo "✅ Helm repos updated"

# 2. Tạo namespace monitoring với PSS labels
echo ""
echo "🏗️  Creating monitoring namespace..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/warn: restricted
    app.kubernetes.io/managed-by: Helm
EOF
echo "✅ Namespace ${NAMESPACE} created"

# 3. Cài kube-prometheus-stack
echo ""
echo "🔭 Installing kube-prometheus-stack..."
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace "${NAMESPACE}" \
  --version "${PROMETHEUS_VERSION}" \
  -f gitops/monitoring/values-prometheus.yaml \
  --timeout 15m \
  --wait \
  --atomic
echo "✅ kube-prometheus-stack installed"

# 4. Cài Loki Stack
echo ""
echo "📋 Installing Loki Stack..."
helm upgrade --install loki grafana/loki-stack \
  --namespace "${NAMESPACE}" \
  --version "${LOKI_VERSION}" \
  -f gitops/monitoring/values-loki.yaml \
  --timeout 10m \
  --wait \
  --atomic
echo "✅ Loki Stack installed"

# 5. Apply custom Alert Rules
echo ""
echo "🔔 Applying custom alert rules..."
kubectl apply -f gitops/monitoring/alertmanager-rules.yaml
echo "✅ Alert rules applied"

# 6. Verify installation
echo ""
echo "🔍 Verifying installation..."
kubectl get pods -n "${NAMESPACE}"

# 7. Print next steps
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Monitoring Stack installed successfully!"
echo ""
echo "📌 NEXT STEPS:"
echo ""
echo "1. Access Grafana (port-forward):"
echo "   kubectl port-forward -n ${NAMESPACE} svc/monitoring-grafana 3001:80"
echo "   URL: http://localhost:3001 | User: admin"
echo "   Password: $(kubectl get secret -n ${NAMESPACE} monitoring-grafana -o jsonpath='{.data.admin-password}' | base64 -d 2>/dev/null || echo 'Run: kubectl get secret -n monitoring monitoring-grafana -o jsonpath={.data.admin-password} | base64 -d')"
echo ""
echo "2. Access Prometheus (port-forward):"
echo "   kubectl port-forward -n ${NAMESPACE} svc/monitoring-kube-prometheus-prometheus 9090:9090"
echo "   URL: http://localhost:9090"
echo ""
echo "3. Access Alertmanager (port-forward):"
echo "   kubectl port-forward -n ${NAMESPACE} svc/monitoring-kube-prometheus-alertmanager 9093:9093"
echo ""
echo "4. Cấu hình Telegram bot cho Alertmanager:"
echo "   Xem: gitops/monitoring/README-alerting.md"
echo "════════════════════════════════════════════════════════════════"
