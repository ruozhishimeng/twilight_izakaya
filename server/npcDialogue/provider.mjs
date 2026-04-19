const DEFAULT_BASE_URL = 'https://api.minimaxi.com';
const DEFAULT_MODEL = 'M2-her';
const DEFAULT_TIMEOUT_MS = 8000;

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, '');
}

function parseTimeout(rawTimeout) {
  const timeout = Number.parseInt(rawTimeout || '', 10);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return timeout;
}

function mapMiniMaxStatusError(statusCode, statusMessage) {
  switch (statusCode) {
    case 1001:
      return new MiniMaxProviderError('对话服务请求超时。', {
        status: 504,
        code: 'minimax_timeout',
      });
    case 1004:
      return new MiniMaxProviderError('MiniMax 密钥无效或未授权。', {
        status: 500,
        code: 'minimax_auth_failed',
      });
    case 1027:
      return new MiniMaxProviderError('MiniMax 返回内容触发了安全限制。', {
        status: 422,
        code: 'minimax_content_blocked',
      });
    default:
      return new MiniMaxProviderError(statusMessage || 'MiniMax 对话服务异常。', {
        status: 502,
        code: `minimax_${statusCode || 'unknown_error'}`,
      });
  }
}

export class MiniMaxProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'MiniMaxProviderError';
    this.status = options.status || 502;
    this.code = options.code || 'minimax_error';
  }
}

export async function requestMiniMaxNpcDialogue({ messages, promptChars }) {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    throw new MiniMaxProviderError('未配置 MINIMAX_API_KEY，无法调用对话服务。', {
      status: 500,
      code: 'missing_api_key',
    });
  }

  const configuredModel = process.env.MINIMAX_MODEL?.trim() || DEFAULT_MODEL;
  if (configuredModel !== DEFAULT_MODEL) {
    throw new MiniMaxProviderError(`当前仅支持 MiniMax 模型 ${DEFAULT_MODEL}。`, {
      status: 500,
      code: 'invalid_model',
    });
  }

  const baseUrl = normalizeBaseUrl(process.env.MINIMAX_BASE_URL?.trim() || DEFAULT_BASE_URL);
  const timeoutMs = parseTimeout(process.env.MINIMAX_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${baseUrl}/v1/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: configuredModel,
        stream: false,
        temperature: 0.5,
        top_p: 0.9,
        max_completion_tokens: 120,
        messages,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MiniMaxProviderError('对话服务请求超时。', {
        status: 504,
        code: 'request_timeout',
      });
    }

    throw new MiniMaxProviderError('无法连接 MiniMax 对话服务。', {
      status: 502,
      code: 'network_error',
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  let payload;

  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new MiniMaxProviderError('MiniMax 返回了无法解析的内容。', {
      status: 502,
      code: 'invalid_upstream_json',
    });
  }

  if (payload?.input_sensitive || payload?.output_sensitive) {
    throw new MiniMaxProviderError('当前输入或输出触发了内容安全限制。', {
      status: 422,
      code: 'sensitive_content',
    });
  }

  const upstreamStatusCode = payload?.base_resp?.status_code;
  if (typeof upstreamStatusCode === 'number' && upstreamStatusCode !== 0) {
    throw mapMiniMaxStatusError(upstreamStatusCode, payload?.base_resp?.status_msg);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new MiniMaxProviderError('MiniMax 密钥无效或未授权。', {
        status: 500,
        code: 'http_auth_failed',
      });
    }

    throw new MiniMaxProviderError('MiniMax 对话服务请求失败。', {
      status: 502,
      code: 'http_error',
    });
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new MiniMaxProviderError('MiniMax 没有返回可用的对话内容。', {
      status: 502,
      code: 'missing_content',
    });
  }

  return {
    content: content.trim(),
    usage: {
      provider: `minimax:${configuredModel}`,
      promptTokens: payload?.usage?.prompt_tokens,
      completionTokens: payload?.usage?.completion_tokens,
      totalTokens: payload?.usage?.total_tokens,
      promptChars,
      completionChars: content.trim().length,
    },
  };
}
