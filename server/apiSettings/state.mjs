const DEFAULT_MODEL = 'MiniMax-M2.5';
const SUPPORTED_PROVIDER = 'minimax';

function normalizeSecret(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderKey(value) {
  const normalized = normalizeSecret(value).toLowerCase();
  return (
    !normalized ||
    normalized === 'yourapikey' ||
    normalized === 'your_minimax_api_key' ||
    normalized === 'your-minimax-api-key' ||
    normalized === 'minimax_api_key' ||
    normalized === 'your_api_key'
  );
}

function isValidApiKey(value) {
  return !isPlaceholderKey(value);
}

function getInitialSource(env, authorApiKey) {
  const currentKey = normalizeSecret(env.MINIMAX_API_KEY);
  if (!isValidApiKey(currentKey)) {
    return 'none';
  }

  return authorApiKey && currentKey === authorApiKey ? 'author' : 'environment';
}

export function createApiSettingsState(options = {}) {
  const env = options.env || process.env;
  const allowCurrentKeyAsAuthor = options.allowCurrentKeyAsAuthor === true;
  const authorApiKey = normalizeSecret(
    options.authorApiKey ||
      env.TWILIGHT_AUTHOR_MINIMAX_API_KEY ||
      env.AUTHOR_MINIMAX_API_KEY ||
      (allowCurrentKeyAsAuthor ? env.MINIMAX_API_KEY : '') ||
      '',
  );
  const persistConfig = typeof options.persistConfig === 'function'
    ? options.persistConfig
    : async () => {};
  let source = getInitialSource(env, authorApiKey);

  function getConfiguredKey() {
    const key = normalizeSecret(env.MINIMAX_API_KEY);
    return isValidApiKey(key) ? key : '';
  }

  function getStatus() {
    const configured = !!getConfiguredKey();
    return {
      provider: SUPPORTED_PROVIDER,
      providerLabel: 'MiniMax',
      supportedProviders: ['MiniMax'],
      configured,
      source: configured ? source : 'none',
      supportsAuthorKey: isValidApiKey(authorApiKey),
      model: normalizeSecret(env.MINIMAX_MODEL) || DEFAULT_MODEL,
    };
  }

  async function applyKey(nextKey, nextSource) {
    env.MINIMAX_API_KEY = nextKey;
    source = nextSource;
    await persistConfig({ MINIMAX_API_KEY: nextKey });
    return {
      ok: true,
      status: getStatus(),
    };
  }

  async function useAuthorKey() {
    if (!isValidApiKey(authorApiKey)) {
      return {
        ok: false,
        status: 409,
        error: '当前版本未提供作者 KEY，请填写自己的 MiniMax API Key。',
      };
    }

    return applyKey(authorApiKey, 'author');
  }

  async function saveCustomKey(rawApiKey) {
    const apiKey = normalizeSecret(rawApiKey);
    if (!isValidApiKey(apiKey)) {
      throw new Error('请填写有效的 MiniMax API Key。');
    }

    return applyKey(apiKey, 'custom');
  }

  async function clearKey() {
    return applyKey('', 'none');
  }

  return {
    getStatus,
    useAuthorKey,
    saveCustomKey,
    clearKey,
  };
}
