export const NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY =
  '这个话题不适合在店里聊。我们还是回到这杯酒、这位客人，或者刚才的故事吧。';

const BLOCK_RULES = [
  {
    reason: 'prompt_injection',
    patterns: [
      /忽略.{0,12}(之前|以上|所有).{0,12}(设定|指令|规则|prompt|提示)/i,
      /(system|developer)\s*prompt/i,
      /(系统|开发者).{0,8}(提示|指令|规则)/,
      /你现在是.{0,12}(chatgpt|ai|模型|助手)/i,
      /越狱|jailbreak/i,
    ],
  },
  {
    reason: 'sexual',
    patterns: [
      /色情|裸聊|色图|露骨.{0,6}性|约炮|做爱|性交|口交|肛交|强奸|淫/i,
      /\b(porn|nude|sex|sexual)\b/i,
    ],
  },
  {
    reason: 'illegal',
    patterns: [
      /炸弹|爆炸物|制毒|贩毒|毒品|诈骗|洗钱|盗号|黑客攻击|入侵.{0,6}系统/,
      /杀人|谋杀|自制枪|购买枪支|开锁教程|偷.{0,6}(密码|银行卡|账号)/,
      /\b(bomb|fraud|phishing|malware|ransomware)\b/i,
    ],
  },
  {
    reason: 'off_topic',
    patterns: [
      /\b(react|python|javascript|typescript|tailwind|leetcode|vscode|npm|git)\b/i,
      /写.{0,8}(代码|脚本|爬虫|登录页|程序)/,
      /帮我.{0,8}(写|生成|翻译|总结).{0,12}(论文|简历|代码|脚本|营销文案)/,
      /股票|纳斯达克|世界杯|天气预报|数学题|高考作文/,
    ],
  },
];

function normalizeInput(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function moderateNpcDialogueInput(playerText) {
  const normalized = normalizeInput(playerText);

  for (const rule of BLOCK_RULES) {
    if (rule.patterns.some(pattern => pattern.test(normalized))) {
      return {
        allowed: false,
        reason: rule.reason,
        replyLines: [NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY],
        mood: 'guarded',
        endChat: false,
      };
    }
  }

  return {
    allowed: true,
    reason: null,
  };
}

export function buildUnsupportedNpcDialogueResponse(moderation, promptChars = 0) {
  const replyLines = moderation.replyLines || [NPC_DIALOGUE_UNSUPPORTED_INPUT_REPLY];

  return {
    replyLines,
    mood: moderation.mood || 'guarded',
    endChat: false,
    usage: {
      provider: 'local-safety-filter',
      promptChars,
      completionChars: replyLines.join('').length,
    },
  };
}
