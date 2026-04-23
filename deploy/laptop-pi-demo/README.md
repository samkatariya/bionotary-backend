# BioNotary Demo: Laptop-hosted, Raspberry Pi kiosk

This mode keeps your code on the laptop:

- `bionotary-backend` runs on Windows laptop
- `bionotary-app` runs on Windows laptop (Flutter web)
- Raspberry Pi runs Chromium kiosk + MetaMask extension
- R307 is wired to Raspberry Pi for hardware demo preparation

## 1) One-time prerequisites

### Windows laptop

- Node.js 18+
- Flutter SDK
- PostgreSQL running locally
- Firewall allows inbound ports `5000` and `8080`

### Raspberry Pi 4B

- Raspberry Pi OS 64-bit Desktop
- Chromium installed
- UART enabled for R307

## 2) Create/use the Raspberry Pi branch

Run in both repos:

```bash
git checkout raspberry-pi-deployment || git checkout -b raspberry-pi-deployment
```

## 3) Configure backend env on laptop

Copy and edit env:

```bash
cd C:\Ubuntu\Projects\bionotary-backend
copy .env.example .env
```

Set at minimum:

- `PORT=5000`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_USER=...`
- `DB_PASSWORD=...`
- `DB_NAME=...`
- `JWT_SECRET=<long-random-secret>`
- `FINGERPRINT_SERVICE_URL=http://127.0.0.1:8765` (or Pi bridge URL later)

## 4) Start demo stack on laptop

Use PowerShell scripts in this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\laptop-pi-demo\start-backend-demo.ps1
powershell -ExecutionPolicy Bypass -File .\deploy\laptop-pi-demo\start-frontend-demo.ps1 -ApiBaseUrl http://<LAPTOP_IP>:5000
```

## 5) Raspberry Pi kiosk setup

On Raspberry Pi:

```bash
chmod +x ./pi-kiosk-setup.sh
./pi-kiosk-setup.sh --app-url http://<LAPTOP_IP>:8080
```

Reboot Pi and Chromium will open full-screen to your laptop-hosted app.

## 6) R307 wiring map (Pi physical pins)

- Red (VCC) -> Pin `2` (5V)
- Black (GND) -> Pin `6` (GND)
- R307 TX (often yellow/white) -> Pin `10` (GPIO15 / RXD)
- R307 RX (often green/blue) -> Pin `8` (GPIO14 / TXD)

TX/RX are crossed.

## 7) Future updates

- Keep working in the same two repos on laptop.
- Pull latest on branch:

```bash
git checkout raspberry-pi-deployment
git pull
```

- Restart scripts:
  - `start-backend-demo.ps1`
  - `start-frontend-demo.ps1`

Pi does not need code redeploy in this mode; it always loads from `http://<LAPTOP_IP>:8080`.
