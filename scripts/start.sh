#!/usr/bin/env bash
set -euo pipefail

# Start full sport-app dev stack: Docker → migrations → API → all frontends.
# Usage: ./scripts/start.sh [--skip-docker] [--skip-migrate]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

SKIP_DOCKER=false
SKIP_MIGRATE=false

for arg in "$@"; do
  case "$arg" in
    --skip-docker) SKIP_DOCKER=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    -h | --help)
      echo "Usage: $0 [--skip-docker] [--skip-migrate]"
      echo ""
      echo "  --skip-docker   Skip docker compose up (infra already running)"
      echo "  --skip-migrate  Skip alembic upgrade head"
      exit 0
      ;;
    *)
      err "Unknown option: $arg"
      exit 1
      ;;
  esac
done

# Prevent double start
if [ -f "$PID_DIR/api.pid" ] && kill -0 "$(cat "$PID_DIR/api.pid")" 2>/dev/null; then
  warn "Dev stack seems already running. Run ./scripts/stop.sh first."
  LAN_IP=$(get_lan_ip)
  ensure_dev_certs "$LAN_IP" || true
  write_frontend_env "$LAN_IP"
  print_urls "$LAN_IP"
  exit 0
fi

ensure_dev_dirs
LAN_IP=$(get_lan_ip)
log "LAN IP: ${LAN_IP}"

# ── 1. Infrastructure ──────────────────────────────────────────────
if [ "$SKIP_DOCKER" = false ]; then
  ensure_docker_infra
else
  log "Skipping Docker (--skip-docker)"
fi

# ── 2. Backend setup ───────────────────────────────────────────────
ensure_backend_venv
ensure_backend_env
log "Database URL → localhost:${POSTGRES_HOST_PORT}/sport_app"

if [ "$SKIP_MIGRATE" = false ]; then
  log "Running database migrations..."
  (cd "$ROOT/backend" && alembic upgrade head)
  ok "Migrations applied"
else
  log "Skipping migrations (--skip-migrate)"
fi

ensure_dev_certs "$LAN_IP" || true
write_frontend_env "$LAN_IP"

# ── 3. Dev servers ─────────────────────────────────────────────────
ensure_pnpm

# Free ports if something stale is listening
for port in "${DEV_PORTS[@]}"; do
  kill_port "$port" >/dev/null 2>&1 || true
done

export DEBUG=true
export CORS_ALLOW_ORIGIN_REGEX="$CORS_ALLOW_ORIGIN_REGEX"

log "Starting API on 0.0.0.0:${PORT_API}..."
start_background api bash -c "
  cd '$ROOT/backend' &&
  export DEBUG=true &&
  export CORS_ALLOW_ORIGIN_REGEX='$CORS_ALLOW_ORIGIN_REGEX' &&
  exec '$ROOT/backend/.venv/bin/uvicorn' app.main:app --reload --host 0.0.0.0 --port ${PORT_API}
"

# Wait for services to boot
sleep 3
if ! curl -sf "http://127.0.0.1:${PORT_API}/api/v1/health" >/dev/null; then
  warn "API health check failed — see ${DEV_DIR}/logs/api.log"
else
  ok "API healthy"
fi

start_frontend() {
  local name=$1
  local filter=$2
  log "Starting ${name}..."
  start_background "$name" bash -c "
    cd '$ROOT' &&
    exec pnpm --filter '${filter}' dev
  "
}

start_frontend athlete  "@sport-app/athlete"
start_frontend coach    "@sport-app/coach"
start_frontend coach-web "@sport-app/coach-web"
start_frontend admin    "@sport-app/admin"

# Wait for Vite servers
sleep 4
SCHEME=$(dev_url_scheme)
CURL_VITE_OPTS=(-sf)
if [ "$SCHEME" = "https" ] && ! command -v mkcert >/dev/null 2>&1; then
  CURL_VITE_OPTS+=(-k)
fi
for entry in "athlete:${PORT_ATHLETE}" "coach:${PORT_COACH}" "coach-web:${PORT_COACH_WEB}" "admin:${PORT_ADMIN}"; do
  name="${entry%%:*}"
  port="${entry##*:}"
  if curl "${CURL_VITE_OPTS[@]}" "${SCHEME}://127.0.0.1:${port}" >/dev/null 2>&1; then
    ok "${name} ready on :${port} (${SCHEME})"
  else
    warn "${name} not responding yet — see ${DEV_DIR}/logs/${name}.log"
  fi
done

if is_lan_ip "$LAN_IP"; then
  verify_lan_http "$LAN_IP" "$PORT_ATHLETE" "Athlete PWA" || true
else
  warn "Could not detect Wi‑Fi IP — use ./scripts/stop.sh && ./scripts/start.sh on the same network as your phone"
fi

print_urls "$LAN_IP"
