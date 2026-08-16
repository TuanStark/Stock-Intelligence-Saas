#!/usr/bin/env bash
# ==============================================================================
# Helper Script: Setup Remote K3s Cluster Access for Standalone ArgoCD Server
# ==============================================================================
set -euo pipefail

echo "==> 1. Creating Namespace and ServiceAccount for ArgoCD Manager on K3s..."
kubectl create namespace kube-system --dry-run=client -o yaml | kubectl apply -f -

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: argocd-manager
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: argocd-manager-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: argocd-manager
    namespace: kube-system
---
apiVersion: v1
kind: Secret
metadata:
  name: argocd-manager-token
  namespace: kube-system
  annotations:
    kubernetes.io/service-account.name: argocd-manager
type: kubernetes.io/service-account-token
EOF

echo "==> 2. Extracting Cluster Credentials..."
SECRET_NAME="argocd-manager-token"
TOKEN=$(kubectl get secret "$SECRET_NAME" -n kube-system -o jsonpath='{.data.token}' | base64 --decode)
CA_CERT_B64=$(kubectl get secret "$SECRET_NAME" -n kube-system -o jsonpath='{.data.ca\.crt}')
PUBLIC_IP=$(curl -s https://ifconfig.me || hostname -I | awk '{print $1}')
K3S_PORT="6443"

# Generate standalone secret file that can be applied directly on the ArgoCD server
cat <<EOF > /tmp/argocd-k3s-cluster-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cluster-k3s-production
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
type: Opaque
stringData:
  name: k3s-production
  server: https://${PUBLIC_IP}:${K3S_PORT}
  config: |
    {
      "bearerToken": "${TOKEN}",
      "tlsClientConfig": {
        "insecure": false,
        "caData": "${CA_CERT_B64}"
      }
    }
EOF

echo "=============================================================================="
echo "✅ ArgoCD Manager ServiceAccount & Token created on K3s Production!"
echo ""
echo "🖥️  CÁCH KẾT NỐI TỪ MÁY CHỦ ARGOCD RIÊNG BIỆT (STANDALONE ARGOCD SERVER):"
echo ""
echo "👉 CÁCH 1 (Nhanh nhất - Không cần cài CLI):"
echo "   Copy nội dung file /tmp/argocd-k3s-cluster-secret.yaml dưới đây sang máy chủ ArgoCD:"
echo "   ---"
cat /tmp/argocd-k3s-cluster-secret.yaml
echo "   ---"
echo "   Sau đó trên máy chủ ArgoCD chạy:"
echo "   $ kubectl apply -f argocd-k3s-cluster-secret.yaml -n argocd"
echo ""
echo "👉 CÁCH 2 (Dùng ArgoCD CLI trên máy chủ ArgoCD):"
echo "   1. Copy file kubeconfig /etc/rancher/k3s/k3s.yaml sang máy chủ ArgoCD"
echo "   2. Sửa 127.0.0.1 thành ${PUBLIC_IP}"
echo "   3. Chạy lệnh: argocd cluster add default --name k3s-production --server https://${PUBLIC_IP}:${K3S_PORT}"
echo ""
echo "🚀 BƯỚC TIẾP THEO TRÊN MÁY CHỦ ARGOCD:"
echo "   Tạo Application trên máy chủ ArgoCD:"
echo "   $ kubectl apply -f gitops/argocd/application-prod.yaml -n argocd"
echo "=============================================================================="
