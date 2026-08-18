#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# verify-metrics-server.sh — Kiểm tra metrics-server cho HPA
# K3s tích hợp sẵn metrics-server nhưng đôi khi cần kích hoạt thủ công
# ════════════════════════════════════════════════════════════════════════
set -uo pipefail

echo "🔍 Checking metrics-server status on K3s..."
echo ""

# 1. Kiểm tra pod metrics-server
echo "▶ 1. metrics-server Pod"
if kubectl get pods -n kube-system | grep -q "metrics-server"; then
  STATUS=$(kubectl get pods -n kube-system -l k8s-app=metrics-server -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Unknown")
  echo "  ✅ metrics-server found — status: ${STATUS}"
else
  echo "  ❌ metrics-server pod NOT found in kube-system"
  echo "     Fix: K3s thường bundle sẵn, thử khởi động lại K3s service:"
  echo "     sudo systemctl restart k3s"
fi

# 2. Test thu thập node metrics
echo ""
echo "▶ 2. Node Metrics"
if kubectl top nodes > /dev/null 2>&1; then
  echo "  ✅ kubectl top nodes works:"
  kubectl top nodes | sed 's/^/     /'
else
  echo "  ❌ kubectl top nodes FAILED"
  echo "     Nguyên nhân có thể: metrics-server không trust TLS của kubelet"
  echo "     Fix: Thêm flag vào K3s server config:"
  echo "     # /etc/rancher/k3s/config.yaml:"
  echo "     # kubelet-arg:"
  echo "     #   - 'authentication-token-webhook=true'"
  echo "     #   - 'authorization-mode=Webhook'"
fi

# 3. Test thu thập pod metrics
echo ""
echo "▶ 3. Pod Metrics (stock-prod)"
if kubectl top pods -n stock-prod > /dev/null 2>&1; then
  echo "  ✅ kubectl top pods -n stock-prod works:"
  kubectl top pods -n stock-prod | sed 's/^/     /'
else
  echo "  ❌ kubectl top pods -n stock-prod FAILED"
  echo "     HPA sẽ ở trạng thái 'unknown' và không tự scale được"
fi

# 4. Kiểm tra HPA status
echo ""
echo "▶ 4. HPA Status"
kubectl get hpa -n stock-prod 2>/dev/null | sed 's/^/  /' || echo "  ⚠️  Không có HPA nào trong namespace stock-prod"

# 5. Gợi ý nếu có vấn đề
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📌 Nếu metrics-server lỗi trên K3s, chạy:"
echo ""
echo "  # Kiểm tra logs:"
echo "  kubectl logs -n kube-system -l k8s-app=metrics-server"
echo ""
echo "  # K3s built-in metrics-server thường không cần cài thêm."
echo "  # Nếu vẫn lỗi, force reinstall:"
echo "  kubectl delete deployment -n kube-system metrics-server"
echo "  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
echo "════════════════════════════════════════════════════════════════"
