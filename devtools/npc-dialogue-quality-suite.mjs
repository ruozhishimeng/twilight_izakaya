import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import express from 'express';
import dotenv from 'dotenv';
import { registerNpcDialogueRoute } from '../server/npcDialogue/route.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

dotenv.config({ path: join(projectRoot, '.env') });

function loadCases(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`测试用例文件不存在: ${filePath}`);
  }

  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
    server.once('error', reject);
  });
}

function compactNpcReply(replyLines) {
  return replyLines
    .filter(line => typeof line === 'string' && line.trim())
    .filter(line => !/^[（(].*[）)]$/.test(line.trim()))
    .join('')
    .trim() || replyLines.join('');
}

async function postDialogue(url, payload) {
  const startedAt = Date.now();
  const response = await fetch(`${url}/api/npc-dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body,
  };
}

async function runCase(url, testCase) {
  const transcript = [...(testCase.baseRequest.recentTranscript || [])];
  let turnIndex = testCase.baseRequest.turnIndex || 1;
  const turnResults = [];

  for (const turn of testCase.turns) {
    const request = {
      ...testCase.baseRequest,
      ...turn.requestPatch,
      playerText: turn.playerText,
      recentTranscript: transcript.slice(-8),
      turnIndex,
    };

    const result = await postDialogue(url, request);
    turnResults.push({
      id: turn.id,
      intent: turn.intent,
      playerText: turn.playerText,
      status: result.status,
      ok: result.ok,
      durationMs: result.durationMs,
      replyLines: result.body?.replyLines || [],
      mood: result.body?.mood || null,
      endChat: result.body?.endChat ?? null,
      provider: result.body?.usage?.provider || null,
      error: result.body?.error || null,
    });

    if (result.ok && Array.isArray(result.body?.replyLines)) {
      transcript.push({ speaker: '酒保', text: turn.playerText });
      transcript.push({
        speaker: testCase.baseRequest.guestName,
        text: compactNpcReply(result.body.replyLines),
      });
      turnIndex += 1;
    }
  }

  return {
    id: testCase.id,
    title: testCase.title,
    coverage: testCase.coverage,
    turns: turnResults,
  };
}

function printSummary(results) {
  for (const result of results) {
    console.log(`\n## ${result.id} - ${result.title}`);
    console.log(`覆盖: ${result.coverage}`);

    for (const turn of result.turns) {
      console.log(`\n[${turn.id}] ${turn.intent}`);
      console.log(`玩家: ${turn.playerText}`);
      if (!turn.ok) {
        console.log(`失败: HTTP ${turn.status} ${turn.error || ''}`.trim());
        continue;
      }

      console.log(`NPC(${turn.mood}, ${turn.provider}, ${turn.durationMs}ms):`);
      for (const line of turn.replyLines) {
        console.log(`- ${line}`);
      }
    }
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      cases: { type: 'string', short: 'c' },
    },
  });
  const casesPath = values.cases
    ? join(process.cwd(), values.cases)
    : join(__dirname, 'npc-dialogue-quality-cases.json');
  const cases = loadCases(casesPath);
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerNpcDialogueRoute(app);
  const runtime = await listen(app);

  try {
    const results = [];
    for (const testCase of cases) {
      results.push(await runCase(runtime.url, testCase));
    }

    printSummary(results);

    const outputDir = join(__dirname, 'debug-output');
    mkdirSync(outputDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    const outputPath = join(outputDir, `npc-dialogue-quality-${timestamp}.json`);
    writeFileSync(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      casesPath,
      results,
    }, null, 2), 'utf-8');
    console.log(`\n结果已写入: ${outputPath}`);
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
