Set-StrictMode -Version Latest

function Test-TwilightNodeDirectory {
  param([AllowEmptyString()][string]$Candidate)

  if ([string]::IsNullOrWhiteSpace($Candidate)) {
    return $false
  }

  try {
    $nodeExecutable = [System.IO.Path]::Combine($Candidate, 'node.exe')
    return [System.IO.File]::Exists($nodeExecutable)
  } catch {
    return $false
  }
}

function Repair-TwilightNodeEnvironment {
  $userProfile = $env:USERPROFILE
  if ([string]::IsNullOrWhiteSpace($userProfile) -and -not [string]::IsNullOrWhiteSpace($env:USERNAME)) {
    $userProfile = [System.IO.Path]::Combine('C:\Users', $env:USERNAME)
  }

  $windowsRoot = if ([string]::IsNullOrWhiteSpace($env:SystemRoot)) { 'C:\Windows' } else { $env:SystemRoot }
  $applicationData = [Environment]::GetFolderPath('ApplicationData')
  $localApplicationData = [Environment]::GetFolderPath('LocalApplicationData')

  $repairs = [ordered]@{
    SystemRoot = $windowsRoot
    windir = $windowsRoot
    ComSpec = [System.IO.Path]::Combine($windowsRoot, 'System32', 'cmd.exe')
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
    try {
      $nodeCandidates += [System.IO.Path]::Combine($resolvedLocalAppData, 'Programs', 'nodejs')
    } catch {}
  }

  $pathEntries = @()
  if (-not [string]::IsNullOrWhiteSpace($env:PATH)) {
    $pathEntries = $env:PATH -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  $resolvedNodeDir = $nodeCandidates |
    Where-Object { Test-TwilightNodeDirectory -Candidate $_ } |
    Select-Object -First 1

  if ($resolvedNodeDir -and -not ($pathEntries -contains $resolvedNodeDir)) {
    $env:PATH = ($resolvedNodeDir + ';' + ($pathEntries -join ';')).Trim(';')
  }
}

Repair-TwilightNodeEnvironment
