import { mkdir, writeFile, rename } from 'node:fs/promises';
import { parseCsv } from './public/core.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const sources = [
  ['MA-L', 'https://standards-oui.ieee.org/oui/oui.csv', 6],
  ['MA-M', 'https://standards-oui.ieee.org/oui28/mam.csv', 7],
  ['MA-S', 'https://standards-oui.ieee.org/oui36/oui36.csv', 9],
  ['IAB', 'https://standards-oui.ieee.org/iab/iab.csv', 9],
];
const entries = Object.create(null), counts = {};
for (const [registry, url, size] of sources) {
  const { stdout: text } = await exec('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '60', url], { timeout: 65000, maxBuffer: 20_000_000 });
  if (text.length > 20_000_000) throw new Error('Unexpected registry size.');
  const [header, ...rows] = parseCsv(text);
  if (header?.[1] !== 'Assignment') throw new Error(`${registry}: unexpected registry format.`);
  let count = 0;
  for (const row of rows) {
    if (row[0] !== registry || !new RegExp(`^[A-F0-9]{${size}}$`).test(row[1]) || !row[2]) continue;
    entries[row[1]] = { registry, organization: row[2], address: row[3] || '', source: url }; count++;
  }
  if (count < 100) throw new Error(`${registry}: incomplete download; previous snapshot retained.`);
  counts[registry] = count;
  console.log(`${registry}: ${count.toLocaleString()} assignments downloaded`);
}
const directory = new URL('./data/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('registry.tmp', directory), JSON.stringify({ downloadedAt: new Date().toISOString(), counts, entries }));
await rename(new URL('registry.tmp', directory), new URL('registry.json', directory));
console.log('Registry snapshot updated. Restart the server to load it. No lookup addresses were sent to IEEE.');
