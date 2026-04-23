# Bionotary Backend

This is the backend for the Bionotary project.

## Project Structure
- `db.js`: Database connection and logic
- `server.js`: Main server entry point
- `middleware/`: Custom middleware (e.g., authentication)
- `routes/`: API route handlers

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env` (not uploaded to GitHub).
3. Start the server:
   ```bash
   npm start
   ```

## Host Backend on PC for LAN Access
This mode keeps all compute and database on this PC, and lets LAN devices
(for example Raspberry Pi kiosk clients) call the backend over HTTP via Nginx.

### 1) Database port alignment (avoid local PostgreSQL port conflicts)
`docker-compose.yml` maps container PostgreSQL to host `5433`:

```yaml
ports:
  - "5433:5432"
```

Set `.env` accordingly:

```env
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=bionotary
```

Start and verify database:

```bash
docker compose up -d
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d bionotary -c "select 1;"
```

### 2) Run backend locally (manual startup)
From project root:

```bash
npm start
```

Verify local health from PC:

```bash
curl http://127.0.0.1:5000/
curl http://127.0.0.1:5000/test-db
```

### 3) Configure Nginx reverse proxy on this PC
Use `deploy/pi/nginx-bionotary.conf` as the site config:

```bash
sudo cp deploy/pi/nginx-bionotary.conf /etc/nginx/sites-available/bionotary
sudo ln -sf /etc/nginx/sites-available/bionotary /etc/nginx/sites-enabled/bionotary
sudo nginx -t
sudo systemctl reload nginx
```

Get your PC LAN IP and test from another device:

```bash
hostname -I
curl http://<pc-lan-ip>/
```

### 4) Firewall + CORS
Open HTTP on LAN:

```bash
sudo ufw allow 80/tcp
```

Set frontend origins in `.env`:

```env
ALLOWED_ORIGINS=http://<pc-lan-ip>,http://<raspberry-pi-hostname>
```

### 5) Daily startup sequence
After reboot, run:

```bash
docker compose up -d
npm start
```

Then confirm from Raspberry Pi:
- API root is reachable at `http://<pc-lan-ip>/`
- one authenticated API call succeeds (e.g. `/profile`)

## Notes
- Sensitive files like `.env` and `node_modules` are excluded via `.gitignore`.
- Please review and update documentation as needed.

## Raspberry Pi Demo (Laptop-hosted)
- For a setup where code stays on your laptop and Raspberry Pi runs only kiosk browser, use:
  - `deploy/laptop-pi-demo/README.md`
  - `deploy/laptop-pi-demo/start-backend-demo.ps1`
  - `deploy/laptop-pi-demo/start-frontend-demo.ps1`
  - `deploy/laptop-pi-demo/pi-kiosk-setup.sh`

## R307 Fingerprint Sensor (Raspberry Pi)
- Wiring (R307): `VCC->Pin4`, `GND->Pin6`, `TX->Pin10`, `RX->Pin8`
- Enable Pi serial hardware: `sudo raspi-config` -> disable serial login shell, enable serial hardware
- Install Python dependency:
  ```bash
  pip install pyfingerprint
  ```
- Start R307 bridge service:
  ```bash
  python3 fingerprint/r307_service.py
  ```
- Backend calls this bridge via `FINGERPRINT_SERVICE_URL` and supports:
  - `POST /auth/fingerprint/enroll` (stores template + label mapping)
  - `POST /auth/fingerprint/login` (matches scan and returns JWT)

### One-command Pi startup (with venv)
If your Pi blocks global `pip install`, use:

```bash
bash deploy/pi/start-rpi-fingerprint-stack.sh
```

This script auto-creates `.venv-fingerprint`, installs `pyfingerprint` in that venv, then starts:
- R307 bridge (`fingerprint/r307_service.py`)
- backend API (`npm start`)
- docker postgres (if `docker-compose.yml` exists)
