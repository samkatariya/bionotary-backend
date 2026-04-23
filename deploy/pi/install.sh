#!/usr/bin/env bash
set -euo pipefail
# Raspberry Pi: clone or copy this repo to /opt/bionotary-backend, then run:
#   cd /opt/bionotary-backend && sudo bash deploy/pi/install.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

npm ci --omit=dev 2>/dev/null || npm install --omit=dev

if [[ -f .env.example && ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — set JWT_SECRET, DB_*, ETH_RPC_URL, etc."
fi

echo "Next:"
echo "  sudo cp \"$ROOT/deploy/pi/bionotary-api.service\" /etc/systemd/system/"
echo "  sudo cp \"$ROOT/deploy/pi/bionotary-fingerprint-mock.service\" /etc/systemd/system/"
echo "  # For real sensor on Pi, use this unit instead of mock:"
echo "  sudo cp \"$ROOT/deploy/pi/bionotary-fingerprint-r307.service\" /etc/systemd/system/"
echo "  Edit units: User=, WorkingDirectory=$ROOT, EnvironmentFile=$ROOT/.env"
echo "  sudo systemctl daemon-reload && sudo systemctl enable --now bionotary-fingerprint-mock bionotary-api"
