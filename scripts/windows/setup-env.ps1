# Creates/updates .env (repository root) for running on THIS PC inside the company network.
#   New install:                   powershell -ExecutionPolicy Bypass -File scripts\windows\setup-env.ps1
#   Upgrade from the old compose:  powershell -ExecutionPolicy Bypass -File scripts\windows\setup-env.ps1 -ExistingDatabase
#   Force a specific IP:           ... -LanIp 192.168.1.50
# Never prints the secrets. Never commit .env.
param(
  [string]$LanIp = "",
  [switch]$ExistingDatabase,   # old Docker database volume: keep its password "postgres" for now
  [int]$Port = 8080,
  [string]$AdminEmail = ""   # new install: email of the first SUPER_ADMIN
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env"
$example = Join-Path $root ".env.docker.example"

function New-Hex([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (($b | ForEach-Object { $_.ToString("x2") }) -join "")
}

if (-not $LanIp) {
  try {
    $LanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and
                     $_.InterfaceAlias -notmatch "vEthernet|WSL|Docker|Loopback|VirtualBox|VMware" } |
      Sort-Object -Property InterfaceMetric | Select-Object -First 1).IPAddress
  } catch { $LanIp = "" }
  if (-not $LanIp) { throw "Could not detect the LAN IP. Run 'ipconfig' and pass it: -LanIp 192.168.x.x" }
}

if (-not (Test-Path $envFile)) { Copy-Item $example $envFile; Write-Host "Created .env from .env.docker.example" }
$lines = [System.Collections.Generic.List[string]]([System.IO.File]::ReadAllLines($envFile))

function Get-Val($key) {
  foreach ($l in $lines) { if ($l -match "^$key=(.*)$") { return $Matches[1] } }
  return $null
}
function Set-Val($key, $value) {
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^$key=") { $lines[$i] = "$key=$value"; return } }
  $lines.Add("$key=$value")
}

$jwt = Get-Val "JWT_SECRET"
if (-not $jwt -or $jwt -eq "CHANGE_ME" -or $jwt.Length -lt 32) { Set-Val "JWT_SECRET" (New-Hex 64); Write-Host "JWT_SECRET: new random value" }
else { Write-Host "JWT_SECRET: kept existing value" }

$pw = Get-Val "POSTGRES_PASSWORD"
if ($ExistingDatabase) { if (-not $pw -or $pw -eq "CHANGE_ME") { Set-Val "POSTGRES_PASSWORD" "postgres" }; Write-Host "POSTGRES_PASSWORD: existing database password kept (change it later, see DOCKER.md)" }
elseif (-not $pw -or $pw -eq "CHANGE_ME") { Set-Val "POSTGRES_PASSWORD" (New-Hex 24); Write-Host "POSTGRES_PASSWORD: new random value" }

Set-Val "APP_BIND" "0.0.0.0"
Set-Val "APP_PORT" "$Port"
Set-Val "CLIENT_URL" "http://${LanIp}:$Port"
Set-Val "SITE_ADDRESS" ""
Set-Val "APP_TIMEZONE" "Africa/Cairo"

# New install: prepare the first SUPER_ADMIN so the seed runs once on first start.
if (-not $ExistingDatabase) {
  $seeded = Get-Val "ADMIN_PASSWORD"
  if (-not $seeded -or $seeded -match "change|example") {
    if (-not $AdminEmail) { $AdminEmail = Read-Host "Email for the first admin account" }
    if ($AdminEmail -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { throw "Invalid email. Pass -AdminEmail you@company.com" }
    $adminPw = (New-Hex 12) + "Aa1"
    Set-Val "ADMIN_EMAIL" $AdminEmail
    Set-Val "ADMIN_PASSWORD" $adminPw
    Set-Val "RUN_SEED" "true"
    $script:printPw = $adminPw
  }
}

# UTF-8 without BOM, LF line endings (docker compose reads it reliably)
[System.IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host "Employees open:  http://${LanIp}:$Port"
if ($script:printPw) {
  Write-Host ""
  Write-Host "First login:  $AdminEmail  /  $script:printPw   (shown once - change it on the Profile page)"
  Write-Host "After the first start run:  powershell -File scripts\windows\finish-install.ps1  (turns RUN_SEED off and clears the password from .env)"
}
