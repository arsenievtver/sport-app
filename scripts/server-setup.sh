#!/usr/bin/env bash
# One-time server bootstrap (Ubuntu 22.04/24.04). Run as root or with sudo.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/arsenievtver/sport-app.git}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/sport-app}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo $0"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable docker
systemctl start docker

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  git clone "$REPO_URL" "$DEPLOY_DIR"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_DIR"
fi

echo ""
echo "Server ready."
echo ""
echo "Next steps (as user ${DEPLOY_USER}):"
echo "  1. cd ${DEPLOY_DIR}"
echo "  2. cp infra/prod/.env.example infra/prod/.env && nano infra/prod/.env"
echo "  3. ./scripts/deploy.sh"
echo ""
echo "DNS (A records → this server IP):"
echo "  @  www  my  coach  app  admin"
echo ""
