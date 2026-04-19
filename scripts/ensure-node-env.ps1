Set-StrictMode -Version Latest

function Repair-TwilightNodeEnvironment {
  $userProfile = $env:USERPROFILE
  if ([string]::IsNullOrWhiteSpace($userProfile) -and -not [string]::IsNullOrWhiteSpace($env:USERNAME)) {
    $userProfile = Join-Path 'C:\Users' $env:USERNAME
  }

  $windowsRoot = if ([string]::IsNullOrWhiteSpace($env:SystemRoot)) { 'C:\Windows' } else { $env:SystemRoot }
  $applicationData = [Environment]::GetFolderPath('ApplicationData')
  $localApplicationData = [Environment]::GetFolderPath('LocalApplicationData')

  $repairs = [ordered]@{
    SystemRoot = $windowsRoot
    windir = $windowsRoot
    ComSpec = Join-Path $windowsRoot 'System32\cmd.exe'
    APPDATA = $applicationData
    LOCALAPPDATA = $localApplicationData
  }

  if (-not [string]::IsNullOrWhiteSpace($userProfile) -and $userProfile.Length -ge 3 -and $userProfile[1] -eq ':') {
    $repairs.HOMEDRIVE = $userProfile.Substring(0, 2)
    $repairs.HOMEPATH = $userProfile.Substring(2)
  }

  foreach ($entry in $repairs.GetEnumerator()) {
    if (
      -not [string]::IsNullOrWhiteSpace($entry.Value) -and
      [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($entry.Key, 'Process'))
    ) {
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
  }

  $nodeCandidates = @(
    'C:\Program Files\nodejs',
    'E:\Program Files\nodejs'
  )

  $resolvedLocalAppData = [Environment]::GetEnvironmentVariable('LOCALAPPDATA', 'Process')
  if (-not [string]::IsNullOrWhiteSpace($resolvedLocalAppData)) {
    $nodeCandidates += Join-Path $resolvedLocalAppData 'Programs\nodejs'
  }

  $pathEntries = @()
  if (-not [string]::IsNullOrWhiteSpace($env:PATH)) {
    $pathEntries = $env:PATH -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  $resolvedNodeDir = $nodeCandidates |
    Where-Object { Test-Path (Join-Path $_ 'node.exe') } |
    Select-Object -First 1

  if ($resolvedNodeDir -and -not ($pathEntries -contains $resolvedNodeDir)) {
    $env:PATH = ($resolvedNodeDir + ';' + ($pathEntries -join ';')).Trim(';')
  }
}

Repair-TwilightNodeEnvironment
