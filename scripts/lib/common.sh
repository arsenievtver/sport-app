#!/usr/bin/env bash
# Shared helpers for sport-app dev scripts.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_DIR="$ROOT/.dev"
PID_DIR="$DEV_DIR/pids"
DEV_CERT_DIR="$DEV_DIR/certs"
RUNTIME_ENV="$DEV_DIR/runtime.env"
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"

# Dev server ports
PORT_API=8000
PORT_ATHLETE=5173
PORT_COACH=5174
PORT_COACH_WEB=5175
PORT_ADMIN=5176
POSTGRES_HOST_PORT=5433
DEV_PORTS=($PORT_API $PORT_ATHLETE $PORT_COACH $PORT_COACH_WEB $PORT_ADMIN)

# Private LAN origins for FastAPI CORS (phone / tablet on same Wi‑Fi)
CORS_ALLOW_ORIGIN_REGEX='^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$'

# Colors (disabled when not a tty)
if [ -t 1 ]; then
  C_GREEN='\033[0;32m'
  C_CYAN='\033[0;36m'
  C_YELLOW='\033[1;33m'
  C_RED='\033[1;31m'
  C_BOLD='\033[1m'
  C_RESET='\033[0m'
else
  C_GREEN='' C_CYAN='' C_YELLOW='' C_RED='' C_BOLD='' C_RESET=''
fi

log()  { echo -e "${C_CYAN}[sport-app]${C_RESET} $*"; }
ok()   { echo -e "${C_GREEN}[sport-app]${C_RESET} $*"; }
warn() { echo -e "${C_YELLOW}[sport-app]${C_RESET} $*"; }
err()  { echo -e "${C_RED}[sport-app]${C_RESET} $*" >&2; }

ensure_dev_dirs() {
  mkdir -p "$PID_DIR" "$DEV_DIR/logs"
}

