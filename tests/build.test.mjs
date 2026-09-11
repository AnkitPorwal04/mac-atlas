import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('hosted build only publishes static assets and public registry data', async t => {
  const root = await mkdtemp(join(tmpdir(), 'mac-atlas-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'data')); await mkdir(join(root, 'public'));
  await copyFile(new URL('../build.mjs', import.meta.url), join(root, 'build.mjs'));
  for (const file of ['index.html', 'style.css', 'app.js', 'core.js']) await copyFile(new URL(`../public/${file}`, import.meta.url), join(root, 'public', file));
  await writeFile(join(root, 'data/registry.json'), JSON.stringify({ downloadedAt: '2026-01-01', entries: { '286FB9': { organization: 'Fixture' } } }));
  await promisify(execFile)(process.execPath, ['build.mjs'], { cwd: root });
  assert.deepEqual((await readdir(join(root, 'dist'))).sort(), ['app.js', 'core.js', 'index.html', 'registry.json', 'style.css']);
  assert.match(await readFile(join(root, 'dist/index.html'), 'utf8'), /data-hosted="true"/);
  assert.match(await readFile(join(root, 'dist/registry.json'), 'utf8'), /Fixture/);
});
