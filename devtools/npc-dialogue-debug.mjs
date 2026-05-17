import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import dotenv from 'dotenv';

// Load .env from project root (one level up from devtools/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

// Import production modules
import { validateNpcDialogueRequest } from '../server/npcDialogue/schema.mjs';
import { buildMiniMaxNpcDialogueMessages } from '../server/npcDialogue/promptBuilder.mjs';
import { requestMiniMaxNpcDialogue } from '../server/npcDialogue/provider.mjs';
import { buildMockNpcDialogueResponse } from '../server/npcDialogue/mock.mjs';

// ============================================================
// Parsing functions replicated from server/npcDialogue/route.mjs
// (route.mjs does not export these, so we keep a copy here)
// ============================================================

const ALLOWED_MOODS = new Set(['steady', 'warm', 'guarded', 'awkward', 'cryptic', 'nostalgic']);

function deriveGuestType(guestId) {
  if (guestId === 'fox_uncle') return '鬼神 (ghost)';
  if (guestId === 'aqiang' || guestId === 'yuki') return '迷失者 (lost_soul)';
  return '未知 (unknown)';
}

function stripCodeFence(content) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonCandidate(content) {
  const stripped = stripCodeFence(content);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }

  return stripped;
}

function fallbackPlainDialogue(content) {
  const stripped = stripCodeFence(content);

  if (!stripped || stripped.length > 120) {
    return null;
  }

  if (stripped.includes('{') || stripped.includes('}')) {
    return null;
  }

  return {
    replyLines: [stripped],
    mood: 'steady',
    endChat: false,
  };
}

function splitActionAndSpeech(line) {
  const trimmed = typeof line === 'string' ? line.trim() : '';
  if (!trimmed) {
    return [];
  }

  const match = trimmed.match(/^[（(]([^）)]+)[）)]\s*(.+)$/);
  if (!match) {
    return [trimmed];
  }

  const action = `（${match[1].trim()}）`;
  const speech = match[2].trim();
  return speech ? [action, speech] : [action];
}

function normalizeReplyLines(lines) {
  const normalized = [];

  for (const line of lines) {
    normalized.push(...splitActionAndSpeech(line));
  }

  return normalized.filter(Boolean);
}

function parseModelOutput(content) {
  const candidate = extractJsonCandidate(content);

  try {
    return { path: 'json_parse', data: JSON.parse(candidate) };
  } catch {
    const fallback = fallbackPlainDialogue(content);
    if (fallback) {
      fallback.replyLines = normalizeReplyLines(fallback.replyLines);
      console.warn('[debug] model returned plain dialogue, normalized into replyLines.');
      return { path: 'fallback_plain', data: fallback };
    }

    console.error('[debug] invalid model output:', content);
    return { path: 'error', error: '模型返回格式无效。' };
  }
}

function validateNpcDialogueResponse(value) {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: '模型返回结构无效。' };
  }

  const replyLines = Array.isArray(value.replyLines)
    ? normalizeReplyLines(
        value.replyLines.map(line => (typeof line === 'string' ? line.trim() : '')).filter(Boolean),
      )
    : null;

  if (!replyLines || replyLines.length < 1 || replyLines.length > 5) {
    return { ok: false, error: '模型返回的 replyLines 数量无效。' };
  }

  if (replyLines.join('').length > 120) {
    return { ok: false, error: '模型返回内容过长。' };
  }

  if (!ALLOWED_MOODS.has(value.mood)) {
    return { ok: false, error: '模型返回的 mood 无效。' };
  }

  if (typeof value.endChat !== 'boolean') {
    return { ok: false, error: '模型返回的 endChat 无效。' };
  }

  return {
    ok: true,
    value: {
      replyLines,
      mood: value.mood,
      endChat: value.endChat,
    },
  };
}

// ============================================================
// Debug output helpers
// ============================================================

const SEP = '══════════════════════════════════════════════';

function printStep(step, title) {
  console.log(`\n${SEP}`);
  console.log(`  STEP ${step}: ${title}`);
  console.log(SEP);
}

