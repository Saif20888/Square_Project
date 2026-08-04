# ============================================================================
#  SQUARE portal - database restore
#
#  Usage (in PowerShell, from this folder):
#     .\restore-square-db.ps1                     -> restores the NEWEST backup
#     .\restore-square-db.ps1 square_db_2026-07-09_1100.backup
#
#  This REPLACES everything currently in square_db with the backup's contents.
#  Best to stop the Spring Boot backend first, then start it again afterwards.
# ============================================================================

param([string]$File)

$PgRestore = "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"
$BackupDir = $PSScriptRoot

if (-not $File) {
    $latest = Get-ChildItem -Path $BackupDir -Filter "square_db_*.backup" |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) { Write-Host "No backup files found in $BackupDir" -ForegroundColor Red; exit 1 }
    $File = $latest.FullName
} elseif (-not (Split-Path $File -IsAbsolute)) {
    $File = Join-Path $BackupDir $File
}

if (-not (Test-Path $File)) { Write-Host "Backup file not found: $File" -ForegroundColor Red; exit 1 }

Write-Host "About to restore square_db from:" -ForegroundColor Yellow
Write-Host "  $File"
Write-Host "This will OVERWRITE all current data in square_db." -ForegroundColor Yellow
$answer = Read-Host "Type YES to continue"
if ($answer -ne "YES") { Write-Host "Cancelled."; exit 0 }

# The database password is read from the environment so it is not stored in a
# file that lives in version control. Set it once for your Windows account with:
#   setx PGPASSWORD "your-password"
# (open a new terminal afterwards), or set $env:PGPASSWORD before running this.
if (-not $env:PGPASSWORD) {
    Write-Error "PGPASSWORD is not set. See the comment above this line."
    exit 1
}
& $PgRestore -h localhost -p 5432 -U postgres -d square_db --clean --if-exists $File

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore complete." -ForegroundColor Green
} else {
    Write-Host "pg_restore finished with exit code $LASTEXITCODE - check the messages above." -ForegroundColor Yellow
}
