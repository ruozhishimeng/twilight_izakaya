import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { test } from 'node:test';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const launcherName of ['twilight_izakaya_launcher.ps1', '黄昏居酒屋.ps1']) {
  test(`${launcherName} forwards the selected backend URL to the Vite proxy`, () => {
    const source = fs.readFileSync(path.join(projectRoot, launcherName), 'utf8');
    assert.match(source, /VITE_BACKEND_TARGET='\$backendUrl'/);
    assert.match(source, /\$backendCommand[\s\S]*\$frontendCommand/);
  });
}

test(
  'Node environment repair tolerates missing drives under stop-on-error mode',
  { skip: process.platform !== 'win32' },
  () => {
    const scriptPath = path.join(projectRoot, 'scripts', 'ensure-node-env.ps1');
    const escapedScriptPath = scriptPath.replaceAll("'", "''");
    const command = [
      "$ErrorActionPreference = 'Stop'",
      '$missingDrive = (68..90 | ForEach-Object { [char]$_ } | Where-Object { -not (Get-PSDrive -Name $_ -ErrorAction SilentlyContinue) } | Select-Object -First 1)',
      "if (-not $missingDrive) { throw 'No unused drive letter is available for the launcher regression test.' }",
      '$missingCandidate = "${missingDrive}:\\__twilight_missing_node__"',
      '$env:LOCALAPPDATA = $missingCandidate',
      '$env:SystemRoot = $missingCandidate',
      `. '${escapedScriptPath}'`,
      'if (Test-TwilightNodeDirectory -Candidate $missingCandidate) { exit 2 }',
    ].join('; ');

    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);
