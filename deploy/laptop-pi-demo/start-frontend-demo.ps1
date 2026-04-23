param(
    [string]$AppProjectPath = "C:\Ubuntu\Projects\bionotary-app",
    [string]$ApiBaseUrl = "http://127.0.0.1:5000",
    [int]$WebPort = 8080
)

$ErrorActionPreference = "Stop"

Write-Host "== BioNotary frontend demo start ==" -ForegroundColor Cyan

Set-Location $AppProjectPath

Write-Host "Fetching Flutter packages..." -ForegroundColor Cyan
flutter pub get

Write-Host "Opening Windows Firewall for TCP $WebPort..." -ForegroundColor Cyan
netsh advfirewall firewall add rule name="BioNotary Frontend $WebPort" dir=in action=allow protocol=TCP localport=$WebPort | Out-Null

Write-Host "Starting Flutter web-server on 0.0.0.0:$WebPort with API $ApiBaseUrl..." -ForegroundColor Green
flutter run -d web-server --web-hostname 0.0.0.0 --web-port $WebPort --dart-define API_BASE_URL=$ApiBaseUrl
