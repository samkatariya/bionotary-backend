#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/pi/setup-lan-host.sh"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NGINX_SRC="${ROOT_DIR}/deploy/pi/nginx-bionotary.conf"
NGINX_DST="/etc/nginx/sites-available/bionotary"
NGINX_ENABLED="/etc/nginx/sites-enabled/bionotary"

if [[ ! -f "${NGINX_SRC}" ]]; then
  echo "Nginx template not found: ${NGINX_SRC}"
  exit 1
fi

cp "${NGINX_SRC}" "${NGINX_DST}"
ln -sf "${NGINX_DST}" "${NGINX_ENABLED}"

if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
fi

echo "Nginx LAN proxy configured."
echo "Next steps:"
echo "1) Start DB: docker compose up -d"
echo "2) Start API: npm start"
echo "3) Test from LAN: curl http://<pc-lan-ip>/"
