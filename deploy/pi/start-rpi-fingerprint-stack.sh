#!/usr/bin/env bash
set -euo pipefail

# One-command Raspberry Pi launcher for backend + R307 bridge.
# - Uses Python venv (no global pip install required)
# - Starts postgres docker (if docker-compose.yml exists)
# - Starts fingerprint R307 bridge + backend with pid/log files
# - Verifies local health endpoints
#
# Usage:
#   bash deploy/pi/start-rpi-fingerprint-stack.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="${ROOT_DIR}/.run"
VENV_DIR="${ROOT_DIR}/.venv-fingerprint"
ENV_FILE="${ROOT_DIR}/.env"
LOG_BACKEND="${RUN_DIR}/backend.log"
LOG_FP="${RUN_DIR}/fingerprint-r307.log"
PID_BACKEND="${RUN_DIR}/backend.pid"
PID_FP="${RUN_DIR}/fingerprint-r307.pid"

mkdir -p "${RUN_DIR}"

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing command: ${cmd}"
    exit 1
  fi
}

stop_if_running() {
  local pid_file="$1"
  local name="$2"
  if [[ -f "${pid_file}" ]]; then
    local old_pid
    old_pid="$(<"${pid_file}")"
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
      echo "Stopping existing ${name} (PID ${old_pid})..."
      kill "${old_pid}" || true
      sleep 1
    fi
  fi
}

wait_http() {
  local url="$1"
  local name="$2"
  local retries=20
  local i
  for ((i = 1; i <= retries; i += 1)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${name} is healthy at ${url}"
      return 0
    fi
    sleep 1
  done
  echo "${name} health check failed: ${url}"
  return 1
}

echo "[1/8] Checking required commands..."
require_cmd bash
require_cmd node
require_cmd npm
require_cmd python3
require_cmd curl

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f "${ROOT_DIR}/.env.example" ]]; then
    cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
    echo "Created .env from .env.example. Please review secrets and DB settings."
  else
    echo ".env missing and .env.example not found."
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

echo "[2/8] Validating required environment..."
if [[ -z "${JWT_SECRET:-}" || "${JWT_SECRET}" == "change-me-to-a-long-random-string" ]]; then
  echo "JWT_SECRET is missing or still default in .env"
  exit 1
fi
if [[ -z "${FINGERPRINT_SERVICE_URL:-}" ]]; then
  echo "FINGERPRINT_SERVICE_URL is missing in .env"
  exit 1
fi
if [[ "${FINGERPRINT_SERVICE_URL}" != "http://127.0.0.1:"* ]]; then
  echo "For Pi safety, FINGERPRINT_SERVICE_URL should be local (127.0.0.1)."
  echo "Current value: ${FINGERPRINT_SERVICE_URL}"
  exit 1
fi

FP_SERIAL_PORT="${FP_SERIAL_PORT:-/dev/ttyAMA0}"
if [[ ! -e "${FP_SERIAL_PORT}" ]]; then
  echo "Serial port not found: ${FP_SERIAL_PORT}"
  echo "Check raspi-config serial settings and wiring."
  exit 1
fi

echo "[3/8] Preparing Python virtual environment..."
if [[ ! -d "${VENV_DIR}" ]]; then
  python3 -m venv "${VENV_DIR}"
fi

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"
python -m pip install --upgrade pip >/dev/null
if ! python -c "import pyfingerprint" >/dev/null 2>&1; then
  echo "Installing pyfingerprint inside venv..."
  python -m pip install pyfingerprint
fi
deactivate

echo "[4/8] Installing backend dependencies..."
(
  cd "${ROOT_DIR}"
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
)

echo "[5/8] Starting postgres container (if configured)..."
if [[ -f "${ROOT_DIR}/docker-compose.yml" ]]; then
  if command -v docker >/dev/null 2>&1; then
    docker compose -f "${ROOT_DIR}/docker-compose.yml" up -d
  else
    echo "docker not found; skipping DB container startup"
  fi
fi

echo "[6/8] Starting fingerprint R307 bridge..."
stop_if_running "${PID_FP}" "fingerprint bridge"
(
  cd "${ROOT_DIR}"
  # shellcheck disable=SC1091
  source "${VENV_DIR}/bin/activate"
  nohup env \
    FP_BIND=127.0.0.1 \
    FP_PORT="${FP_PORT:-8765}" \
    FP_SERIAL_PORT="${FP_SERIAL_PORT}" \
    FP_BAUD_RATE="${FP_BAUD_RATE:-57600}" \
    FP_SENSOR_ADDR="${FP_SENSOR_ADDR:-0xFFFFFFFF}" \
    FP_SENSOR_PASS="${FP_SENSOR_PASS:-0x00000000}" \
    FP_DB_FILE="${FP_DB_FILE:-fingerprint/fingerprint_db.json}" \
    python fingerprint/r307_service.py >"${LOG_FP}" 2>&1 &
  echo $! >"${PID_FP}"
  deactivate
)

sleep 2
if ! kill -0 "$(cat "${PID_FP}")" 2>/dev/null; then
  echo "Fingerprint bridge failed to start. Log: ${LOG_FP}"
  exit 1
fi

echo "[7/8] Starting backend API..."
stop_if_running "${PID_BACKEND}" "backend"
(
  cd "${ROOT_DIR}"
  nohup npm start >"${LOG_BACKEND}" 2>&1 &
  echo $! >"${PID_BACKEND}"
)

sleep 2
if ! kill -0 "$(cat "${PID_BACKEND}")" 2>/dev/null; then
  echo "Backend failed to start. Log: ${LOG_BACKEND}"
  exit 1
fi

echo "[8/8] Running health checks..."
wait_http "http://127.0.0.1:${FP_PORT:-8765}/health" "Fingerprint bridge"
wait_http "http://127.0.0.1:${PORT:-5000}/" "Backend API"

echo
echo "Stack started successfully."
echo "Backend PID : $(cat "${PID_BACKEND}")"
echo "Backend log : ${LOG_BACKEND}"
echo "FP PID      : $(cat "${PID_FP}")"
echo "FP log      : ${LOG_FP}"
