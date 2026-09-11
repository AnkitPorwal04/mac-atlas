import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import http from 'node:http';

test('API lookup, explicit local check, static allowlist and origin boundaries', async t => {
  let reads = 0;
  const server = createApp({ registry: { downloadedAt: '2026-01-01T00:00:00Z', counts: { 'MA-L': 1 }, entries: { '286FB9': { organization: 'Fixture Vendor', registry: 'MA-L' } } }, readNeighbors: async () => { reads++; return '? (192.0.2.10) at 28:6f:b9:12:34:56 on en0'; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(`${base}/api/status`)).json()).available, true);
  const lookup = await (await fetch(`${base}/api/lookup?mac=286fb9123456`)).json(); assert.equal(lookup.vendor.organization, 'Fixture Vendor'); assert.equal(reads, 0);
  assert.equal((await fetch(`${base}/api/lookup?mac=bad`)).status, 400);
  assert.equal((await fetch(`${base}/api/neighbor?mac=286fb9123456`)).status, 403); assert.equal(reads, 0);
  const neighbor = await (await fetch(`${base}/api/neighbor?mac=286fb9123456`, { headers: { 'X-Mac-Atlas': 'local-check' } })).json(); assert.equal(neighbor.matches[0].ip, '192.0.2.10'); assert.equal(reads, 1);
  for (const path of ['/data/registry.json', '/server.mjs', '/package.json', '/.git/config', '/%2e%2e/server.mjs']) assert.equal((await fetch(base + path)).status, 404);
  for (const headers of [{ Origin: 'https://example.com' }, { Host: 'attacker.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => http.get(base + '/api/status', { headers }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject));
    assert.equal(status, 403);
  }
  assert.equal((await fetch(base + '/api/status', { method: 'POST' })).status, 405);
  const page = await fetch(base + '/'); assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.match(await page.text(), /MAC ATLAS/);
});
test('missing registry and unavailable local cache have explicit states', async t => {
  const server = createApp({ readNeighbors: async () => { throw new Error('private internal failure'); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const lookup = await (await fetch(base + '/api/lookup?mac=286fb9123456')).json(); assert.equal(lookup.registryAvailable, false); assert.equal(lookup.vendor, null);
  const response = await fetch(base + '/api/neighbor?mac=286fb9123456', { headers: { 'X-Mac-Atlas': 'local-check' } }); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private internal/);
});
