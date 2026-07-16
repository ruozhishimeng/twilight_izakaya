import fs from 'fs';

const LEGACY_KEY_FIELDS = [
  'MINIMAX_API_KEY',
  'TWILIGHT_AUTHOR_MINIMAX_API_KEY',
  'AUTHOR_MINIMAX_API_KEY',
];

export function scrubLegacyPlaintextMiniMaxKey(configPath) {
  if (!fs.existsSync(configPath)) {
    return false;
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  if (!LEGACY_KEY_FIELDS.some(field => raw.includes(field))) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !LEGACY_KEY_FIELDS.some(field => field in parsed)
    ) {
      return false;
    }

    LEGACY_KEY_FIELDS.forEach(field => {
      delete parsed[field];
    });
    fs.writeFileSync(configPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  } catch {
    // Older versions owned this file and could store a plaintext key in it.
    // If the file is malformed, deletion is safer than leaving that secret behind.
    fs.rmSync(configPath, { force: true });
  }

  return true;
}
