#!/usr/bin/env bash
# Quick checklist: why phone can't open https://LAN:5173
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

LAN_IP=$(get_lan_ip)
SCHEME=$(dev_url_scheme)

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Phone access check"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "  Mac LAN IP:     ${LAN_IP}"
echo "  Scheme:         ${SCHEME}"
echo "  Athlete URL:    ${SCHEME}://${LAN_IP}:${PORT_ATHLETE}"
echo "  Coach URL:      ${SCHEME}://${LAN_IP}:${PORT_COACH}"
echo ""

if ! is_lan_ip "$LAN_IP"; then
  err "No Wi‑Fi IP detected. Connect Mac to Wi‑Fi and run: ./scripts/stop.sh && ./scripts/start.sh"
  exit 1
fi

# Is Vite running?
if ! lsof -ti "tcp:${PORT_ATHLETE}" -sTCP:LISTEN >/dev/null 2>&1; then
  err "Athlete dev server is not running on :${PORT_ATHLETE}"
  err "Run: ./scripts/start.sh"
  exit 1
fi

BIND=$(lsof -nP -iTCP:"${PORT_ATHLETE}" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $9}')
echo "  Port ${PORT_ATHLETE} bind: ${BIND}"
if [[ "$BIND" != *":${PORT_ATHLETE}" ]] || [[ "$BIND" == "127.0.0.1:"* ]]; then
  warn "Server listens on localhost only — phone will not connect."
  warn "Restart stack: ./scripts/stop.sh && ./scripts/start.sh"
else
  ok "Server accepts LAN connections (*:${PORT_ATHLETE})"
fi

CURL_OPTS=(-sf --connect-timeout 3)
if [ "$SCHEME" = "https" ] && ! command -v mkcert >/dev/null 2>&1; then
  CURL_OPTS+=(-k)
fi

if curl "${CURL_OPTS[@]}" "${SCHEME}://${LAN_IP}:${PORT_ATHLETE}/" >/dev/null; then
  ok "${SCHEME} OK from this Mac → ${SCHEME}://${LAN_IP}:${PORT_ATHLETE}"
else
  err "${SCHEME} failed from this Mac — restart: ./scripts/stop.sh && ./scripts/start.sh"
  exit 1
fi

# Bonjour (.local) — sometimes works when raw IP doesn't on iOS
LOCAL_NAME=$(scutil --get LocalHostName 2>/dev/null || hostname -s)
if [ -n "$LOCAL_NAME" ]; then
  echo ""
  echo "  Alternative (Bonjour): ${SCHEME}://${LOCAL_NAME}.local:${PORT_ATHLETE}"
fi

echo ""
echo "──────────────────────────────────────────────────────────"
echo "  On your PHONE — check these (most common fixes):"
echo "──────────────────────────────────────────────────────────"
echo ""
echo "  1. Same Wi‑Fi as Mac (not mobile data / 4G / 5G)"
echo "  2. Not guest Wi‑Fi — guest networks often block device-to-device"
echo "  3. Phone IP should be 192.168.1.x (Settings → Wi‑Fi → (i) on network)"
echo "     Mac is ${LAN_IP} — first three numbers must match"
echo "  4. Turn OFF VPN on phone and Mac"
if [ "$SCHEME" = "https" ]; then
  echo "  5. Use https:// (not http://) in Safari/Chrome"
  if command -v mkcert >/dev/null 2>&1; then
    echo "  6. Install mkcert root CA on phone once: $(mkcert -CAROOT)/rootCA.pem"
    echo "     (AirDrop to iPhone → Settings → Profile → Install)"
  else
    echo "  6. Accept self-signed cert warning in browser (or: brew install mkcert)"
  fi
  echo "  7. Mac must be awake (not sleeping with lid closed)"
else
  echo "  5. Use http:// (not https://) in Safari/Chrome"
  echo "  6. Mac must be awake (not sleeping with lid closed)"
fi
echo ""
echo "  Open exactly:"
echo "    ${SCHEME}://${LAN_IP}:${PORT_ATHLETE}"
echo ""
  echo "  If still fails → router may have «AP / client isolation»."
  echo "  Disable it in router settings, or connect phone via Mac hotspot."
  echo ""
  echo "  ERR_ADDRESS_UNREACHABLE = phone is NOT on the same network as Mac."
  echo "  Try: same Wi‑Fi (not guest), reboot router/Wi‑Fi, or Mac hotspot."
  echo ""
