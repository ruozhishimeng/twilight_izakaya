import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUTHOR_KEY_FILE_RELATIVE_PATH = 'electron/author-key.local.json';
export const AUTHOR_KEY_FILE_PATH = fileURLToPath(
  new URL(`../${AUTHOR_KEY_FILE_RELATIVE_PATH}`, import.meta.url),
);
export const AUTHOR_KEY_ENV_KEYS = [
  'TWILIGHT_AUTHOR_MINIMAX_API_KEY',
  'AUTHOR_MINIMAX_API_KEY',
  'MINIMAX_API_KEY',
];

function normalizeSecret(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholderSecret(value) {
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

export function resolveDesktopAuthorKey(env = process.env) {
  for (const key of AUTHOR_KEY_ENV_KEYS) {
    const value = normalizeSecret(env[key]);
    if (!isPlaceholderSecret(value)) {
      return {
        authorApiKey: value,
        source: key,
      };
    }
  }

  throw new Error(
    '未找到可用于桌面封包的作者 KEY。请在 .env 中配置 TWILIGHT_AUTHOR_MINIMAX_API_KEY，或提供有效的 MINIMAX_API_KEY。',
  );
}

export function createAuthorKeyFilePayload(selection) {
  return {
    authorApiKey: selection.authorApiKey,
    source: selection.source,
  };
}

export function describeAuthorKeySelection(selection) {
  return `[desktop:pack:author] 作者 KEY 来源：${selection.source}；密钥明文已省略。`;
}

export function createNpmRunSpawnConfig(
  scriptName,
  {
    platform = process.platform,
    comspec = process.env.ComSpec,
  } = {},
) {
  if (platform === 'win32') {
    return {
      command: comspec || 'cmd.exe',
      args: ['/d', '/s', '/c', `npm.cmd run ${scriptName}`],
    };
  }

  return {
    command: 'npm',
    args: ['run', scriptName],
  };
}

export async function writeDesktopAuthorKeyFile(selection, filePath = AUTHOR_KEY_FILE_PATH) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    `${JSON.stringify(createAuthorKeyFilePayload(selection), null, 2)}\n`,
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  );
  return filePath;
}

export async function removeDesktopAuthorKeyFile(filePath = AUTHOR_KEY_FILE_PATH) {
  await fs.rm(filePath, { force: true });
}
