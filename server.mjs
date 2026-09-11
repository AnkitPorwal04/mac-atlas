import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { analyzeMac, lookupVendor, parseArp } from './public/core.js';

const exec = promisify(execFile);
const assets = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/core.js': ['core.js', 'text/javascript'] };
export function createApp({ registry = null, readNeighbors = async () => {
  if (process.platform !== 'darwin') throw new Error('The built-in cache reader currently supports macOS. Use CSV import on other systems.');
  return (await exec('/usr/sbin/arp', ['-an'], { timeout: 3000, maxBuffer: 1024 * 1024 })).stdout;
} } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    const port = res.socket.localPort;
    const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
    if (!hosts.includes(req.headers.host) || (req.headers.origin && !hosts.some(host => req.headers.origin === `http://${host}`)) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Local, same-origin access only.' });
    if (req.method !== 'GET') return send(405, { error: 'GET only.' });
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === '/api/status') return send(200, { available: Boolean(registry), downloadedAt: registry?.downloadedAt, counts: registry?.counts });
      if (url.pathname === '/api/lookup' || url.pathname === '/api/neighbor') {
        let info;
        try { info = analyzeMac(url.searchParams.get('mac')); } catch (error) { return send(400, { error: error.message }); }
        if (url.pathname === '/api/neighbor') {
          if (req.headers['x-mac-atlas'] !== 'local-check') return send(403, { error: 'Use the explicit local-cache check in the app.' });
          if (info.group || info.special) return send(400, { error: 'Enter an individual device address for a cache check.' });
          try { return send(200, { matches: parseArp(await readNeighbors(), info.mac), checkedAt: new Date().toISOString() }); }
          catch (error) { return send(503, { error: error.message.startsWith('The built-in') ? error.message : 'Could not read the local ARP cache. Try importing router records instead.' }); }
        }
        return send(200, { ...info, vendor: registry ? lookupVendor(info, registry.entries) : null, registryAvailable: Boolean(registry), downloadedAt: registry?.downloadedAt });
      }
      const asset = assets[url.pathname];
      if (!asset) return send(404, { error: 'Not found.' });
      const content = await readFile(new URL(`./public/${asset[0]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }); res.end(content);
    } catch { send(500, { error: 'The request could not be completed.' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let registry = null;
  try { registry = JSON.parse(await readFile(new URL('./data/registry.json', import.meta.url), 'utf8')); }
  catch { console.warn('Vendor registry unavailable. Run npm run update-registry, then restart. Address analysis still works.'); }
  const port = Number(process.env.PORT || 4176);
  createApp({ registry }).listen(port, '127.0.0.1', () => console.log(`MAC Atlas: http://localhost:${port}`));
}
