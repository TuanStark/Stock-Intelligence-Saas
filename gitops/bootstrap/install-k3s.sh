#!/usr/bin/env bash
# ==============================================================================
# Production K3s Installation & Tuning Script for Resource-Constrained Nodes
# ==============================================================================
set -euo pipefail

echo "==> 1. Checking root privileges..."
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (or with sudo)." 
   exit 1
fi

echo "==> 2. Setting up 4GB Swap Space (Critical for low-RAM production nodes to prevent kernel OOM freezes)..."
if ! swapon --show | grep -q "/swapfile"; then
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  echo "Swapfile created and activated successfully."
else
  echo "Swapfile is already active."
fi

# Kernel memory tuning
sysctl -w vm.swappiness=10
sysctl -w vm.vfs_cache_pressure=50
cat <<EOF > /etc/sysctl.d/99-k3s-memory.conf
vm.swappiness = 10
vm.vfs_cache_pressure = 50
net.core.somaxconn = 32768
net.ipv4.ip_forward = 1
EOF
sysctl --system > /dev/null

echo "==> 3. Configuring firewall rules (UFW / iptables)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp comment 'SSH' || true
  ufw allow 80/tcp comment 'HTTP Web/Ingress' || true
  ufw allow 443/tcp comment 'HTTPS Web/Ingress' || true
  ufw allow 6443/tcp comment 'K3s API Server' || true
  echo "UFW rules updated."
fi

echo "==> 4. Preparing K3s Server Configuration Directory..."
mkdir -p /etc/rancher/k3s
cat <<EOF > /etc/rancher/k3s/config.yaml
# Production K3s Server Configuration
write-kubeconfig-mode: "0644"
tls-san:
  - "chungkhoanai.dpdns.org"

# Kubelet Eviction Guardrails (Prevent sudden Node OOM crashes)
kubelet-arg:
  - "eviction-hard=memory.available<250Mi,nodefs.available<10%,nodefs.inodesFree<5%"
  - "eviction-soft=memory.available<500Mi"
  - "eviction-soft-grace-period=memory.available=1m"
  - "max-pods=110"

# K3s components configuration
# Traefik is kept as the default lightweight ingress controller
# To disable Traefik and use ingress-nginx instead, uncomment below:
# disable:
#   - traefik
EOF

echo "==> 5. Installing K3s..."
curl -sfL https://get.k3s.io | sh -

echo "==> 6. Verifying K3s installation..."
systemctl enable k3s
systemctl restart k3s
sleep 5

echo "==> 7. Checking node status..."
k3s kubectl get nodes -o wide

echo "==> 8. Setting up kubeconfig for current user..."
mkdir -p "$HOME/.kube"
cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
chmod 600 "$HOME/.kube/config"

echo "=============================================================================="
echo "✅ K3s Production Node installed and tuned successfully!"
echo "   Kubeconfig path: $HOME/.kube/config"
echo "   Next steps: Install cert-manager and deploy Helm chart:"
echo "   $ kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.0/cert-manager.yaml"
echo "   $ kubectl apply -f gitops/bootstrap/cert-manager-cluster-issuer.yaml"
echo "   $ helm upgrade --install stock-intel ./gitops/chart -f ./gitops/envs/prod/values.yaml -n stock-prod --create-namespace"
echo "=============================================================================="
