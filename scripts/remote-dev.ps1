$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$tailscalePath = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
if (!(Test-Path -LiteralPath $tailscalePath)) { throw 'Install Tailscale first, then sign in on this computer and your phone.' }
$statusText = & $tailscalePath status --json
if ($LASTEXITCODE -ne 0) { throw 'Tailscale is not available. Open Tailscale and sign in.' }
$status = $statusText | ConvertFrom-Json
if ($status.BackendState -ne 'Running') { throw 'Open Tailscale and sign in, then run this command again.' }
$dnsName = $status.Self.DNSName.TrimEnd('.')
if (!$dnsName) { throw 'Enable MagicDNS in Tailscale to obtain the private HTTPS name.' }
$env:APP_ORIGIN = "https://$dnsName"
$env:COOKIE_SECURE = 'true'
$env:TRUST_PROXY = '127.0.0.1/32'
$env:API_HOST = '127.0.0.1'
$env:API_PORT = '3001'
$env:API_TARGET = 'http://127.0.0.1:3001'
foreach ($port in @(3001,5173)) {
 $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $port })
 if ($listeners.Count -gt 0) { throw "Port $port is already occupied. Stop the existing local API/frontend before starting remote testing." }
}
Write-Host "Private phone preview: $env:APP_ORIGIN"
Write-Host 'Connect the phone to the same Tailscale network. Keep this computer awake.'
& $tailscalePath serve --bg http://127.0.0.1:5173
if ($LASTEXITCODE -ne 0) { throw 'Tailscale Serve was not enabled. Follow its HTTPS setup link, then run this command again.' }
$logDirectory = Join-Path (Get-Location) '.deploy-test'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$apiProcess = Start-Process -FilePath 'node' -ArgumentList '--env-file=.env','--import','tsx','server/index.ts' -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'remote-api.log') -RedirectStandardError (Join-Path $logDirectory 'remote-api-error.log')
try { & node node_modules/vite/bin/vite.js --configLoader runner }
finally {
 if (!$apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id }
 & $tailscalePath serve --https=443 off
}
