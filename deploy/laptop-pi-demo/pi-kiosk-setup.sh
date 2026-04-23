#!/usr/bin/env bash
set -euo pipefail

APP_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-url)
      APP_URL="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

if [[ -z "${APP_URL}" ]]; then
  echo "Usage: ./pi-kiosk-setup.sh --app-url http://<LAPTOP_IP>:8080"
  exit 1
fi

echo "Installing kiosk prerequisites..."
sudo apt update
sudo apt install -y chromium-browser

echo "Enabling UART for R307..."
sudo raspi-config nonint do_serial_hw 0
sudo raspi-config nonint do_serial_cons 1
sudo usermod -aG dialout "${USER}"

echo "Creating Chromium kiosk autostart entry..."
mkdir -p "${HOME}/.config/autostart"
cat > "${HOME}/.config/autostart/bionotary-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=BioNotary Kiosk
Exec=chromium-browser --kiosk --incognito --disable-infobars --noerrdialogs ${APP_URL}
X-GNOME-Autostart-enabled=true
EOF

echo "Disabling display sleep..."
mkdir -p "${HOME}/.config/lxsession/LXDE-pi"
if ! grep -q "xset s off" "${HOME}/.config/lxsession/LXDE-pi/autostart" 2>/dev/null; then
  {
    echo "@xset s off"
    echo "@xset -dpms"
    echo "@xset s noblank"
  } >> "${HOME}/.config/lxsession/LXDE-pi/autostart"
fi

echo
echo "Kiosk setup complete."
echo "Reboot now: sudo reboot"
