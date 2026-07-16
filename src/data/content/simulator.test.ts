import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadContentSourceFromFs } from '../../../scripts/loadContentFromFs';
import { normalizeContentRegistry } from './normalizer';
import {
  hasRecoveredMixingRetry,
  selectNarrativeSimulationTargets,
  simulateNarrativeRegistry,
} from './simulator';

const registry = normalizeContentRegistry(loadContentSourceFromFs());

test('real scheduled visits terminate or enter an intentional teaching retry', () => {
  const report = simulateNarrativeRegistry(registry);

  assert.equal(report.summary.visitCount, 10);
  assert.equal(report.summary.issueCount, 0);
  assert.equal(report.summary.unexpectedLoopCount, 0);
  assert.equal(report.summary.stepLimitCount, 0);
  assert.ok(report.summary.endVisitCount > 0);
  assert.ok(report.summary.recoveredRetryPathCount > 0);
  assert.ok(report.summary.mixingRetryActionCount >= report.summary.recoveredRetryPathCount);
  assert.ok(report.visits.every(visit => visit.pathStats.endVisit > 0));
  assert.ok(report.visits.flatMap(visit => visit.paths)
    .filter(hasRecoveredMixingRetry)
    .every(path => path.terminal === 'end_visit'));
});

test('Aqiang W1_D3 enumerates every choice and mixing result to end_visit', () => {
  const report = simulateNarrativeRegistry(registry, {
    guestId: 'aqiang',
    startNodeId: 'aqiang_001_dialogue_main',
  });
  const visit = report.visits[0]!;

  assert.equal(report.summary.issueCount, 0);
  assert.equal(visit.pathCount, 8);
  assert.equal(visit.pathStats.endVisit, 8);
  assert.equal(visit.pathStats.recoveredRetryPaths, 0);
  assert.deepEqual(
    new Set(visit.paths.flatMap(path => path.trace.map(entry => entry.action))
      .filter(action => action.startsWith('mixing_'))),
    new Set(['mixing_success', 'mixing_fail']),
  );
});

test('simulation target selection preserves schedule order and rejects invalid filters', () => {
  const dayTargets = selectNarrativeSimulationTargets(registry, { day: 'W1_D3' });
  assert.deepEqual(dayTargets.map(target => target.guestId), ['fox_uncle', 'aqiang']);

  assert.throws(
    () => selectNarrativeSimulationTargets(registry, { startNodeId: 'aqiang_001_dialogue_main' }),
    /--start requires --guest/,
  );
  assert.throws(
    () => selectNarrativeSimulationTargets(registry, { day: 'W99_D99' }),
    /no narrative simulation target matches day=W99_D99/,
  );

  const noItemsReport = simulateNarrativeRegistry(registry, {
    day: 'W1_D3',
    availableItemIds: [],
  });
  assert.deepEqual(noItemsReport.scenario, {
    optionAvailability: 'items',
    availableItemIds: [],
  });
  assert.equal(noItemsReport.summary.issueCount, 0);
});
