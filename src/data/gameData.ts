export interface Feature {
  id: string;
  name: string;
  type: 'status' | 'experience' | 'trait';
  desc: string;
  x: number;
  y: number;
  group?: string;
}

export interface DialogueOption {
  option: string;        // 按钮文本
  text: string;          // 显示文本
  branchType: 'flavor' | 'plot' | null;
  condition?: { need_item: string; locked_text: string };
  scriptFlow?: { type: string; content: string[] }[];  // NPC 回应
  nextNode?: string;
  fallbackNode?: string;
  impactLog?: string;
  triggerEvent?: string;
}

export interface GuestPhase {
  enterDesc: string;
  intro: string;
  turns: DialogueOption[][];
  idealDrink?: {
    base: string;
    addons: string[];
  };
  successMsg?: string;
  failMsg?: string;
  teaching?: {
    introduction: string;
    recipe: {
      id: string;
      name: string;
      formula: string[];
      steps: string[];
    };
    tip: string;
  };
  reactionNode?: any; // 保存 reaction 节点，用于调酒成功后的对话
  rewardNode?: any; // 保存 reward 节点
  evalBranches?: { most_loved?: string; generally_liked?: string; fail?: string }; // 调酒结果路由
  drinkRequest?: any; // 保存完整 drink_request 数据
}

export interface Guest {
  id: string;
  name: string;
  imagePlaceholderColor: string;
  avatarColor: string;
  image: string;
  expressions: Record<string, string>;
  features: Feature[];
  correctFeatures: string[];
  phases: GuestPhase[];
  type: 'Regular Customer' | 'Lost Soul' | 'Ghost';
  meta: any;
  dialogue?: any;
  phase1?: any;
  phase2?: any;
  phase3?: any;
  script?: any;
  startNodeIds: string[];
  nodeMap?: Map<string, any>;
}

import yaml from 'js-yaml';
import recipesData from '../assets/recipes/recipes.json';

// NOTE: Interfaces are defined at the top of the file.

// Load all character YAML files (use ** to support nested folders like regulars/)
const metaFilesRaw = import.meta.glob('../assets/character/**/character_meta.yaml', { eager: true, query: '?raw', import: 'default' });
const nodesMainRaw = import.meta.glob('../assets/character/**/nodes_main.yaml', { eager: true, query: '?raw', import: 'default' });
const nodesTeachingRaw = import.meta.glob('../assets/character/**/nodes_teaching.yaml', { eager: true, query: '?raw', import: 'default' });
const observationsRaw = import.meta.glob('../assets/character/**/observations.yaml', { eager: true, query: '?raw', import: 'default' });
const imageFiles = import.meta.glob('../assets/character/**/media/*.png', { eager: true, query: '?url', import: 'default' });

const parseYamlMap = (rawMap: Record<string, unknown>) => {
  const parsed: Record<string, any> = {};
  Object.keys(rawMap).forEach(key => {
    try {
      const rawContent = rawMap[key];
      if (typeof rawContent !== 'string') {
        return;
      }
      const result = yaml.load(rawContent);
      if (result !== null && result !== undefined) {
        parsed[key] = result;
      }
    } catch (e) {
      console.error('Error parsing YAML:', key, e);
    }
  });
  return parsed;
};

const metaFiles = parseYamlMap(metaFilesRaw);
const nodesMainFiles = parseYamlMap(nodesMainRaw);
const nodesTeachingFiles = parseYamlMap(nodesTeachingRaw);
const observationsFiles = parseYamlMap(observationsRaw);

// Load schedule.yaml
const scheduleRaw = import.meta.glob('../assets/schedule.yaml', { eager: true, query: '?raw', import: 'default' });
const scheduleFiles = parseYamlMap(scheduleRaw);
export interface ScheduleGuest {
  character_id: string;
  start_node: string;
}
export interface ScheduleDay {
  day: string;
  guests: ScheduleGuest[];
}
export interface ScheduleData {
  schedule: ScheduleDay[];
}
export const schedule = scheduleFiles['../assets/schedule.yaml'] as ScheduleData;

