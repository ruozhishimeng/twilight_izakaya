import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runSimulator(args) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/simulate-narrative.ts', ...args],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
}

test('narrative simulator CLI reports real scheduled coverage and exits zero', () => {
  const result = runSimulator([]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /10 visits, 74 paths, 74 end visits/);
  assert.match(result.stdout, /27 recovered-retry paths \(30 retry actions\)/);
  assert.match(result.stdout, /availability=all-items/);
});

test('narrative simulator CLI keeps parse errors machine-readable with --json', () => {
  const result = runSimulator(['--json', '--start', 'missing']);

  assert.equal(result.status, 2);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: '--start requires --guest',
    kind: 'usage',
  });
});

test('narrative simulator CLI fails closed on path explosion', () => {
  const result = runSimulator([
    '--json',
    '--guest', 'aqiang',
    '--start', 'aqiang_001_dialogue_main',
    '--max-paths', '1',
  ]);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(report.summary.failedVisitCount, 1);
  assert.equal(report.summary.issueCount, 1);
  assert.equal(report.visits[0].issues[0].code, 'SIMULATION_FAILED');
});

test('narrative simulator CLI exposes the no-items availability scenario', () => {
  const result = runSimulator(['--json', '--day', 'W1_D3', '--no-items']);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(report.scenario, {
    optionAvailability: 'items',
    availableItemIds: [],
  });
  assert.equal(report.summary.issueCount, 0);
});
