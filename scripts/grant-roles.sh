#!/usr/bin/env bash
# Grant coach/athlete roles to an existing user by phone.
# Usage: ./scripts/grant-roles.sh 79106492742 "Иван" --coach
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_DIR="$ROOT/infra/prod"
COMPOSE=(docker compose -f "$PROD_DIR/docker-compose.yml")

if [ $# -lt 2 ]; then
  echo "Usage: $0 <phone> <display_name> [--coach] [--athlete]" >&2
  exit 1
fi

PHONE=$1
NAME=$2
shift 2
EXTRA_ARGS=("$@")
PY_ARGS=("$PHONE" "$NAME" "${EXTRA_ARGS[@]}")

run_local() {
  # shellcheck source=lib/common.sh
  source "$SCRIPT_DIR/lib/common.sh"
  ensure_backend_venv
  (cd "$ROOT/backend" && exec "$ROOT/backend/.venv/bin/python" "$ROOT/scripts/grant-roles.py" "${PY_ARGS[@]}")
}

run_docker() {
  if docker exec sport-app-api test -f /scripts/grant-roles.py >/dev/null 2>&1; then
    "${COMPOSE[@]}" exec -T --entrypoint python api /scripts/grant-roles.py "${PY_ARGS[@]}"
    return
  fi

  "${COMPOSE[@]}" run --rm -T --no-deps \
    --entrypoint python \
    -v "$ROOT/scripts:/scripts:ro" \
    api /scripts/grant-roles.py "${PY_ARGS[@]}"
}

if [ -f "$PROD_DIR/.env" ] && "${COMPOSE[@]}" ps api 2>/dev/null | grep -q "Up"; then
  echo "[sport-app] Granting roles via prod API container..."
  run_docker
else
  echo "[sport-app] Granting roles locally..."
  run_local
fi