const findNode = (ref: string, _charId: string, nodeMap: Map<string, any>) => {
  if (!ref) return null;
  // 直接用 event_id 查找
  if (nodeMap.has(ref)) return nodeMap.get(ref);
  return null;
};

// Helper to process script_flow into env, npc, inner strings
const processScriptFlow = (node: any): { env: string; npc: string; inner: string } => {
  if (!node?.script_flow) {
    // Fallback to legacy fields
    return {
      env: (node?.atmosphere_lines || []).join('\n'),
      npc: (node?.content || node?.npc_talking || []).join('\n\n'),
      inner: (node?.player_inner || []).join('\n\n')
    };
  }
  let env = '', npc = '', inner = '';
  for (const item of node.script_flow) {
    const content = Array.isArray(item.content) ? item.content.join('\n') : (item.content || '');
    if (item.type === 'env') {
      env += (env ? '\n' : '') + content;
    } else if (item.type === 'npc') {
      npc += (npc ? '\n\n' : '') + content;
    } else if (item.type === 'inner') {
      inner += (inner ? '\n\n' : '') + content;
    }
  }
  return { env, npc, inner };
};

const buildPhasesFromNodes = (charId: string, nodes: any[], meta: any): GuestPhase[] => {
  const phases: GuestPhase[] = [];
  const nodeMap = new Map(nodes.map(n => [n.event_id, n]));

  // Find start nodes
  const startNodes = nodes.filter(n =>
    n.event_id === `${charId}_arrival` ||
    n.event_id?.endsWith('_arrival') ||
    n.event_id?.includes('arrival') ||
    (n.trigger_condition && (!n.trigger_condition.need_event || n.trigger_condition.need_event.length === 0))
  );
  // Sort start nodes by time if available
  startNodes.sort((a, b) => {
    const timeA = a.trigger_condition?.need_time || '';
    const timeB = b.trigger_condition?.need_time || '';
    if (timeA && timeB) {
      return timeA.localeCompare(timeB);
    }
    return (a.event_id || '').localeCompare(b.event_id || '');
  });

  for (let i = 0; i < startNodes.length; i++) {
    const startNode = startNodes[i];
    const turns: DialogueOption[][] = [];

    // Use processScriptFlow for text extraction
    const startText = processScriptFlow(startNode);
    let enterDesc = startText.env || "（客人沉默不语）";
    let intro = startText.npc || "（客人沉默不语）";
    if (startText.inner) {
      intro += '\n\n' + startText.inner;
    }
    
    let idealDrink;
    if (startNode.drink_request && startNode.drink_request.preferred_drink?.formula) {
      idealDrink = {
        base: startNode.drink_request.preferred_drink.formula[0] || '',
        addons: startNode.drink_request.preferred_drink.formula.slice(1) || []
      };
    }
    let successMsg = "这杯酒不错。";
    let failMsg = "这酒...不对。";
    let teaching;
    let lastTeachingOrMixingNode: any = null; // Track for finding reactionNode

    let currentNode = startNode;

    // Accumulate intro text if the start node has no options and just goes to next_node
    while (currentNode && (!currentNode.player_options || currentNode.player_options.length === 0) && currentNode.next_node) {
      if (currentNode.teaching) {
        teaching = currentNode.teaching;
        lastTeachingOrMixingNode = currentNode; // Track teaching node
        if (teaching.recipe && teaching.recipe.formula) {
          idealDrink = {
            base: teaching.recipe.formula[0] || '',
            addons: teaching.recipe.formula.slice(1) || []
          };
        }
      }
      // 检查 top-level game_action 或嵌套在 teaching.game_action 里的 game_action
      const gameAction = currentNode.game_action || currentNode.teaching?.game_action;
      if (gameAction && (gameAction.type === 'enter_mixing' || gameAction.action === 'ENTER_MIXING_MODE')) {
        // teaching 节点后，需要继续跟进到 mixing 节点获取 on_mixing_complete
        const mixingNode = findNode(currentNode.next_node, charId, nodeMap);
        if (mixingNode) {
          lastTeachingOrMixingNode = mixingNode;
          break;
        }
      }
      if (currentNode.drink_request && currentNode.drink_request.preferred_drink?.formula) {
        idealDrink = {
          base: currentNode.drink_request.preferred_drink.formula[0] || '',
          addons: currentNode.drink_request.preferred_drink.formula.slice(1) || []
        };
      }
      currentNode = findNode(currentNode.next_node, charId, nodeMap);
      if (currentNode) {
        const nodeText = processScriptFlow(currentNode);
        if (nodeText.env) enterDesc += '\n' + nodeText.env;
        if (nodeText.npc) intro += '\n\n' + nodeText.npc;
        if (nodeText.inner) intro += '\n\n' + nodeText.inner;
      }
    }

    // Now currentNode is either a node with options, a node with drink_request, or null.
    while (currentNode && currentNode.player_options && currentNode.player_options.length > 0) {
      const options: DialogueOption[] = [];
      let nextTurnNode: any = null;

      for (const opt of currentNode.player_options) {
        const replyNode = findNode(opt.next_node, charId, nodeMap);
        let replyText = opt.immediate_response || "";
        let currentReplyNode = replyNode;

        // Process reply script_flow
        let replyScriptFlow: { type: string; content: string[] }[] = [];

        while (currentReplyNode) {
          // Use processScriptFlow for text extraction
          const nodeText = processScriptFlow(currentReplyNode);
          if (nodeText.env) replyText += (replyText ? '\n' : '') + nodeText.env;
          if (nodeText.npc) replyText += (replyText ? '\n\n' : '') + nodeText.npc;
          if (nodeText.inner) replyText += (replyText ? '\n\n' : '') + nodeText.inner;

          // Accumulate script_flow for NPC responses
          if (currentReplyNode.script_flow) {
            replyScriptFlow = [...replyScriptFlow, ...currentReplyNode.script_flow];
          }

          if (currentReplyNode.teaching) {
            teaching = currentReplyNode.teaching;
            if (teaching.recipe && teaching.recipe.formula) {
              idealDrink = {
                base: teaching.recipe.formula[0] || '',
                addons: teaching.recipe.formula.slice(1) || []
              };
            }
          }

          if (currentReplyNode.player_options && currentReplyNode.player_options.length > 0) {
            nextTurnNode = currentReplyNode;
            break;
          }
          if (currentReplyNode.drink_request) {
            if (currentReplyNode.drink_request.preferred_drink?.formula) {
              idealDrink = {
                base: currentReplyNode.drink_request.preferred_drink.formula[0] || '',
                addons: currentReplyNode.drink_request.preferred_drink.formula.slice(1) || []
              };
            }
          }
          if (currentReplyNode.teaching || (currentReplyNode.game_action && (currentReplyNode.game_action.type === 'enter_mixing' || currentReplyNode.game_action.action === 'ENTER_MIXING_MODE'))) {
            break;
          }
          if (!currentReplyNode.next_node) {
            break;
          }
          currentReplyNode = findNode(currentReplyNode.next_node, charId, nodeMap);
        }

        // New format DialogueOption
        options.push({
          option: opt.option || opt.text,  // 按钮文本
          text: opt.text,                   // 显示文本
          branchType: opt.branch_type || null,
          condition: opt.condition,
          scriptFlow: replyScriptFlow.length > 0 ? replyScriptFlow : undefined,
          nextNode: opt.next_node,
          fallbackNode: opt.fallback_node,
          impactLog: opt.impact_log,
          triggerEvent: opt.trigger_event
        });
      }

      turns.push(options);
      currentNode = nextTurnNode;
    }

    if (currentNode) {
      if (currentNode.teaching) {
        teaching = currentNode.teaching;
      }
    }

    // Extract idealDrink from meta if not found in nodes
    if (!idealDrink) {
      if (meta.drinks) {
        const phaseKey = `phase_${i + 1}`;
        const mostLoved = meta.drinks.most_loved?.[phaseKey] || meta.drinks.most_loved?.phase_1;
        if (mostLoved && mostLoved.formula) {
          idealDrink = {
            base: mostLoved.formula[0] || '',
            addons: mostLoved.formula.slice(1) || []
          };
        }
      } else if (meta.drink_request?.preferred_drink?.formula) {
        idealDrink = {
          base: meta.drink_request.preferred_drink.formula[0] || '',
          addons: meta.drink_request.preferred_drink.formula.slice(1) || []
        };
      }
    }

    // Try to find success and fail messages from nodes
    let successNode: any = null;
    let failNode: any = null;
    let reactionNode: any = null; // 保存 reaction 节点用于调酒成功后的对话
    let rewardNode: any = null; // 保存 reward 节点
    let evalBranches: { most_loved?: string; generally_liked?: string; fail?: string } | undefined;
    let drinkRequest: any = undefined;

    if (currentNode) {
      // Extract drink_request and eval_branches
      const drinkReqNode = currentNode.drink_request ? currentNode : (lastTeachingOrMixingNode?.drink_request ? lastTeachingOrMixingNode : null);
      if (drinkReqNode?.drink_request) {
        drinkRequest = drinkReqNode.drink_request;
        evalBranches = drinkReqNode.drink_request.eval_branches;
      }

      const successNodeId = currentNode.on_mixing_complete || lastTeachingOrMixingNode?.on_mixing_complete || currentNode.next_node;
      if (successNodeId) {
        successNode = findNode(successNodeId, charId, nodeMap);
        // 如果 successNode 有 player_options，说明它是 reaction 节点
        if (successNode && successNode.player_options && successNode.player_options.length > 0) {
          reactionNode = successNode;
          // 从 reactionNode 的 next_node 获取 reward 节点
          if (reactionNode.next_node) {
            rewardNode = findNode(reactionNode.next_node, charId, nodeMap);
          }
        }
      }

      const failNodeId = currentNode.on_mixing_fail;
      if (failNodeId) failNode = findNode(failNodeId, charId, nodeMap);
    }

    // Fallback to naming conventions if not found via explicit links
    const phasePrefix = startNode.event_id.split('_')[0]; // e.g. "phase1" or "visit"
    if (!successNode) {
      let successNodeId = `${phasePrefix}_most_loved_success`;
      if (startNode.event_id.startsWith('visit_')) {
        const visitNum = startNode.event_id.split('_')[1];
        successNodeId = `visit_${visitNum}_most_loved_success`;
      }
      successNode = findNode(successNodeId, charId, nodeMap);
      if (!successNode) {
        // Maybe it's named differently, try to find any node ending with most_loved_success for this phase
        const possibleNodes = nodes.filter(n => n.event_id.includes('most_loved_success') && n.event_id.includes(phasePrefix));
        if (possibleNodes.length > 0) successNode = possibleNodes[0];
      }
    }

    if (!failNode) {
      let failNodeId = `${phasePrefix}_regular_success`;
      if (startNode.event_id.startsWith('visit_')) {
        const visitNum = startNode.event_id.split('_')[1];
        failNodeId = `visit_${visitNum}_regular_success`;
      }
      failNode = findNode(failNodeId, charId, nodeMap);
      if (!failNode) {
        const possibleNodes = nodes.filter(n => n.event_id.includes('regular_success') && n.event_id.includes(phasePrefix));
        if (possibleNodes.length > 0) failNode = possibleNodes[0];
      }
    }

    if (successNode) {
      let msg = "";
      let curr = successNode;
      while (curr) {
        const nodeText = processScriptFlow(curr);
        if (nodeText.env) msg += (msg ? '\n' : '') + nodeText.env;
        if (nodeText.npc) msg += (msg ? '\n\n' : '') + nodeText.npc;
        if (nodeText.inner) msg += (msg ? '\n\n' : '') + nodeText.inner;
        if (curr.bartender_reflection) msg += (msg ? '\n\n' : '') + curr.bartender_reflection;
        if (curr.bartender_inner) msg += (msg ? '\n\n' : '') + curr.bartender_inner;

        if (curr.player_options && curr.player_options.length > 0) break;
        if (!curr.next_node) break;
        curr = findNode(curr.next_node, charId, nodeMap);
      }
      if (msg) successMsg = msg;
    }

    if (failNode) {
      let msg = "";
      let curr = failNode;
      while (curr) {
        const nodeText = processScriptFlow(curr);
        if (nodeText.env) msg += (msg ? '\n' : '') + nodeText.env;
        if (nodeText.npc) msg += (msg ? '\n\n' : '') + nodeText.npc;
        if (nodeText.inner) msg += (msg ? '\n\n' : '') + nodeText.inner;
        if (curr.bartender_reflection) msg += (msg ? '\n\n' : '') + curr.bartender_reflection;
        if (curr.bartender_inner) msg += (msg ? '\n\n' : '') + curr.bartender_inner;

        if (curr.player_options && curr.player_options.length > 0) break;
        if (!curr.next_node) break;
        curr = findNode(curr.next_node, charId, nodeMap);
      }
      if (msg) failMsg = msg;
    }

    // For Regular Customer (tired_salaryman, etc.), they might not have most_loved_success
    // Their options lead directly to drink_result nodes
    if (!successNode && startNode.player_options && startNode.player_options.length > 0) {
      const firstOptNode = findNode(startNode.player_options[0].next_node, charId, nodeMap);
      if (firstOptNode && firstOptNode.bartender_reflection) {
        successMsg = firstOptNode.bartender_reflection;
      }
    }

    phases.push({
      enterDesc,
      intro,
      turns,
      idealDrink,
      successMsg,
      failMsg,
      teaching,
      reactionNode,
      rewardNode,
      evalBranches,
      drinkRequest
    });
  }
  return phases;
};

