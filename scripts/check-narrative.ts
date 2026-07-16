import { analyzeNarrativeGraph, type NarrativeDiagnostic } from '../src/data/content/graph';
import { normalizeContentRegistry } from '../src/data/content/normalizer';
import { loadContentSourceFromFs } from './loadContentFromFs';

const jsonOutput = process.argv.slice(2).includes('--json');

function summarize(diagnostics: NarrativeDiagnostic[], guestCount: number, scheduledEntryCount: number) {
  return {
    guestCount,
    scheduledEntryCount,
    errorCount: diagnostics.filter(diagnostic => diagnostic.severity === 'error').length,
    warningCount: diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length,
  };
}

function diagnosticLocation(diagnostic: NarrativeDiagnostic) {
  const parts = [diagnostic.guestId, diagnostic.nodeId].filter(Boolean);
  return parts.length > 0 ? ` [${parts.join('/')}]` : '';
}

try {
  const registry = normalizeContentRegistry(loadContentSourceFromFs());
  const analysis = analyzeNarrativeGraph(registry);
  const summary = summarize(
    analysis.diagnostics,
    registry.guests.length,
    analysis.scheduledEntries.length,
  );

  if (jsonOutput) {
    console.log(JSON.stringify({ summary, ...analysis }, null, 2));
  } else {
    console.log(
      `[narrative:check] ${summary.guestCount} guests, ${summary.scheduledEntryCount} scheduled entries, ` +
      `${summary.errorCount} errors, ${summary.warningCount} warnings`,
    );
    analysis.diagnostics.forEach(diagnostic => {
      console.log(
        `${diagnostic.severity.toUpperCase()} ${diagnostic.code}` +
        `${diagnosticLocation(diagnostic)} ${diagnostic.message}`,
      );
    });
  }

  if (summary.errorCount > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  const diagnostic: NarrativeDiagnostic = {
    code: 'NARRATIVE_CHECK_FAILED',
    severity: 'error',
    guestId: null,
    nodeId: null,
    message: error instanceof Error ? error.message : String(error),
  };
  const summary = summarize([diagnostic], 0, 0);

  if (jsonOutput) {
    console.log(JSON.stringify({ summary, diagnostics: [diagnostic], scheduledEntries: [] }, null, 2));
  } else {
    console.error(`[narrative:check] failed\nERROR ${diagnostic.code} ${diagnostic.message}`);
  }
  process.exitCode = 1;
}
