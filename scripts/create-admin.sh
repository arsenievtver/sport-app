#!/usr/bin/env bash
# Create admin (superuser) — not available via public API.
# Usage: ./scripts/create-admin.sh <phone> <pin> <display_name> [--coach] [--athlete]
# Example: ./scripts/create-admin.sh 79106492742 123456 "Иван" --coach --athlete
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_DIR="$ROOT/infra/prod"
COMPOSE=(docker compose -f "$PROD_DIR/docker-compose.yml")

if [ $# -lt 3 ]; then
  echo "Usage: $0 <phone> <pin> <display_name> [--coach] [--athlete]" >&2
  echo "Example: $0 79106492742 123456 \"Иван\" --coach --athlete" >&2
  exit 1
fi

PHONE=$1
PIN=$2
NAME=$3
shift 3
EXTRA_ARGS=("$@")
PY_ARGS=("$PHONE" "$PIN" "$NAME" "${EXTRA_ARGS[@]}")

run_local() {
  # shellcheck source=lib/common.sh
  source "$SCRIPT_DIR/lib/common.sh"
  ensure_backend_venv
  (cd "$ROOT/backend" && exec "$ROOT/backend/.venv/bin/python" "$ROOT/scripts/create_admin.py" "${PY_ARGS[@]}")
}

run_docker() {
  # One-off command in running API container (scripts mounted at /scripts).
  if docker exec sport-app-api test -f /scripts/create_admin.py >/dev/null 2>&1; then
    "${COMPOSE[@]}" exec -T --entrypoint python api /scripts/create_admin.py "${PY_ARGS[@]}"
    return
  fi

  # Fallback: ephemeral container, bypass API entrypoint (uvicorn).
  "${COMPOSE[@]}" run --rm -T --no-deps \
    --entrypoint python \
    -v "$ROOT/scripts:/scripts:ro" \
    api /scripts/create_admin.py "${PY_ARGS[@]}"
}

if [ -f "$PROD_DIR/.env" ] && "${COMPOSE[@]}" ps api 2>/dev/null | grep -q "Up"; then
  echo "[sport-app] Creating admin via prod API container..."
  run_docker
else
  echo "[sport-app] Creating admin locally..."
  run_local
fi
