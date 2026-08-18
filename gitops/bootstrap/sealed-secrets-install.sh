#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
# sealed-secrets-install.sh — GitOps Secret Encryption với Bitnami Sealed Secrets
#
# Cho phép commit encrypted secrets vào Git một cách an toàn.
# Sealed Secrets Controller giải mã trên cluster, không cần plaintext trong repo.
#
# Usage: ./gitops/bootstrap/sealed-secrets-install.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

SEALED_SECRETS_VERSION="2.16.1"

echo "🔐 Installing Sealed Secrets Controller..."

# 1. Add Helm repo
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm repo update

# 2. Cài Sealed Secrets Controller trong kube-system
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  --version "${SEALED_SECRETS_VERSION}" \
  --set resources.requests.cpu=50m \
  --set resources.requests.memory=64Mi \
  --set resources.limits.cpu=200m \
  --set resources.limits.memory=128Mi \
  --wait

echo "✅ Sealed Secrets Controller installed"

# 3. Cài kubeseal CLI
echo ""
echo "⬇️  Installing kubeseal CLI..."
KUBESEAL_VERSION="0.27.1"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/amd64/')

wget -q "https://github.com/bitnami-labs/sealed-secrets/releases/download/v${KUBESEAL_VERSION}/kubeseal-${KUBESEAL_VERSION}-${OS}-${ARCH}.tar.gz" \
  -O /tmp/kubeseal.tar.gz
tar -xzf /tmp/kubeseal.tar.gz -C /tmp kubeseal
sudo install -m 755 /tmp/kubeseal /usr/local/bin/kubeseal
echo "✅ kubeseal $(kubeseal --version) installed"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Sealed Secrets ready!"
echo ""
echo "📌 CÁCH ENCRYPT PRODUCTION SECRETS:"
echo ""
echo "1. Fetch public key từ cluster (cần lưu lại để encrypt offline):"
echo "   kubeseal --fetch-cert --controller-name=sealed-secrets > gitops/envs/prod/sealed-secrets.pub"
echo ""
echo "2. Encrypt secrets từ values-secrets.yaml:"
echo "   kubectl create secret generic stock-intel-production-secrets \\"
echo "     --namespace stock-prod \\"
echo "     --from-literal=DATABASE_URL='postgresql://...' \\"
echo "     --from-literal=POSTGRES_PASSWORD='your-pass' \\"
echo "     --from-literal=MINIO_ROOT_PASSWORD='your-pass' \\"
echo "     --from-literal=NEXTAUTH_SECRET='your-secret' \\"
echo "     --from-literal=GOOGLE_CLIENT_ID='...' \\"
echo "     --from-literal=GOOGLE_CLIENT_SECRET='...' \\"
echo "     --from-literal=API_SIGN_SECRET='...' \\"
echo "     --from-literal=API_ENCRYPTION_KEY='...' \\"
echo "     --dry-run=client -o yaml | \\"
echo "   kubeseal --format yaml \\"
echo "     --cert gitops/envs/prod/sealed-secrets.pub \\"
echo "     > gitops/envs/prod/sealed-secret.yaml"
echo ""
echo "3. Commit file sealed-secret.yaml vào Git (an toàn vì đã encrypt RSA-4096)"
echo "   git add gitops/envs/prod/sealed-secret.yaml"
echo "   git commit -m 'feat: add sealed production secrets'"
echo ""
echo "4. Update ArgoCD application-prod.yaml để sync sealed-secret.yaml"
echo "════════════════════════════════════════════════════════════════"
