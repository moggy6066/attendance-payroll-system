# Backs up the Postgres database of the Docker stack to backups\hr-YYYY-MM-DD_HHmm.sql.gz
# and deletes backups older than -KeepDays. Safe to run while the app is in use.
#   powershell -ExecutionPolicy Bypass -File scripts\windows\backup.ps1
# Exit code 0 = OK, 1 = failed (see backups\backup.log).
param([int]$KeepDays = 30)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root
$outDir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir "backup.log"
function Log($m) { $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m"; Write-Host $line; Add-Content -Path $log -Value $line }

$user = "postgres"; $db = "hr_attendance_db"
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  foreach ($l in [System.IO.File]::ReadAllLines($envFile)) {
    if ($l -match "^POSTGRES_USER=(.+)$") { $user = $Matches[1].Trim() }
    if ($l -match "^POSTGRES_DB=(.+)$") { $db = $Matches[1].Trim() }
  }
}

$name = "hr-$(Get-Date -Format 'yyyy-MM-dd_HHmm').sql.gz"
$target = Join-Path $outDir $name
try {
  # Dump + compress inside the container, then copy the file out (keeps the bytes intact).
  docker compose exec -T postgres sh -c "set -o pipefail; pg_dump -U '$user' -d '$db' | gzip > /tmp/$name"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (is the stack running? docker compose ps)" }
  docker compose cp "postgres:/tmp/$name" "$target"
  if ($LASTEXITCODE -ne 0) { throw "copy out of the container failed" }
  docker compose exec -T postgres rm -f "/tmp/$name" | Out-Null
  $size = (Get-Item $target).Length
  if ($size -lt 200) { throw "backup file is suspiciously small ($size bytes)" }
  Log "OK $name ($([math]::Round($size/1KB,1)) KB)"
} catch {
  if (Test-Path $target) { Remove-Item $target -Force }
  docker compose exec -T postgres rm -f "/tmp/$name" 2>$null | Out-Null
  Log "FAILED: $($_.Exception.Message)"
  exit 1
}

Get-ChildItem $outDir -Filter "hr-*.sql.gz" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  ForEach-Object { Remove-Item $_.FullName; Log "deleted old backup $($_.Name)" }
exit 0
