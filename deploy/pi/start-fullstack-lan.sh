#!/usr/bin/env bash
set -euo pipefail

# One-command launcher for local LAN deployment:
# - starts PostgreSQL container
# - builds Flutter web with API_BASE_URL=http://<LAN_IP>/api
# - syncs web build to Apache doc root
# - reloads Apache
# - starts backend API in background with PID + log files
#
# Usage:
#   bash deploy/pi/start-fullstack-lan.sh
#   bash deploy/pi/start-fullstack-lan.sh --api-base-url http://192.168.1.20/api

API_BASE_URL="/api"
if [[ "${1:-}" == "--api-base-url" ]]; then
  if [[ -z "${2:-}" ]]; then
    echo "Usage: bash deploy/pi/start-fullstack-lan.sh [--api-base-url <url>]"
    exit 1
  fi
  API_BASE_URL="${2}"
fi

detect_lan_ip() {
  local detected
  detected="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i=="src") {print $(i+1); exit}}')"
  if [[ -n "${detected}" ]]; then
    echo "${detected}"
    return
  fi
  hostname -I | awk '{print $1}'
}

LAN_IP="$(detect_lan_ip)"

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_ROOT="/home/samyak/bionotary-app"
WEB_BUILD_DIR="${FRONTEND_ROOT}/build/web"
WEB_ROOT="/var/www/bionotary-app"
PID_FILE="${BACKEND_ROOT}/.run/backend.pid"
LOG_FILE="${BACKEND_ROOT}/.run/backend.log"

mkdir -p "${BACKEND_ROOT}/.run"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found"
  exit 1
fi
if ! command -v flutter >/dev/null 2>&1; then
  echo "flutter not found"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found"
  exit 1
fi

echo "[1/6] Starting PostgreSQL container..."
docker compose -f "${BACKEND_ROOT}/docker-compose.yml" up -d

echo "[2/6] Building Flutter web..."
(
  cd "${FRONTEND_ROOT}"
  flutter build web --dart-define="API_BASE_URL=${API_BASE_URL}"
)

if [[ ! -d "${WEB_BUILD_DIR}" ]]; then
  echo "Flutter build output missing: ${WEB_BUILD_DIR}"
  exit 1
fi

echo "[3/6] Syncing frontend build to Apache web root..."
sudo mkdir -p "${WEB_ROOT}"
sudo rsync -a --delete "${WEB_BUILD_DIR}/" "${WEB_ROOT}/"
sudo chown -R www-data:www-data "${WEB_ROOT}"

echo "[4/6] Reloading Apache..."
sudo systemctl reload apache2

echo "[5/6] Starting backend API in background..."
if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${OLD_PID}" ]] && kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "Stopping existing backend process (PID ${OLD_PID})..."
    kill "${OLD_PID}" || true
    sleep 1
  fi
fi

(
  cd "${BACKEND_ROOT}"
  nohup npm start >"${LOG_FILE}" 2>&1 &
  echo $! >"${PID_FILE}"
)

sleep 2
if ! kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "Backend failed to start. Check logs: ${LOG_FILE}"
  exit 1
fi

echo "[6/6] Health checks..."
echo "Local API:   http://127.0.0.1:5000/"
echo "LAN App URL: http://${LAN_IP}/"
echo "API base in build: ${API_BASE_URL}"
if [[ "${API_BASE_URL}" == "/api" ]]; then
  echo "LAN API URL: http://${LAN_IP}/api/"
fi
echo
echo "Done."
echo "Backend PID: $(cat "${PID_FILE}")"
echo "Backend log: ${LOG_FILE}"
