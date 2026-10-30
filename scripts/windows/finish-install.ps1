# Run once after the first successful start of a NEW install:
# turns RUN_SEED off, removes ADMIN_PASSWORD from .env and restarts the backend.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root
$envFile = Join-Path $root ".env"
$lines = [System.IO.File]::ReadAllLines($envFile) | ForEach-Object {
  if ($_ -match "^RUN_SEED=") { "RUN_SEED=false" }
  elseif ($_ -match "^ADMIN_PASSWORD=") { "ADMIN_PASSWORD=" }
  else { $_ }
}
[System.IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding($false)))
docker compose up -d backend
Write-Host "Done: RUN_SEED=false, ADMIN_PASSWORD cleared."
