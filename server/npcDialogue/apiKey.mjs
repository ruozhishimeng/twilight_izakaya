const MAX_API_KEY_LENGTH = 512;
const PLACEHOLDER_KEYS = new Set([
  'yourapikey',
  'your_api_key',
  'your-minimax-api-key',
  'your_minimax_api_key',
]);

function isPrintableAscii(value) {
  return /^[\x21-\x7e]+$/.test(value);
}

export function validateMiniMaxApiKey(rawApiKey) {
  const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : '';

  if (!apiKey) {
    return {
      ok: false,
      error: '请先填写自己的 MiniMax API Key。',
    };
  }

  if (
    apiKey.length > MAX_API_KEY_LENGTH ||
    !isPrintableAscii(apiKey) ||
    PLACEHOLDER_KEYS.has(apiKey.toLowerCase())
  ) {
    return {
      ok: false,
      error: 'MiniMax API Key 格式无效。',
    };
  }

  return {
    ok: true,
    apiKey,
  };
}

export function parseMiniMaxAuthorizationHeader(rawHeader) {
  if (typeof rawHeader !== 'string') {
    return {
      ok: false,
      error: '请先填写自己的 MiniMax API Key。',
    };
  }

  const match = rawHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      error: 'MiniMax API Key 请求凭据格式无效。',
    };
  }

  return validateMiniMaxApiKey(match[1]);
}

export function resolveMiniMaxApiKey(rawHeader, environmentApiKey) {
  if (rawHeader !== null && rawHeader !== undefined) {
    return parseMiniMaxAuthorizationHeader(rawHeader);
  }

  return validateMiniMaxApiKey(environmentApiKey);
}
