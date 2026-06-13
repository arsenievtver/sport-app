#!/usr/bin/env bash
# Grant coach/athlete roles to an existing user by phone.
# Usage: ./scripts/grant-roles.sh 79106492742 "Иван" --coach
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_DIR="$ROOT/infra/prod"

if [ $# -lt 2 ]; then
  echo "Usage: $0 <phone> <display_name> [--coach] [--athlete]" >&2
  exit 1
fi

PHONE=$1
NAME=$2
shift 2
EXTRA_ARGS=("$@")

run_local() {
  # shellcheck source=lib/common.sh
  source "$SCRIPT_DIR/lib/common.sh"
  ensure_backend_venv
  (cd "$ROOT/backend" && exec "$ROOT/backend/.venv/bin/python" "$ROOT/scripts/grant-roles.py" "$PHONE" "$NAME" "${EXTRA_ARGS[@]}")
}

run_docker() {
  docker compose -f "$PROD_DIR/docker-compose.yml" exec -T \
    -v "$ROOT/scripts:/scripts:ro" \
    api python /scripts/grant-roles.py "$PHONE" "$NAME" "${EXTRA_ARGS[@]}"
}

if [ -f "$PROD_DIR/.env" ] && docker compose -f "$PROD_DIR/docker-compose.yml" ps api 2>/dev/null | grep -q "Up"; then
  echo "[sport-app] Granting roles via prod API container..."
  run_docker
else
  echo "[sport-app] Granting roles locally..."
  run_local
fi
