<#
  Build Smart Care Analytics and deploy it to Azure App Service with Kudu zip deploy.

  Usage (from the project folder):
    .\deploy-azure.ps1 -PublishProfile "C:\path\smart-care-analytics.PublishSettings"
    .\deploy-azure.ps1 -PublishProfile "...PublishSettings" -SkipBuild      # redeploy the last build

  The publish profile: Azure portal → your App Service → Overview → "Download publish profile".
  If the download is greyed out, turn on Configuration → General settings → "SCM Basic Auth Publishing Credentials".
  Keep that file out of git: it contains the deployment password.
#>
param(
  [Parameter(Mandatory = $true)] [string] $PublishProfile,
  [switch] $SkipBuild
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12   # Windows PowerShell 5.1
Set-Location $PSScriptRoot

# 1. Build (uses src/environments/environment.prod.ts)
if (-not $SkipBuild) {
  Write-Host "Building (production)..." -ForegroundColor Cyan
  npx ng build --configuration production
  if ($LASTEXITCODE -ne 0) { throw "Build failed." }
}
$out = Join-Path $PSScriptRoot 'dist\smart-care-analytics\browser'
if (-not (Test-Path (Join-Path $out 'index.html'))) { throw "No build output in $out. Run without -SkipBuild." }

# 2. Zip the CONTENTS of the browser folder, so index.html sits at the zip root (= site/wwwroot)
$zip = Join-Path $PSScriptRoot 'dist\smart-care-analytics.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($out, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Write-Host ("Packaged {0} ({1:N0} KB)" -f $zip, ((Get-Item $zip).Length / 1KB)) -ForegroundColor Cyan

# 3. Read Kudu host and deployment credentials from the publish profile
[xml] $pp = Get-Content $PublishProfile
$p = $pp.publishData.publishProfile | Where-Object { $_.publishMethod -eq 'ZipDeploy' } | Select-Object -First 1
if (-not $p) { $p = $pp.publishData.publishProfile | Where-Object { $_.publishMethod -eq 'MSDeploy' } | Select-Object -First 1 }
if (-not $p) { throw "No ZipDeploy/MSDeploy entry in $PublishProfile." }
$scmHost = ($p.publishUrl -replace ':443$', '')
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($p.userName):$($p.userPWD)"))
$headers = @{ Authorization = "Basic $auth" }

# 4. Push to Kudu and wait for the deployment to finish
Write-Host "Deploying to https://$scmHost ..." -ForegroundColor Cyan
$resp = Invoke-WebRequest -Uri "https://$scmHost/api/zipdeploy?isAsync=true" -Method Post -InFile $zip `
  -ContentType 'application/zip' -Headers $headers -UseBasicParsing
$statusUrl = $resp.Headers['Location']; if ($statusUrl -is [array]) { $statusUrl = $statusUrl[0] }
if (-not $statusUrl) { $statusUrl = "https://$scmHost/api/deployments/latest" }

$states = @{ 0 = 'Pending'; 1 = 'Building'; 2 = 'Deploying'; 3 = 'Failed'; 4 = 'Success' }
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 2
  $d = Invoke-RestMethod -Uri $statusUrl -Headers $headers
  Write-Host ("  {0}" -f $states[[int]$d.status])
  if ($d.complete) {
    if ([int]$d.status -eq 4) {
      $site = ($p.destinationAppUrl, "https://$($scmHost -replace '\.scm\.', '.')" | Where-Object { $_ } | Select-Object -First 1)
      Write-Host "Deployed: $site" -ForegroundColor Green
      exit 0
    }
    throw "Deployment failed. Log: https://$scmHost/api/deployments/$($d.id)/log"
  }
}
throw "Timed out waiting for the deployment. Check https://$scmHost/api/deployments"
