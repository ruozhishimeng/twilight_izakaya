import { strict as assert } from 'node:assert';
import fs from 'fs';
import path from 'path';
import { test } from 'node:test';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const launcherName of ['twilight_izakaya_launcher.ps1', '黄昏居酒屋.ps1']) {
  test(`${launcherName} forwards the selected backend URL to the Vite proxy`, () => {
    const source = fs.readFileSync(path.join(projectRoot, launcherName), 'utf8');
    assert.match(source, /VITE_BACKEND_TARGET='\$backendUrl'/);
    assert.match(source, /\$backendCommand[\s\S]*\$frontendCommand/);
  });
}
