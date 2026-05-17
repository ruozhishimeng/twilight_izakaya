import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  createNpmRunSpawnConfig,
  describeAuthorKeySelection,
  removeDesktopAuthorKeyFile,
  resolveDesktopAuthorKey,
  writeDesktopAuthorKeyFile,
} from './desktopAuthorKey.mjs';

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

let wroteAuthorKeyFile = false;

try {
  const selection = resolveDesktopAuthorKey(process.env);
  await writeDesktopAuthorKeyFile(selection);
  wroteAuthorKeyFile = true;
  console.log(describeAuthorKeySelection(selection));
  const npmRunConfig = createNpmRunSpawnConfig('desktop:pack');
  await runCommand(npmRunConfig.command, npmRunConfig.args);
} finally {
  if (wroteAuthorKeyFile) {
    await removeDesktopAuthorKeyFile();
    console.log('[desktop:pack:author] 已删除临时作者 KEY 文件。');
  }
}