export const GUESTS: Guest[] = [];

Object.keys(metaFiles).forEach(key => {
  // Handle both forward slash and backslash paths (Windows vs Unix)
  const normalizedKey = key.replace(/\\/g, '/');
  const characterDir = normalizedKey.slice(0, normalizedKey.lastIndexOf('/'));
  // Extract character ID from path - handles nested folders like regulars/tired_salaryman
  const findCharId = (k: string): string => {
    const parts = k.split('/');
    const charIndex = parts.findIndex(p => p === 'character');
    if (charIndex !== -1 && parts[charIndex + 1]) {
      // Skip category folders (like 'regulars') to get actual character ID
      const next = parts[charIndex + 1];
      if (['regulars'].includes(next)) {
        return parts[charIndex + 2] || next;
      }
      return next;
    }
    return parts[3]; // fallback
  };
  const charId = findCharId(normalizedKey);
  const meta = metaFiles[key];
  if (!meta) return;

  // Helper to find file by character ID - handles path separator differences
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const findFile = (files: Record<string, any>, suffix: string) => {
    const targetPath = `${characterDir}/${suffix.replace(/\\/g, '/')}`;
    const foundKey = Object.keys(files).find(k => k.replace(/\\/g, '/') === targetPath);
    if (!foundKey) {
      return undefined;
    }
    return files[foundKey];
  };

  const nodesMain = findFile(nodesMainFiles, 'nodes_main.yaml');
  // Find teaching file from all YAML files - use nodesTeachingFiles which has broader glob
  const nodesTeaching = findFile(nodesTeachingFiles, 'nodes_teaching.yaml');
  const observationsData = findFile(observationsFiles, 'observations.yaml');

  const expressions: Record<string, string> = {};
  let image = '';
  
  Object.keys(imageFiles).forEach(imgKey => {
    const normalizedImgKey = imgKey.replace(/\\/g, '/');
    if (normalizedImgKey.startsWith(`${characterDir}/media/`)) {
      const fileName = normalizedImgKey.split('/').pop()?.replace('.png', '');
      if (fileName) {
        expressions[fileName] = imageFiles[imgKey] as string;
        if (fileName === 'main') {
          image = imageFiles[imgKey] as string;
        } else if (fileName === 'normal' && !image) {
          image = imageFiles[imgKey] as string;
        }
      }
    }
  });

  let phases: GuestPhase[] = [];
  let allNodes: any[] = [];
  
  if (nodesMain && nodesMain.nodes) {
    allNodes = [...nodesMain.nodes];
  }
  if (nodesTeaching && nodesTeaching.nodes) {
    allNodes = [...allNodes, ...nodesTeaching.nodes];
  }

  // Compute startNodeIds and nodeMap
  const nodeMap = new Map(allNodes.map(n => [n.event_id || n.id, n]));

  // 简化：没有前置条件的节点就是起始节点
  // need_event 为空数组 [] 的节点应该被识别为起始节点
  const startNodes = allNodes.filter(n => {
    if (!n.trigger_condition) return true; // 没有 trigger_condition 的是起始节点
    const needEvent = n.trigger_condition.need_event;
    if (!needEvent || !Array.isArray(needEvent)) return true; // 没有 need_event 或不是数组的是起始节点
    return needEvent.length === 0; // need_event 为空数组的是起始节点
  });
  startNodes.sort((a, b) => {
    const timeA = a.trigger_condition?.need_time || '';
    const timeB = b.trigger_condition?.need_time || '';
    if (timeA && timeB) return timeA.localeCompare(timeB);
    return (a.event_id || '').localeCompare(b.event_id || '');
  });
  const startNodeIds = startNodes.map(n => n.event_id || n.id);

  if (allNodes.length > 0) {
    phases = buildPhasesFromNodes(charId, allNodes, meta);
  }

  if (phases.length === 0) {
    phases.push({
      enterDesc: "（客人沉默不语）",
      intro: "（客人沉默不语）",
      turns: [],
      idealDrink: { base: '', addons: [] },
      successMsg: "客人满意地离开了。",
      failMsg: "这酒...不对。"
    });
  }

  let features: Feature[] = [];
  let correctFeatures: string[] = [];

  const observations = observationsData?.observations || [];
  if (observations && Array.isArray(observations)) {
    features = observations.map((obs: any, index: number) => {
      const yPos = 20 + (index * 15);
      const xPos = index % 2 === 0 ? 30 : 70;
      
      return {
        id: obs.id || `obs_${index}`,
        name: obs.area || '未知区域',
        type: 'trait',
        desc: `${obs.objective}。${obs.subjective}`,
        x: obs.x || xPos,
        y: obs.y || yPos,
        group: obs.group || 'default'
      };
    });
    correctFeatures = features.map(f => f.id);
  }

  GUESTS.push({
    id: charId,
    name: meta.base_info?.name || charId,
    imagePlaceholderColor: '#475569',
    avatarColor: '#334155',
    image: image,
    expressions: expressions,
    features: features,
    correctFeatures: correctFeatures,
    phases,
    type: meta.base_info?.type === '普通人' ? 'Regular Customer' : meta.base_info?.type === '迷失者' ? 'Lost Soul' : 'Ghost',
    meta,
    startNodeIds,
    nodeMap
  });
});