get_lan_ip() {
  local ip="" iface="" candidate

  if [[ "$OSTYPE" == darwin* ]]; then
    iface=$(route -n get default 2>/dev/null | awk '/interface: / {print $2; exit}')
    # VPN often owns the default route (utun*) — phone needs Wi‑Fi/Ethernet IP (en*)
    if [[ "$iface" == utun* ]] || [[ "$iface" == ppp* ]]; then
      iface=""
    fi
    if [ -n "$iface" ]; then
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    fi
    if [ -z "$ip" ]; then
      for candidate in en0 en1 en2 en3 bridge0; do
        ip=$(ipconfig getifaddr "$candidate" 2>/dev/null || true)
        [ -n "$ip" ] && break
      done
    fi
    if [ -z "$ip" ]; then
      ip=$(ifconfig 2>/dev/null | awk '
        /inet / && $2 != "127.0.0.1" {
          split($2, a, ".")
          if (a[1] == 10 || (a[1] == 172 && a[2] >= 16 && a[2] <= 31) || (a[1] == 192 && a[2] == 168)) {
            print $2
            exit
          }
        }')
    fi
  fi

  if [ -z "$ip" ]; then
    ip=$(python3 - <<'PY' 2>/dev/null || true
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(("8.8.8.8", 80))
    print(s.getsockname()[0])
finally:
    s.close()
PY
)
    # Ignore public/VPN addresses — phone needs a private LAN IP
    if [[ -n "$ip" ]] && [[ ! "$ip" =~ ^192\.168\. ]] && [[ ! "$ip" =~ ^10\. ]] \
      && [[ ! "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
      ip=""
    fi
  fi

  echo "${ip:-127.0.0.1}"
}

is_lan_ip() {
  local ip=$1
  [[ "$ip" =~ ^192\.168\. ]] || [[ "$ip" =~ ^10\. ]] || [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]
}

dev_url_scheme() {
  if dev_certs_ready; then
    echo "https"
  else
    echo "http"
  fi
}

dev_certs_ready() {
  [ -f "$DEV_CERT_DIR/cert.pem" ] && [ -f "$DEV_CERT_DIR/key.pem" ] \
    && [ -f "$DEV_CERT_DIR/.mkcert" ]
}

ensure_dev_certs() {
  local lan_ip=$1
  local cert_file="$DEV_CERT_DIR/cert.pem"
  local key_file="$DEV_CERT_DIR/key.pem"
  local meta_file="$DEV_CERT_DIR/.meta"

  ensure_dev_dirs
  mkdir -p "$DEV_CERT_DIR"

  if [ -f "$cert_file" ] && [ -f "$key_file" ] && [ -f "$meta_file" ] \
    && [ -f "$DEV_CERT_DIR/.mkcert" ] \
    && grep -qx "LAN_IP=${lan_ip}" "$meta_file" 2>/dev/null; then
    return 0
  fi

  # Drop legacy self-signed certs — they break localhost in Chrome (chrome-error://chromewebdata/).
  rm -f "$cert_file" "$key_file" "$meta_file" "$DEV_CERT_DIR/.mkcert"

  if command -v mkcert >/dev/null 2>&1; then
    log "Generating HTTPS certs (mkcert) for localhost + ${lan_ip}..."
    mkcert -install >/dev/null 2>&1 || true
    if mkcert -cert-file "$cert_file" -key-file "$key_file" \
      localhost 127.0.0.1 ::1 "$lan_ip"; then
      echo "LAN_IP=${lan_ip}" >"$meta_file"
      echo "mkcert" >"$DEV_CERT_DIR/.mkcert"
      ok "HTTPS certs ready"
      return 0
    fi
    warn "mkcert failed"
  else
    warn "mkcert not found (brew install mkcert) — frontends will use HTTP"
  fi

  warn "HTTPS unavailable — frontends will use HTTP (install mkcert for PWA on phone)"
  rm -f "$cert_file" "$key_file" "$meta_file" "$DEV_CERT_DIR/.mkcert"
  return 1
}

verify_lan_http() {
  local lan_ip=$1 port=$2 label=$3
  local scheme
  scheme=$(dev_url_scheme)
  local curl_opts=(-sf --connect-timeout 3)
  if [ "$scheme" = "https" ] && ! command -v mkcert >/dev/null 2>&1; then
    curl_opts+=(-k)
  fi
  if ! is_lan_ip "$lan_ip"; then
    warn "LAN IP not found (${lan_ip}) — phone URLs below will not work."
    warn "Connect Mac to Wi‑Fi (same network as phone), then: ./scripts/stop.sh && ./scripts/start.sh"
    return 1
  fi
  if ! curl "${curl_opts[@]}" "${scheme}://${lan_ip}:${port}/" >/dev/null 2>&1; then
    warn "${label} not reachable at ${scheme}://${lan_ip}:${port} from this Mac."
    warn "If firewall is on: allow incoming for Node.js. Or restart: ./scripts/stop.sh && ./scripts/start.sh"
    return 1
  fi
  return 0
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
    pids=$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
    return 0
  fi
  return 1
}

kill_all_dev_ports() {
  local port freed=0
  for port in "${DEV_PORTS[@]}"; do
    if kill_port "$port"; then
      ok "Port ${port} freed"
      freed=$((freed + 1))
    fi
  done
  return 0
}

stop_pid_file() {
  local name=$1
  local pid_file="$PID_DIR/${name}.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      # Also kill child processes (e.g. uvicorn reloader, vite)
      pkill -P "$pid" 2>/dev/null || true
      sleep 0.5
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        pkill -9 -P "$pid" 2>/dev/null || true
      fi
      ok "Stopped ${name} (pid ${pid})"
    fi
    rm -f "$pid_file"
  fi
}

stop_all_pids() {
  local f
  shopt -s nullglob
  for f in "$PID_DIR"/*.pid; do
    stop_pid_file "$(basename "$f" .pid)"
  done
  shopt -u nullglob
}

start_background() {
  local name=$1
  local log_file="$DEV_DIR/logs/${name}.log"
  shift
  ensure_dev_dirs
  : >"$log_file"
  ("$@" >>"$log_file" 2>&1) &
  local pid=$!
  echo "$pid" >"$PID_DIR/${name}.pid"
  echo "$pid"
}

wait_for_postgres() {
  local max=${1:-40} i
  for ((i = 1; i <= max; i++)); do
    if docker exec sport-app-postgres pg_isready -U sport -d sport_app >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    err "Docker not found. Install Docker Desktop."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    err "Docker is not running. Start Docker Desktop."
    exit 1
  fi
}

ensure_backend_venv() {
  if [ ! -d "$ROOT/backend/.venv" ]; then
    log "Creating Python venv..."
    python3 -m venv "$ROOT/backend/.venv"
  fi
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
  log "Syncing backend dependencies..."
  pip install -q -e "$ROOT/backend[dev]"
}

ensure_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable >/dev/null 2>&1 || true
      corepack prepare pnpm@9.15.0 --activate >/dev/null 2>&1 || true
    fi
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    err "pnpm not found. Run: corepack enable && corepack prepare pnpm@9.15.0 --activate"
    exit 1
  fi
  if [ ! -d "$ROOT/node_modules" ]; then
    log "Installing frontend dependencies..."
    (cd "$ROOT" && pnpm install)
  fi
}

sed_in_place() {
  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

ensure_backend_env() {
  local db_url="postgresql+asyncpg://sport:sport@localhost:${POSTGRES_HOST_PORT}/sport_app"
  if [ ! -f "$ROOT/backend/.env" ]; then
    cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  fi
  if grep -q '^DATABASE_URL=' "$ROOT/backend/.env"; then
    sed_in_place "s|^DATABASE_URL=.*|DATABASE_URL=${db_url}|" "$ROOT/backend/.env"
  else
    echo "DATABASE_URL=${db_url}" >>"$ROOT/backend/.env"
  fi
}

check_port_available() {
  local port=$1
  local label=$2
  if lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    err "Port ${port} (${label}) is already in use."
    err "Stop the process or change the port in infra/docker-compose.yml"
    return 1
  fi
  return 0
}

docker_container_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$1"
}

# Port may be in use by our own Docker container — that is OK.
check_port_for_compose() {
  local port=$1
  local label=$2
  local container=$3

  if docker_container_running "$container"; then
    return 0
  fi
  if lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    err "Port ${port} (${label}) is already in use by another process."
    err "Stop it or set POSTGRES_HOST_PORT to a free port in infra/docker-compose.yml"
    return 1
  fi
  return 0
}

ensure_docker_infra() {
  check_docker
  export POSTGRES_HOST_PORT

  if docker_container_running sport-app-postgres; then
    log "Postgres container already running on :${POSTGRES_HOST_PORT}"
  elif ! check_port_for_compose "$POSTGRES_HOST_PORT" "sport-app Postgres" sport-app-postgres; then
    err "Tip: port 5432 is often taken by local PostgreSQL — sport-app defaults to ${POSTGRES_HOST_PORT}."
    exit 1
  fi

  log "Starting Docker (Postgres :${POSTGRES_HOST_PORT}, Redis, MinIO)..."
  docker compose -f "$COMPOSE_FILE" up -d

  log "Waiting for Postgres..."
  if ! wait_for_postgres 45; then
    err "Postgres did not become ready in time."
    exit 1
  fi
  ok "Postgres ready"
}

write_frontend_env() {
  local lan_ip=$1
  ensure_dev_dirs
  cat >"$RUNTIME_ENV" <<EOF
LAN_IP=${lan_ip}
VITE_API_URL=/api/v1
VITE_DEV_HOST=${lan_ip}
EOF
  local app
  for app in athlete coach coach-web admin; do
    local athlete_url=""
    if [ "$app" = "coach" ]; then
      athlete_url=$(
        if [ "$(dev_url_scheme)" = "https" ]; then
          echo "https://${lan_ip}:${PORT_ATHLETE}"
        else
          echo "http://${lan_ip}:${PORT_ATHLETE}"
        fi
      )
    fi
    cat >"$ROOT/apps/${app}/.env.development.local" <<EOF
# Generated by scripts/start.sh — do not commit
# Relative URL → Vite proxies /api/v1 to localhost:8000 (works from phone on same Wi‑Fi)
VITE_API_URL=/api/v1
VITE_DEV_HOST=${lan_ip}
${athlete_url:+VITE_ATHLETE_APP_URL=${athlete_url}}
EOF
  done
}

cleanup_frontend_env() {
  local app
  for app in athlete coach coach-web admin; do
    rm -f "$ROOT/apps/${app}/.env.development.local"
  done
  rm -f "$RUNTIME_ENV"
}

print_urls() {
  local lan_ip=$1
  local scheme
  scheme=$(dev_url_scheme)
  echo ""
  echo -e "${C_BOLD}══════════════════════════════════════════════════════════${C_RESET}"
  echo -e "${C_BOLD}  sport-app is running${C_RESET}"
  echo -e "${C_BOLD}══════════════════════════════════════════════════════════${C_RESET}"
  echo ""
  printf "  %-14s %s\n" "API:" "http://localhost:${PORT_API}/docs"
  printf "  %-14s %s\n" "" "http://${lan_ip}:${PORT_API}/docs"
  echo ""
  printf "  %-14s %s\n" "Athlete PWA:" "${scheme}://localhost:${PORT_ATHLETE}"
  if is_lan_ip "$lan_ip"; then
    printf "  %-14s %s  ${C_GREEN}← phone${C_RESET}\n" "" "${scheme}://${lan_ip}:${PORT_ATHLETE}"
  else
    printf "  %-14s %s  ${C_RED}(Wi‑Fi off?)${C_RESET}\n" "" "${scheme}://${lan_ip}:${PORT_ATHLETE}"
  fi
  echo ""
  printf "  %-14s %s\n" "Coach PWA:" "${scheme}://localhost:${PORT_COACH}"
  if is_lan_ip "$lan_ip"; then
    printf "  %-14s %s  ${C_GREEN}← phone${C_RESET}\n" "" "${scheme}://${lan_ip}:${PORT_COACH}"
  else
    printf "  %-14s %s  ${C_RED}(Wi‑Fi off?)${C_RESET}\n" "" "${scheme}://${lan_ip}:${PORT_COACH}"
  fi
  echo ""
  printf "  %-14s %s\n" "Coach Web:" "${scheme}://localhost:${PORT_COACH_WEB}"
  printf "  %-14s %s\n" "" "${scheme}://${lan_ip}:${PORT_COACH_WEB}"
  echo ""
  printf "  %-14s %s\n" "Admin:" "${scheme}://localhost:${PORT_ADMIN}"
  printf "  %-14s %s\n" "" "${scheme}://${lan_ip}:${PORT_ADMIN}"
  echo ""
  echo -e "  ${C_YELLOW}Postgres:${C_RESET} localhost:${POSTGRES_HOST_PORT} (Docker; 5432 often busy on Mac)"
  if [ "$scheme" = "https" ]; then
    echo -e "  ${C_YELLOW}HTTPS:${C_RESET} certs in .dev/certs/ (regenerated when LAN IP changes)"
    if command -v mkcert >/dev/null 2>&1; then
      echo -e "  ${C_YELLOW}Phone CA:${C_RESET} install $(mkcert -CAROOT)/rootCA.pem once (see README)"
    else
      echo -e "  ${C_YELLOW}HTTPS:${C_RESET} brew install mkcert && mkcert -install, then restart"
    fi
  fi
  if is_lan_ip "$lan_ip"; then
    echo -e "  ${C_YELLOW}Phone:${C_RESET} same Wi‑Fi → Athlete/Coach LAN URLs above"
    echo -e "  ${C_YELLOW}Themes:${C_RESET} ${scheme}://${lan_ip}:${PORT_ATHLETE}/?preview=themes"
  else
    echo -e "  ${C_YELLOW}Phone:${C_RESET} connect Mac to Wi‑Fi, then ./scripts/stop.sh && ./scripts/start.sh"
  fi
  echo -e "  ${C_YELLOW}Logs:${C_RESET}  ${DEV_DIR}/logs/"
  echo -e "  ${C_YELLOW}Stop:${C_RESET}  ./scripts/stop.sh"
  echo ""
}
