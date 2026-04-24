# Alwaan PMS — One-click deploy to DigitalOcean
# Usage: .\deploy.ps1

$ErrorActionPreference = "Stop"

$DROPLET_IP   = "159.65.233.87"
$DROPLET_USER = "root"
$REMOTE_DIR   = "/var/www/property-pms"
$TAR_NAME     = "property-pms.tar.gz"

Write-Host "=== Alwaan PMS Deploy ===" -ForegroundColor Cyan

# Step 1: Create tar archive
Write-Host "`n[1/4] Creating archive..." -ForegroundColor Yellow
Push-Location D:\Projects
if (Test-Path $TAR_NAME) { Remove-Item $TAR_NAME }
tar -czf $TAR_NAME `
    --exclude=property-pms/node_modules `
    --exclude=property-pms/.next `
    --exclude=property-pms/.git `
    --exclude=property-pms/uploads `
    --exclude=property-pms/.env `
    --exclude=property-pms/.env.local `
    --exclude=property-pms/.env.production `
    property-pms
Write-Host "  Archive created: $(Get-Item $TAR_NAME | ForEach-Object { '{0:N1} MB' -f ($_.Length / 1MB) })" -ForegroundColor Green

# Step 2: Upload to Droplet
Write-Host "`n[2/4] Uploading to Droplet ($DROPLET_IP)..." -ForegroundColor Yellow
Write-Host "  You may be prompted for the Droplet password."
scp $TAR_NAME "${DROPLET_USER}@${DROPLET_IP}:/root/"
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Upload failed"
}
Write-Host "  Upload complete." -ForegroundColor Green

# Step 3: Remote build + restart
Write-Host "`n[3/4] Building on server..." -ForegroundColor Yellow
$REMOTE_CMD = @"
set -e
cd /var/www
tar -xzf /root/$TAR_NAME
cd property-pms
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -3
npm install --no-audit --no-fund 2>&1 | tail -3
NODE_OPTIONS='--max-old-space-size=3072' npm run build 2>&1 | tail -15
pm2 restart property-pms || pm2 start npm --name property-pms -- start
pm2 save
echo '=== DEPLOY SUCCESS ==='
"@
ssh "${DROPLET_USER}@${DROPLET_IP}" $REMOTE_CMD

# Step 4: Cleanup
Write-Host "`n[4/4] Cleaning up..." -ForegroundColor Yellow
Remove-Item $TAR_NAME
Pop-Location

Write-Host "`n=== DEPLOYED ===" -ForegroundColor Green
Write-Host "Live at: https://alwandxb.cre-me.com" -ForegroundColor Cyan
