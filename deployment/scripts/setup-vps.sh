#!/bin/bash
# ==============================================================================
# SCRIPT DE APROVISIONAMIENTO Y HARDENING DEL VPS (UBUNTU 24.04 LTS)
# CONTABO CLOUD VPS - 89.117.73.97
# ==============================================================================
set -euo pipefail

echo "========================================================="
echo "   [1/5] ACTUALIZANDO SISTEMA Y DEPENDENCIAS BASE"
echo "========================================================="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    htop \
    git \
    unzip \
    jq \
    certbot \
    python3-certbot-nginx

echo "========================================================="
echo "   [2/5] CONFIGURANDO FIREWALL UFW (HARDENING)"
echo "========================================================="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Abrir puertos seguros requeridos
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Let Encrypt / Nginx)'
ufw allow 443/tcp comment 'HTTPS (Nginx Reverse Proxy)'

# Habilitar UFW
echo "y" | ufw enable
ufw status verbose

echo "========================================================="
echo "   [3/5] INSTALANDO DOCKER ENGINE & DOCKER COMPOSE V2"
echo "========================================================="
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
    apt-get remove -y $pkg 2>/dev/null || true
done

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

echo "Docker Version: $(docker --version)"
echo "Docker Compose Version: $(docker compose version)"

echo "========================================================="
echo "   [4/5] OPTIMIZANDO KERNEL SYSCTL PARA ALTA CONCURRENCIA"
echo "========================================================="
cat << 'SYSCTL_EOF' > /etc/sysctl.d/99-custom-network.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
fs.file-max = 2097152
vm.max_map_count = 262144
SYSCTL_EOF

sysctl --system

echo "========================================================="
echo "   [5/5] CREANDO ESTRUCTURA DE DIRECTORIOS MODULAR"
echo "========================================================="
mkdir -p /opt/evolution/instances
mkdir -p /opt/redis/data
mkdir -p /opt/app/logs
mkdir -p /opt/nginx/conf.d
mkdir -p /opt/nginx/ssl
mkdir -p /opt/nginx/certbot-challenge

# Crear red Docker interna compartida para aislamiento de microservicios
docker network inspect internal-network >/dev/null 2>&1 || docker network create internal-network

echo "========================================================="
echo "   ✅ CONFIGURACIÓN BASE Y DOCKER COMPLETADOS EXITOSAMENTE"
echo "========================================================="
