#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

case "${1:-}" in
  start)
    exec "$SCRIPT_DIR/start.sh" "${@:2}"
    ;;
  stop)
    exec "$SCRIPT_DIR/stop.sh" "${@:2}"
    ;;
  up)
    check_docker
    docker compose -f "$COMPOSE_FILE" up -d
    log "Waiting for Postgres..."
    wait_for_postgres 45 && ok "Postgres ready"
    ;;
  down)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  migrate)
    ensure_backend_venv
    cd "$ROOT/backend"
    alembic upgrade head
    ok "Migrations applied"
    ;;
  revision)
    ensure_backend_venv
    cd "$ROOT/backend"
    alembic revision --autogenerate -m "${2:-auto}"
    ;;
  api)
    ensure_backend_venv
    LAN_IP=$(get_lan_ip)
    export DEBUG=true
    export CORS_ALLOW_ORIGIN_REGEX="$CORS_ALLOW_ORIGIN_REGEX"
    cd "$ROOT/backend"
    ok "API → http://localhost:${PORT_API}  |  http://${LAN_IP}:${PORT_API}"
    exec uvicorn app.main:app --reload --host 0.0.0.0 --port "$PORT_API"
    ;;
  phone-check)
    exec "$SCRIPT_DIR/phone-check.sh"
    ;;
  certs)
    exec "$SCRIPT_DIR/certs.sh"
    ;;
  status)
    LAN_IP=$(get_lan_ip)
    SCHEME=$(dev_url_scheme)
    echo "LAN IP: ${LAN_IP}"
    echo "Scheme: ${SCHEME}"
    echo ""
    for entry in "api:${PORT_API}" "athlete:${PORT_ATHLETE}" "coach:${PORT_COACH}" "coach-web:${PORT_COACH_WEB}" "admin:${PORT_ADMIN}"; do
      name="${entry%%:*}"
      port="${entry##*:}"
      if lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1; then
        if [ "$name" = "api" ]; then
          echo -e "  ${C_GREEN}●${C_RESET} ${name} (:${port}) — http://${LAN_IP}:${port}"
        else
          echo -e "  ${C_GREEN}●${C_RESET} ${name} (:${port}) — ${SCHEME}://${LAN_IP}:${port}"
        fi
      else
        echo -e "  ${C_RED}○${C_RESET} ${name} (:${port}) — stopped"
      fi
    done
    ;;
  *)
    cat <<EOF
Usage: $0 <command>

Commands:
  start              Start everything (Docker + migrate + API + frontends)
  stop [--docker]    Stop dev servers, free ports
  status             Show what's running + LAN URLs
  phone-check        Why phone can't open Athlete URL + checklist
  certs              Generate / refresh dev HTTPS certs
  up                 Docker compose up only
  down               Docker compose down
  migrate            Run alembic upgrade head
  revision <msg>     Create new migration
  api                Start API only (0.0.0.0)

Shortcuts:
  ./scripts/start.sh
  ./scripts/stop.sh
EOF
    exit 1
    ;;
esac