// Ensure fox_uncle is the first guest
GUESTS.sort((a, b) => {
  if (a.id === 'fox_uncle') return -1;
  if (b.id === 'fox_uncle') return 1;
  return 0;
});

export const GUEST_SCHEDULE = [
  ['fox_uncle', 'tired_salaryman'], // Day 1
  ['aqiang', 'young_couple'], // Day 2
  ['fox_uncle', 'yuki'], // Day 3
  ['tired_salaryman', 'young_couple'], // Day 4
  ['fox_uncle', 'tired_salaryman'], // Day 5
  ['young_couple', 'tired_salaryman'], // Day 6
  ['fox_uncle', 'young_couple'], // Day 7
];

// Get schedule day by week and day (e.g., W1_D1 -> week 1, day 1)
export function getScheduleDay(week: number, day: number): ScheduleDay | undefined {
  const dayKey = `W${week}_D${day}`;
  return schedule.schedule.find(s => s.day === dayKey);
}

// Get guests for a specific week and day
export function getGuestsForDay(week: number, day: number): ScheduleGuest[] {
  const scheduleDay = getScheduleDay(week, day);
  return scheduleDay?.guests || [];
}

// Legacy support: convert old GUEST_SCHEDULE format for compatibility
export function getGuestsLegacy(day: number, guestIndex: number): { id: string; startNodeId: string } | null {
  if (day < 1 || day > GUEST_SCHEDULE.length) return null;
  const guestId = GUEST_SCHEDULE[day - 1][guestIndex];
  if (!guestId) return null;
  const guest = GUESTS.find(g => g.id === guestId);
  if (!guest) return null;
  return {
    id: guestId,
    startNodeId: guest.startNodeIds[0] || ''
  };
}

