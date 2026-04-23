#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/pi/setup-apache-fullstack.sh"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APACHE_CONF_SRC="${ROOT_DIR}/deploy/pi/apache-bionotary-fullstack.conf"
APACHE_SITE_DST="/etc/apache2/sites-available/bionotary.conf"

if [[ ! -f "${APACHE_CONF_SRC}" ]]; then
  echo "Missing Apache config template: ${APACHE_CONF_SRC}"
  exit 1
fi

if [[ ! -d /home/samyak/bionotary-app/build/web ]]; then
  echo "Flutter web build not found at /home/samyak/bionotary-app/build/web"
  echo "Run: cd /home/samyak/bionotary-app && flutter build web --dart-define=API_BASE_URL=http://<pc-lan-ip>/api"
  exit 1
fi

a2enmod proxy proxy_http headers rewrite >/dev/null
cp "${APACHE_CONF_SRC}" "${APACHE_SITE_DST}"
a2dissite 000-default.conf >/dev/null || true
a2ensite bionotary.conf >/dev/null
apache2ctl configtest
systemctl enable --now apache2
systemctl reload apache2

if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
fi

echo
echo "Apache fullstack LAN setup completed."
echo "Start backend with: cd ${ROOT_DIR} && npm start"
echo "Ensure DB is up:     cd ${ROOT_DIR} && docker compose up -d"
echo "Access from devices: http://<pc-lan-ip>/"
