param(
    [string]$ProjectPath = "C:\Ubuntu\Projects\bionotary-backend",
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"

Write-Host "== BioNotary backend demo start ==" -ForegroundColor Cyan

Set-Location $ProjectPath

if (-not (Test-Path ".env")) {
    Write-Host "No .env found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env before using production credentials." -ForegroundColor Yellow
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "Opening Windows Firewall for TCP $Port..." -ForegroundColor Cyan
netsh advfirewall firewall add rule name="BioNotary Backend $Port" dir=in action=allow protocol=TCP localport=$Port | Out-Null

$env:PORT = "$Port"

Write-Host "Running DB migration..." -ForegroundColor Cyan
npm run migrate

Write-Host "Starting backend on 0.0.0.0:$Port..." -ForegroundColor Green
node server.js
