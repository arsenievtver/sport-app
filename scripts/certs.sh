#!/usr/bin/env bash
# Generate dev TLS certs for localhost + current LAN IP (.dev/certs/).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

LAN_IP=$(get_lan_ip)
ensure_dev_certs "$LAN_IP"

if dev_certs_ready; then
  ok "Certs: ${DEV_CERT_DIR}/cert.pem"
  echo ""
  echo "  LAN IP in cert: ${LAN_IP}"
  echo "  Phone: install mkcert root CA once (see README → HTTPS)"
  if command -v mkcert >/dev/null 2>&1; then
    echo "  CA path: $(mkcert -CAROOT)/rootCA.pem"
  fi
else
  err "Could not generate certs — frontends will run on HTTP only"
  exit 1
fi
