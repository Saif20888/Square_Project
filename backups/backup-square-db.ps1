# ============================================================================
#  SQUARE portal - daily database backup
#  Dumps the whole square_db PostgreSQL database into a timestamped file in
#  this folder, keeps a log, and deletes backups older than $KeepDays days.
#  Scheduled to run every day at 11:00 AM via Windows Task Scheduler
#  (task name: "SQUARE DB Daily Backup").
# ============================================================================

$PgDump    = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
$BackupDir = "C:\Project\square-group-portal\backups"
$Database  = "square_db"
$KeepDays  = 30

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$file  = Join-Path $BackupDir "square_db_$stamp.backup"
$log   = Join-Path $BackupDir "backup.log"

# The database password is read from the environment so it is not stored in a
# file that lives in version control. Set it once for your Windows account with:
#   setx PGPASSWORD "your-password"
# (open a new terminal afterwards), or set $env:PGPASSWORD before running this.
if (-not $env:PGPASSWORD) {
    Write-Error "PGPASSWORD is not set. See the comment above this line."
    exit 1
}

# -Fc = compressed "custom" format, restorable with pg_restore
& $PgDump -h localhost -p 5432 -U postgres -Fc -f $file $Database

if ($LASTEXITCODE -eq 0 -and (Test-Path $file)) {
    $size = "{0:N0} KB" -f ((Get-Item $file).Length / 1KB)
    Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  OK      $file ($size)"

    # Retention: remove backups older than $KeepDays days
    Get-ChildItem -Path $BackupDir -Filter "square_db_*.backup" |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
        ForEach-Object {
            Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  PRUNED  $($_.FullName)"
            Remove-Item $_.FullName -Force
        }
} else {
    Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  FAILED  pg_dump exit code $LASTEXITCODE"
    exit 1
}