export const BASE_LIQUORS = recipesData.ingredients.bases.japanese.map(b => ({
  id: b.id,
  name: b.name,
  desc: b.gallery_description,
  color: '#e0f2fe',
  icon: '🍶',
  unlocked: b.unlocked,
  type: '日式基酒'
})).concat(recipesData.ingredients.bases.classic.map(b => ({
  id: b.id,
  name: b.name,
  desc: b.gallery_description,
  color: '#fef08a',
  icon: '🥃',
  unlocked: b.unlocked,
  type: '经典基酒'
}))).sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

export const MIXERS = recipesData.ingredients.mixers.map(m => ({
  id: m.id,
  name: m.name,
  type: m.category,
  desc: m.gallery_description,
  color: '#86efac',
  icon: '🥤',
  unlocked: m.unlocked
})).sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

export const FLAVORS = recipesData.ingredients.flavors.map(f => ({
  id: f.id,
  name: f.name,
  type: f.category,
  desc: f.gallery_description,
  color: '#fca5a5',
  icon: '🍒',
  unlocked: f.unlocked
})).sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1));

// Helper to find a node by character ID and node ID (matches by id or event_id)
export const findNodeById = (charId: string, nodeId: string): any => {
  // Check nodesMainFiles
  for (const key of Object.keys(nodesMainFiles)) {
    if (key.replace(/\\/g, '/').includes(`/${charId}/`)) {
      const nodes = nodesMainFiles[key]?.nodes || [];
      const found = nodes.find((n: any) => n.id === nodeId || n.event_id === nodeId);
      if (found) return found;
    }
  }
  // Check nodesTeachingFiles for teaching nodes
  for (const key of Object.keys(nodesTeachingFiles)) {
    if (key.replace(/\\/g, '/').includes(`/${charId}/`)) {
      const file = nodesTeachingFiles[key];
      if (file?.nodes && Array.isArray(file.nodes)) {
        const found = file.nodes.find((n: any) => n.id === nodeId || n.event_id === nodeId);
        if (found) return found;
      }
    }
  }
  return null;
};

export const ADD_ONS = [...MIXERS, ...FLAVORS];

export const findNodeForGuest = (ref: string, _charId: string, nodeMap: Map<string, any>) => {
  if (!ref) return null;
  if (nodeMap.has(ref)) return nodeMap.get(ref);
  return null;
};
