import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
let registry;
try { registry = await readFile(new URL('data/registry.json', root)); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await import('./update-registry.mjs');
  registry = await readFile(new URL('data/registry.json', root));
}
const snapshot = JSON.parse(registry);
if (!snapshot.downloadedAt || !Object.keys(snapshot.entries || {}).length) throw new Error('A valid registry snapshot is required for hosting.');
await mkdir(new URL('dist/', root), { recursive: true });
for (const file of ['style.css', 'app.js', 'core.js']) await copyFile(new URL(`public/${file}`, root), new URL(`dist/${file}`, root));
const html = (await readFile(new URL('public/index.html', root), 'utf8')).replace('<html lang="en">', '<html lang="en" data-hosted="true">');
await writeFile(new URL('dist/index.html', root), html);
await writeFile(new URL('dist/registry.json', root), registry);
console.log('Built static hosted edition: browser-only lookups, no ARP endpoint.');
