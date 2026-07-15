import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const FORMER_AUTHOR_KEY_PATH = 'electron/author-key.local.json';

export function assertDesktopPackagingIsSafe(rootDir = projectRoot) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const packagedFiles = packageJson.build?.files || [];
  const staleAuthorKeyPath = path.join(rootDir, FORMER_AUTHOR_KEY_PATH);

  if (fs.existsSync(staleAuthorKeyPath)) {
    throw new Error(
      `检测到旧作者 KEY 文件 ${FORMER_AUTHOR_KEY_PATH}。已中止封包；请先撤销该 Key 并删除文件。`,
    );
  }

  if (!packagedFiles.includes(`!${FORMER_AUTHOR_KEY_PATH}`)) {
    throw new Error(`桌面封包必须显式排除 ${FORMER_AUTHOR_KEY_PATH}。`);
  }

  if ('desktop:pack:author' in (packageJson.scripts || {})) {
    throw new Error('检测到已废弃的作者 KEY 封包命令。');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  assertDesktopPackagingIsSafe();
  console.log('[desktop:security] BYOK-only packaging checks passed.');
}
