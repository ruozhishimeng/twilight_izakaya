$ErrorActionPreference = 'Stop'

# ============================================================
# Twilight Izakaya one-click launcher
# Usage:
# 1. Double-click "黄昏居酒屋.bat", or run it from cmd.
# 2. This script auto-enters the project root.
# 3. It finds free ports, starts frontend and backend, then
#    opens the default browser after both are ready.
# ============================================================

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$frontendHost = '127.0.0.1'
$backendHost = '127.0.0.1'
$preferredFrontendPort = 3000
$preferredBackendPort = 3001

function Test-CommandExists {
  param([string]$CommandName)

  return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Get-FreePort {
  param([int]$StartPort)

  for ($port = $StartPort; $port -le 65535; $port++) {
    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
      $listener.Start()
      $listener.Stop()
      return $port
    } catch {
      if ($listener) {
        try { $listener.Stop() } catch {}
      }
    }
  }

  throw "No free port found starting from $StartPort."
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {}

    Start-Sleep -Seconds 1
  }

  throw "Service did not become ready in time: $Url"
}

if (-not (Test-CommandExists 'npm.cmd')) {
  throw 'npm.cmd was not found. Please install Node.js first.'
}

if (-not (Test-CommandExists 'node.exe')) {
  throw 'node.exe was not found. Please install Node.js first.'
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
  throw 'node_modules not found. Please run npm install first.'
}

$frontendPort = Get-FreePort -StartPort $preferredFrontendPort
$backendPort = Get-FreePort -StartPort ($(if ($frontendPort -eq $preferredBackendPort) { $preferredBackendPort + 1 } else { $preferredBackendPort }))
while ($backendPort -eq $frontendPort) {
  $backendPort = Get-FreePort -StartPort ($backendPort + 1)
}

$frontendUrl = "http://${frontendHost}:$frontendPort"
$backendUrl = "http://${backendHost}:$backendPort"

Write-Host ''
Write-Host "[Twilight Izakaya] Project root: $projectRoot"
Write-Host "[Twilight Izakaya] Frontend: $frontendUrl"
Write-Host "[Twilight Izakaya] Backend : $backendUrl"
Write-Host ''

$backendCommand = "Set-Location '$projectRoot'; `$env:PORT='$backendPort'; `$env:HOST='$backendHost'; node local-backend.mjs"
$frontendCommand = "Set-Location '$projectRoot'; npm.cmd run dev -- --host $frontendHost --port $frontendPort"

Start-Process powershell.exe -WorkingDirectory $projectRoot -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-Command', $backendCommand
) | Out-Null

Start-Process powershell.exe -WorkingDirectory $projectRoot -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-Command', $frontendCommand
) | Out-Null

Write-Host '[Twilight Izakaya] Waiting for backend...'
Wait-HttpReady -Url "$backendUrl/health" -TimeoutSeconds 60

Write-Host '[Twilight Izakaya] Waiting for frontend...'
Wait-HttpReady -Url $frontendUrl -TimeoutSeconds 90

Write-Host '[Twilight Izakaya] All services are ready. Opening browser...'
Start-Process $frontendUrl | Out-Null
Write-Host '[Twilight Izakaya] Done.'
