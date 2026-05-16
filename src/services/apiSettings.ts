export type ApiKeySource = 'none' | 'author' | 'custom' | 'environment';

export interface ApiKeyStatus {
  provider: 'minimax';
  providerLabel: string;
  supportedProviders: string[];
  configured: boolean;
  source: ApiKeySource;
  supportsAuthorKey: boolean;
  model: string;
}

interface ErrorPayload {
  error?: string;
  status?: ApiKeyStatus;
}

type Fetcher = typeof fetch;

function getErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as ErrorPayload;
  return typeof candidate.error === 'string' ? candidate.error : null;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function requestApiKeyStatusUpdate(
  body: Record<string, unknown>,
  fetcher: Fetcher = fetch,
): Promise<ApiKeyStatus> {
  const response = await fetcher('/api/settings/api-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload) || 'API Key 设置失败。');
  }

  return payload as ApiKeyStatus;
}

export async function fetchApiKeyStatus(fetcher: Fetcher = fetch): Promise<ApiKeyStatus> {
  const response = await fetcher('/api/settings/api-key');
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload) || '无法读取 API Key 状态。');
  }

  return payload as ApiKeyStatus;
}

export function saveCustomMiniMaxKey(apiKey: string, fetcher?: Fetcher): Promise<ApiKeyStatus> {
  return requestApiKeyStatusUpdate(
    {
      mode: 'custom',
      apiKey,
    },
    fetcher,
  );
}

export function useAuthorMiniMaxKey(fetcher?: Fetcher): Promise<ApiKeyStatus> {
  return requestApiKeyStatusUpdate(
    {
      mode: 'author',
    },
    fetcher,
  );
}

export function clearMiniMaxKey(fetcher?: Fetcher): Promise<ApiKeyStatus> {
  return requestApiKeyStatusUpdate(
    {
      mode: 'clear',
    },
    fetcher,
  );
}

export function isApiKeyConfiguredForGameStart(status: ApiKeyStatus | null): boolean {
  return !!status?.configured;
}

export function getApiKeySourceLabel(status: ApiKeyStatus | null): string {
  if (!status?.configured) {
    return '未配置';
  }

  if (status.source === 'author') {
    return '作者 KEY';
  }

  if (status.source === 'custom') {
    return '玩家自填 KEY';
  }

  if (status.source === 'environment') {
    return '后端环境变量';
  }

  return '未配置';
}