function printSub(label, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'object') {
    console.log(`  ${label}:`);
    for (const [k, v] of Object.entries(value)) {
      if (k === 'content' && typeof v === 'string' && v.length > 200) {
        console.log(`    ${k}: (${v.length} chars, shown below)`);
      } else if (typeof v === 'object') {
        console.log(`    ${k}: ${JSON.stringify(v)}`);
      } else {
        console.log(`    ${k}: ${v}`);
      }
    }
  } else {
    console.log(`  ${label}: ${value}`);
  }
}

// ============================================================
// Scenarios
// ============================================================

function loadScenario(name) {
  const scenariosDir = join(__dirname, 'debug-scenarios');
  const filePath = join(scenariosDir, `${name}.json`);

  if (!existsSync(filePath)) {
    console.error(`场景 "${name}" 不存在: ${filePath}`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function loadScenarioFromPath(filePath) {
  if (!existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }

  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function listScenarios() {
  const scenariosDir = join(__dirname, 'debug-scenarios');

  if (!existsSync(scenariosDir)) {
    console.log('暂无可用场景。');
    return;
  }

  const files = readdirSync(scenariosDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('暂无可用场景。');
    return;
  }

  console.log('\n可用调试场景:\n');
  for (const file of files) {
    const name = file.replace('.json', '');
    try {
      const scenario = JSON.parse(readFileSync(join(scenariosDir, file), 'utf-8'));
      console.log(`  ${name}`);
      console.log(`    guestName: ${scenario.guestName}`);
      console.log(`    playerText: ${scenario.playerText}`);
    } catch {
      console.log(`  ${name}  (解析失败)`);
    }
  }

  console.log(`\n使用方式: node devtools/npc-dialogue-debug.mjs --scenario <name>`);
  console.log(`添加 --mock 使用本地模拟数据，不调用 API。`);
}

// ============================================================
// Save debug record
// ============================================================

function saveDebugRecord(record) {
  const outputDir = join(__dirname, 'debug-output');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `${record.runId}.json`;
  const filePath = join(outputDir, fileName);

  writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  console.log(`\n📁 调试记录已保存: devtools/debug-output/${fileName}`);
}

// ============================================================
// Main debug flow
// ============================================================

async function runDebug(scenario, useMock) {
  const now = new Date();
  const runId = `${now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}-${scenario.guestId}`;
  const debugRecord = {
    runId,
    timestamp: now.toISOString(),
    scenario: `${scenario.guestId} (${scenario.guestName})`,
    mode: useMock ? 'mock' : 'live',
    step1_validation: null,
    step2_prompt: null,
    step3_api: null,
    step4_parsing: null,
    step5_validation: null,
  };

  // ---- STEP 1: Load & Validate ----
  printStep(1, '输入验证');

  const validation = validateNpcDialogueRequest(scenario);
  debugRecord.step1_validation = validation;

  if (!validation.ok) {
    console.log(`❌ 场景验证失败: ${validation.error}`);
    saveDebugRecord(debugRecord);
    return;
  }

  console.log('✅ 场景验证通过\n');
  const v = validation.value;
  console.log(`  guestId:       ${v.guestId}`);
  console.log(`  guestType:     ${deriveGuestType(v.guestId)}`);
  console.log(`  guestName:     ${v.guestName}`);
  console.log(`  guestProfile:`);
  console.log(`    identity:    ${v.guestProfile.identity}`);
  console.log(`    personality: ${v.guestProfile.personality}`);
  console.log(`    description: ${v.guestProfile.description}`);
  console.log(`  playerText:    ${v.playerText}`);
  console.log(`  week/day:      ${v.week}/${v.day} (guest #${v.guestInDay})`);
  console.log(`  currentNodeId: ${v.currentNodeId}`);
  console.log(`  observedFeatures: [${v.observedFeatures.join(', ') || '无'}]`);
  console.log(`  recentTranscript: ${v.recentTranscript.length} entries`);
  console.log(`  lastDrink:     ${v.lastDrink ? `${v.lastDrink.label} (${v.lastDrink.isSuccess ? '成功' : '失败'})` : '无'}`);
  console.log(`  turnIndex:     ${v.turnIndex}`);

  // ---- STEP 2: Build Prompt ----
  printStep(2, 'Prompt 构建');

  const promptPayload = buildMiniMaxNpcDialogueMessages(v);
  debugRecord.step2_prompt = promptPayload;

  console.log(`📋 共构建 ${promptPayload.messages.length} 条 messages, promptChars=${promptPayload.promptChars}\n`);

  for (let i = 0; i < promptPayload.messages.length; i++) {
    const msg = promptPayload.messages[i];
    console.log(`[${i + 1}] role=${msg.role}${msg.name ? `, name=${msg.name}` : ''}`);
    console.log(`    内容: ${msg.content}`);
    console.log(`    (${msg.content.length} chars)\n`);
  }

  // ---- STEP 3: Call API / Mock ----
  printStep(3, useMock ? '本地 Mock 调用' : `API 调用 (minimax:${process.env.MINIMAX_MODEL?.trim() || 'MiniMax-M2.5'})`);

  let providerResult;
  const apiStartMs = Date.now();

  if (useMock) {
    const mockResponse = buildMockNpcDialogueResponse(v);
    // Wrap mock result to match live API shape: { content, usage }
    providerResult = {
      content: JSON.stringify({
        replyLines: mockResponse.replyLines,
        mood: mockResponse.mood,
        endChat: mockResponse.endChat,
      }),
      usage: mockResponse.usage,
    };
    debugRecord.step3_api = {
      mode: 'mock',
      durationMs: 0,
      rawText: providerResult.content,
      content: providerResult.content,
      usage: providerResult.usage,
    };

    console.log('🔧 使用本地 Mock（不调用 API）\n');
    console.log('📝 Mock 原始返回:');
    console.log(providerResult.content);
    console.log(`\n📊 模拟用量: promptChars=${providerResult.usage.promptChars}, completionChars=${providerResult.usage.completionChars}`);
  } else {
    try {
      providerResult = await requestMiniMaxNpcDialogue(promptPayload);
      const durationMs = Date.now() - apiStartMs;
      debugRecord.step3_api = {
        mode: 'live',
        durationMs,
        rawText: providerResult.content,
        content: providerResult.content,
        usage: providerResult.usage,
      };

      console.log(`⏱️  耗时: ${(durationMs / 1000).toFixed(1)}s`);
      console.log('\n📝 原始返回:');
      console.log(providerResult.content);
      console.log(`\n📊 Token 用量: prompt=${providerResult.usage.promptTokens ?? '?'}, completion=${providerResult.usage.completionTokens ?? '?'}, total=${providerResult.usage.totalTokens ?? '?'}`);
    } catch (error) {
      debugRecord.step3_api = {
        mode: 'live',
        durationMs: Date.now() - apiStartMs,
        error: error.message,
      };
      console.log(`❌ API 调用失败: ${error.message}`);
      saveDebugRecord(debugRecord);
      return;
    }
  }

  // ---- STEP 4: Parse Output ----
  printStep(4, '输出解析');

  const parseResult = parseModelOutput(providerResult.content);
  debugRecord.step4_parsing = parseResult;

  if (parseResult.path === 'error') {
    console.log(`❌ 解析失败: ${parseResult.error}`);
    saveDebugRecord(debugRecord);
    return;
  }

  console.log(`🔧 解析路径: ${parseResult.path === 'json_parse' ? 'JSON.parse ✅' : 'fallback_plain ⚠️'}\n`);

  const stripped = stripCodeFence(providerResult.content);
  console.log('stripCodeFence 后:');
  console.log(stripped);
  console.log();

  const candidate = extractJsonCandidate(providerResult.content);
  if (candidate !== stripped) {
    console.log('extractJsonCandidate 提取:');
    console.log(candidate);
    console.log();
  }

  console.log('解析结果:');
  console.log(JSON.stringify(parseResult.data, null, 2));

  // ---- STEP 5: Validate Response ----
  printStep(5, '响应验证');

  const responseValidation = validateNpcDialogueResponse(parseResult.data);
  debugRecord.step5_validation = responseValidation;

  if (!responseValidation.ok) {
    console.log(`❌ 响应验证失败: ${responseValidation.error}`);
    saveDebugRecord(debugRecord);
    return;
  }

  console.log('✅ 响应验证通过\n');

  const rv = responseValidation.value;
  console.log(`  replyLines (${rv.replyLines.length}条):`);
  for (let i = 0; i < rv.replyLines.length; i++) {
    console.log(`    ${i + 1}. "${rv.replyLines[i]}"`);
  }
  console.log(`  mood:     ${rv.mood}`);
  console.log(`  endChat:  ${rv.endChat}`);

  // ---- Save ----
  saveDebugRecord(debugRecord);
}

// ============================================================
// Interactive mode
// ============================================================

const INTERACTIVE_HELP = `
可用命令:
  /quit, /q    退出交互模式
  /debug       切换完整 prompt 展示
  /save <name> 保存当前对话记录到 debug-scenarios/

直接输入文字 = 玩家对 NPC 说这句话。
`.trim();

async function runInteractive(baseScenario, useMock) {
  const validation = validateNpcDialogueRequest(baseScenario);
  if (!validation.ok) {
    console.log(`❌ 场景验证失败: ${validation.error}`);
    return;
  }

  const ctx = validation.value;

  // Clear screen and show intro
  console.clear();
  console.log('╔══════════════════════════════╗');
  console.log('║   《黄昏居酒屋》对话调试终端  ║');
  console.log('╚══════════════════════════════╝');
  console.log(`\n  你正在和 ${ctx.guestName} 对话。`);
  console.log(`  类型: ${deriveGuestType(ctx.guestId)}`);
  console.log(`  输入文字开始交谈，/quit 退出。\n`);
  console.log(`  📋 ${ctx.guestProfile.identity}`);
  console.log(`  🍸 ${ctx.lastDrink ? `最近一杯：${ctx.lastDrink.label} (${ctx.lastDrink.isSuccess ? '成功' : '失败'})` : '尚未调酒'}`);
  console.log('');

  let turnIndex = ctx.turnIndex;
  let recentTranscript = [...ctx.recentTranscript];
  let showDebug = false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n🧑 你: ',
  });

  rl.on('SIGINT', () => {
    console.log('\n\n👋 对话结束。');
    rl.close();
    process.exit(0);
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      continue;
    }

    // Handle commands
    if (input === '/quit' || input === '/q') {
      console.log('\n👋 对话结束。');
      rl.close();
      break;
    }

    if (input === '/debug') {
      showDebug = !showDebug;
      console.log(`\n🔧 完整 prompt 展示: ${showDebug ? '开' : '关'}`);
      rl.prompt();
      continue;
    }

    if (input.startsWith('/save ')) {
      const saveName = input.slice(6).trim();
      if (!saveName) {
        console.log('\n用法: /save <name>');
        rl.prompt();
        continue;
      }
      const saveData = { ...baseScenario, playerText: baseScenario.playerText, recentTranscript, turnIndex };
      const savePath = join(__dirname, 'debug-scenarios', `${saveName}.json`);
      writeFileSync(savePath, JSON.stringify(saveData, null, 2), 'utf-8');
      console.log(`\n💾 场景已保存: debug-scenarios/${saveName}.json`);
      rl.prompt();
      continue;
    }

    if (input.startsWith('/')) {
      console.log(`\n未知命令: ${input}`);
      console.log(INTERACTIVE_HELP);
      rl.prompt();
      continue;
    }

    // Truncate input to 60 chars (schema limit)
    const playerText = input.length > 60 ? input.slice(0, 60) : input;

    // Build turn payload
    const turnPayload = {
      state: ctx.state,
      guestId: ctx.guestId,
      guestName: ctx.guestName,
      guestProfile: ctx.guestProfile,
      playerText,
      week: ctx.week,
      day: ctx.day,
      guestInDay: ctx.guestInDay,
      currentNodeId: ctx.currentNodeId,
      observedFeatures: ctx.observedFeatures,
      recentTranscript,
      lastDrink: ctx.lastDrink,
      turnIndex,
    };

    const promptPayload = buildMiniMaxNpcDialogueMessages(turnPayload);

    if (showDebug) {
      console.log(`\n${SEP}`);
      console.log('  DEBUG: Full Prompt');
      console.log(SEP);
      for (let i = 0; i < promptPayload.messages.length; i++) {
        const msg = promptPayload.messages[i];
        console.log(`\n[${i + 1}] role=${msg.role}${msg.name ? ` name=${msg.name}` : ''}`);
        console.log(msg.content);
      }
      console.log(`\n${SEP}\n`);
    }

    let providerResult;
    if (useMock) {
      const mockResponse = buildMockNpcDialogueResponse(turnPayload);
      providerResult = {
        content: JSON.stringify({
          replyLines: mockResponse.replyLines,
          mood: mockResponse.mood,
          endChat: mockResponse.endChat,
        }),
        usage: mockResponse.usage,
      };
    } else {
      providerResult = await requestMiniMaxNpcDialogue(promptPayload);
    }

    const parseResult = parseModelOutput(providerResult.content);
    if (parseResult.path === 'error') {
      console.log(`\n⚠️  解析失败: ${parseResult.error}`);
      rl.prompt();
      continue;
    }

    const responseValidation = validateNpcDialogueResponse(parseResult.data);
    if (!responseValidation.ok) {
      console.log(`\n⚠️  响应验证失败: ${responseValidation.error}`);
      console.log(`  原始返回: ${providerResult.content}`);
      rl.prompt();
      continue;
    }

    const rv = responseValidation.value;

    // Print NPC response
    console.log(`\n👤 ${ctx.guestName}:`);
    for (const line of rv.replyLines) {
      if (line.startsWith('（') || line.startsWith('(')) {
        console.log(`  \x1b[2m${line}\x1b[0m`); // dim for actions
      } else {
        console.log(`  ${line}`);
      }
    }
    console.log(`  \x1b[2m[${rv.mood}]${rv.endChat ? ' [结束]' : ''}\x1b[0m`);

    // Append to transcript
    recentTranscript.push({ speaker: '酒保', text: playerText });
    recentTranscript.push({ speaker: ctx.guestName, text: rv.replyLines.filter(l => !l.startsWith('（') && !l.startsWith('(')).join('') || rv.replyLines[0] });
    recentTranscript = recentTranscript.slice(-8);
    turnIndex++;

    rl.prompt();
  }
}

// ============================================================
// Entry
// ============================================================

async function main() {
  const { values } = parseArgs({
    options: {
      scenario: { type: 'string', short: 's' },
      file: { type: 'string', short: 'f' },
      mock: { type: 'boolean', short: 'm' },
      list: { type: 'boolean', short: 'l' },
      interactive: { type: 'boolean', short: 'i' },
    },
    strict: true,
  });

  if (values.list) {
    listScenarios();
    return;
  }

  let scenario;

  if (values.file) {
    scenario = loadScenarioFromPath(values.file);
  } else if (values.scenario) {
    scenario = loadScenario(values.scenario);
  } else {
    console.log('用法: node devtools/npc-dialogue-debug.mjs --scenario <name> [--mock] [--interactive]');
    console.log('      node devtools/npc-dialogue-debug.mjs --file <path.json> [--mock]');
    console.log('      node devtools/npc-dialogue-debug.mjs --list');
    console.log('\n提示: 使用 --list 查看所有可用场景。');
    console.log('      使用 --interactive 或 -i 进入交互对话模式。');
    process.exit(1);
  }

  if (values.interactive) {
    await runInteractive(scenario, values.mock || false);
  } else {
    await runDebug(scenario, values.mock || false);
  }
}

main().catch(error => {
  console.error('调试脚本执行失败:', error);
  process.exit(1);
});
