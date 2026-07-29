const MINIMAX_BASE_URL = 'https://api.minimaxi.com';
const MINIMAX_MODEL = 'MiniMax-M3';
const DEFAULT_TIMEOUT_MS = 20000;

function parseTimeout(rawTimeout) {
  const timeout = Number.parseInt(rawTimeout || '', 10);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return timeout;
}

function stripThinkTags(content) {
  return content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
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
        status: 401,
        code: 'minimax_auth_failed',
      });
    case 1026:
      return new MiniMaxProviderError('当前输入触发了内容安全限制。', {
        status: 422,
        code: 'minimax_input_blocked',
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

export async function requestMiniMaxNpcDialogue({
  messages, promptChars, apiKey, signal, temperature = 0.35, topP = 0.9,
}) {
  if (!apiKey) {
    throw new MiniMaxProviderError('请先填写自己的 MiniMax API Key。', {
      status: 401,
      code: 'missing_api_key',
    });
  }

  const timeoutMs = parseTimeout(process.env.MINIMAX_TIMEOUT_MS);
  const controller = new AbortController();
  let abortSource = signal?.aborted ? 'external' : null;
  const abortFromExternal = () => {
    if (abortSource === null) abortSource = 'external';
    controller.abort();
  };
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abortFromExternal, { once: true });
  const timeout = setTimeout(() => {
    if (abortSource === null) abortSource = 'timeout';
    controller.abort();
  }, timeoutMs);

  let response;
  let rawText;
  try {
    response = await fetch(`${MINIMAX_BASE_URL}/v1/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        stream: false,
        temperature,
        top_p: topP,
        messages,
      }),
      signal: controller.signal,
    });
    rawText = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (abortSource === 'external') {
        throw new MiniMaxProviderError('对话请求已取消。', {
          status: 499,
          code: 'request_aborted',
        });
      }
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
    signal?.removeEventListener('abort', abortFromExternal);
  }

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
        status: 401,
        code: 'http_auth_failed',
      });
    }

    throw new MiniMaxProviderError('MiniMax 对话服务请求失败。', {
      status: 502,
      code: 'http_error',
    });
  }

  const rawContent = payload?.choices?.[0]?.message?.content;
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new MiniMaxProviderError('MiniMax 没有返回可用的对话内容。', {
      status: 502,
      code: 'missing_content',
    });
  }

  const content = stripThinkTags(rawContent);

  return {
    content,
    usage: {
      provider: `minimax:${MINIMAX_MODEL}`,
      promptTokens: payload?.usage?.prompt_tokens,
      completionTokens: payload?.usage?.completion_tokens,
      totalTokens: payload?.usage?.total_tokens,
      promptChars,
      completionChars: content.length,
    },
  };
}
