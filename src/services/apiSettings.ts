export type ApiKeySource = 'none' | 'custom';

export interface ApiKeyStatus {
  provider: 'minimax';
  providerLabel: 'MiniMax';
  supportedProviders: ['MiniMax'];
  configured: boolean;
  source: ApiKeySource;
  model: 'MiniMax-M2.5';
}

const MAX_API_KEY_LENGTH = 512;
const PLACEHOLDER_KEYS = new Set([
  'yourapikey',
  'your_api_key',
  'your-minimax-api-key',
  'your_minimax_api_key',
]);

let currentMiniMaxApiKey = '';

function normalizeMiniMaxApiKey(rawApiKey: string): string {
  const apiKey = rawApiKey.trim();

  if (
    !apiKey ||
    apiKey.length > MAX_API_KEY_LENGTH ||
    !/^[\x21-\x7e]+$/.test(apiKey) ||
    PLACEHOLDER_KEYS.has(apiKey.toLowerCase())
  ) {
    throw new Error('请填写有效的 MiniMax API Key。');
  }

  return apiKey;
}

export function getMiniMaxApiKeyStatus(): ApiKeyStatus {
  const configured = currentMiniMaxApiKey.length > 0;
  return {
    provider: 'minimax',
    providerLabel: 'MiniMax',
    supportedProviders: ['MiniMax'],
    configured,
    source: configured ? 'custom' : 'none',
    model: 'MiniMax-M2.5',
  };
}

export function getMiniMaxApiKeyForRequest(): string {
  return currentMiniMaxApiKey;
}

export async function fetchApiKeyStatus(): Promise<ApiKeyStatus> {
  return getMiniMaxApiKeyStatus();
}

export async function saveCustomMiniMaxKey(apiKey: string): Promise<ApiKeyStatus> {
  currentMiniMaxApiKey = normalizeMiniMaxApiKey(apiKey);
  return getMiniMaxApiKeyStatus();
}

export async function clearMiniMaxKey(): Promise<ApiKeyStatus> {
  currentMiniMaxApiKey = '';
  return getMiniMaxApiKeyStatus();
}

export function isApiKeyConfiguredForGameStart(status: ApiKeyStatus | null): boolean {
  return status?.provider === 'minimax';
}

export function getApiKeySourceLabel(status: ApiKeyStatus | null): string {
  return status?.configured ? '本次运行的玩家 KEY' : '未使用玩家 KEY';
}
