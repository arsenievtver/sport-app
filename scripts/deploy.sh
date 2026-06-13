#!/usr/bin/env bash
# Deploy sport-app on the production server.
# Default: pull latest from GitHub (main) → build → start.
# Usage: ./scripts/deploy.sh [--no-pull]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROD_DIR="$ROOT/infra/prod"
DO_PULL=true

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=false ;;
    -h | --help)
      echo "Usage: $0 [--no-pull]"
      echo ""
      echo "  (default)  git fetch + reset origin/main, then build & start"
      echo "  --no-pull  skip git pull (deploy current checkout)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

if [ ! -f "$PROD_DIR/.env" ]; then
  err "Missing $PROD_DIR/.env — copy from .env.example and fill in values."
  exit 1
fi

if [ "$DO_PULL" = true ]; then
  if [ -d "$ROOT/.git" ]; then
    log "Pulling latest from GitHub (origin/main)..."
    git -C "$ROOT" fetch origin main
    git -C "$ROOT" reset --hard origin/main
    ok "Code updated"
  else
    warn "Not a git repo — skipping pull"
  fi
fi

# shellcheck disable=SC1091
set -a
source "$PROD_DIR/.env"
set +a

if [ -z "${DOMAIN:-}" ] || [ "$DOMAIN" = "change-me" ]; then
  err "Set DOMAIN in infra/prod/.env to your real domain."
  exit 1
fi

if [ -z "${SECRET_KEY:-}" ] || [ "$SECRET_KEY" = "change-me-generate-a-long-random-string" ]; then
  err "Set SECRET_KEY in infra/prod/.env (generate a random string)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  err "Docker not found. Run: sudo ./scripts/server-setup.sh"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  err "Docker is not running or user lacks permissions (add to docker group)."
  exit 1
fi

# Sync CORS regex with DOMAIN if still placeholder
if grep -q 'change-me' "$PROD_DIR/.env" 2>/dev/null; then
  warn "Check secrets and CORS_ALLOW_ORIGIN_REGEX in infra/prod/.env (DOMAIN=${DOMAIN})"
fi

log "Building frontend static files..."
cd "$PROD_DIR"
docker compose --profile build run --rm build-landing
docker compose --profile build run --rm build-athlete
docker compose --profile build run --rm build-coach
docker compose --profile build run --rm build-coach-web
docker compose --profile build run --rm build-admin

log "Building and starting services..."
docker compose up -d --build

log "Waiting for API..."
for i in $(seq 1 30); do
  if docker compose exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')" >/dev/null 2>&1; then
    ok "API healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    warn "API health check timed out — run: docker compose -f infra/prod/docker-compose.yml logs api"
  fi
done

echo ""
ok "Deploy complete"
echo ""
echo "  Landing:    https://${DOMAIN}"
echo "  Athlete:    https://my.${DOMAIN}"
echo "  Coach PWA:  https://coach.${DOMAIN}"
echo "  Coach Web:  https://coach-web.${DOMAIN}"
echo "  Admin:      https://admin.${DOMAIN}"
echo ""
echo "  Logs: cd infra/prod && docker compose logs -f"
echo ""
