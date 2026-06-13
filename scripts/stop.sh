#!/usr/bin/env bash
set -euo pipefail

# Stop sport-app dev stack and free dev ports.
# Usage: ./scripts/stop.sh [--docker]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

STOP_DOCKER=false

for arg in "$@"; do
  case "$arg" in
    --docker) STOP_DOCKER=true ;;
    -h | --help)
      echo "Usage: $0 [--docker]"
      echo ""
      echo "  --docker   Also stop Docker containers (Postgres, Redis, MinIO)"
      exit 0
      ;;
    *)
      err "Unknown option: $arg"
      exit 1
      ;;
  esac
done

log "Stopping dev processes..."

# 1. Graceful stop via PID files
stop_all_pids

# 2. Kill anything still listening on dev ports (uvicorn reload, orphaned vite, etc.)
freed=0
for port in "${DEV_PORTS[@]}"; do
  if lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    kill_port "$port" && freed=$((freed + 1))
  fi
done

# 3. Kill turbo/vite node processes spawned from this project (safety net)
if command -v pgrep >/dev/null 2>&1; then
  pgrep -f "$ROOT/apps/.*/vite" 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done || true
  pgrep -f "$ROOT/backend.*uvicorn" 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done || true
fi

cleanup_frontend_env
rm -rf "$PID_DIR"

if [ "$freed" -gt 0 ]; then
  ok "Freed ${freed} port(s)"
fi

if [ "$STOP_DOCKER" = true ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    log "Stopping Docker containers..."
    docker compose -f "$COMPOSE_FILE" down
    ok "Docker stopped"
  else
    warn "Docker not available — skipped"
  fi
fi

ok "Dev stack stopped. Ports ${DEV_PORTS[*]} are free."
