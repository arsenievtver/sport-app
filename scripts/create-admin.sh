#!/usr/bin/env bash
# Create admin (superuser) — not available via public API.
# Usage: ./scripts/create-admin.sh <phone> <pin> <display_name> [--coach] [--athlete]
# Example: ./scripts/create-admin.sh 79106492742 123456 "Иван" --coach --athlete
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_DIR="$ROOT/infra/prod"

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
  # shellcheck source=lib/docker-admin.sh
  source "$SCRIPT_DIR/lib/docker-admin.sh"
  docker_admin_python "$ROOT/scripts/create_admin.py" "${PY_ARGS[@]}"
}

if [ -f "$PROD_DIR/.env" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx sport-app-api; then
  echo "[sport-app] Creating admin via prod API container..."
  run_docker
else
  echo "[sport-app] Creating admin locally..."
  run_local
fi
