import { normalizeMac, importRecords, analyzeMac, lookupVendor } from './core.js';
const $ = id => document.getElementById(id);
const hosted = document.documentElement.dataset.hosted === 'true';
let snapshotPromise;
function snapshot() {
  return snapshotPromise ||= api('/registry.json').catch(error => { snapshotPromise = null; throw error; });
}
if (hosted) {
  document.querySelector('.local-tag').textContent = 'BROWSER WORKSPACE';
  document.querySelector('footer span').textContent = 'MAC ATLAS / WEB EDITION';
  const card = $('neighbors').closest('article');
  card.querySelector('h3').textContent = 'Local app required for ARP';
  card.querySelector('p').textContent = 'This website cannot read your computer\'s network cache. Run the local app on your Mac to check existing IPv4 neighbor records.';
  card.querySelector('.fine').textContent = 'Hosted lookups download a public IEEE snapshot and match in this browser. Entered MACs and imported CSV records are not uploaded by the app. Hosting infrastructure still receives ordinary page and asset requests.';
  $('neighbors').hidden = true;
}
let current = null, records = [], filename = '', neighbors = null, sequence = 0;
const labels = { ip: 'Local IP', hostname: 'Hostname', accesspoint: 'Access point / area label', switchport: 'Switch port', lastseen: 'Record timestamp', destination: 'Logged destination', bytes: 'Bytes (as recorded)' };

function text(id, value) { $(id).textContent = value; }
function details(element, values) {
  element.replaceChildren();
  for (const [label, value] of values) {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value || 'Not supplied'; row.append(dt, dd); element.append(row);
  }
}
async function api(path, options) {
  let response;
  try { response = await fetch(path, { ...options, signal: AbortSignal.timeout(10000) }); }
  catch (error) { throw new Error(error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : hosted ? 'Cannot download the registry. Check your connection and try again.' : 'Cannot reach the local server. Check that npm start is running.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('The server returned an unexpected response. Please try again.'); }
  if (!response.ok) throw new Error(result.error || 'Request failed.'); return result;
}
function fail(message) { text('error', message); $('error').hidden = false; }
function save(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderRecords() {
  const output = $('record-results'); output.replaceChildren();
  if (!records.length || !current) return;
  const matches = records.filter(row => row.mac === current.mac), caption = document.createElement('p');
  caption.textContent = `${matches.length} matching record(s) in ${filename}. Imported evidence, not a live device status.${matches.length > 100 ? ' Showing the first 100; JSON export includes all matches.' : ''}`;
  output.append(caption);
  for (const [index, record] of matches.slice(0, 100).entries()) {
    const card = document.createElement('article'), title = document.createElement('h4'), dl = document.createElement('dl');
    card.className = 'record'; title.textContent = `Record ${index + 1} / ${record.hostname || record.ip || record.mac}`;
    details(dl, Object.entries(labels).filter(([key]) => record[key]).map(([key, label]) => [label, record[key]]));
    if (!dl.children.length) { const note = document.createElement('p'); note.textContent = 'Address match only; no additional fields supplied.'; card.append(note); }
    card.prepend(title); card.append(dl); output.append(card);
  }
}
function render(result) {
  current = result; neighbors = null; $('neighbor-results').replaceChildren();
  $('empty').hidden = true; $('results').hidden = false; $('neighbors').disabled = result.group || Boolean(result.special);
  text('result-mac', result.mac); text('vendor-badge', result.vendor?.registry || 'NO ATTRIBUTION');
  text('vendor-name', result.vendor?.organization || result.special || (result.group ? (result.local ? 'Locally assigned group address' : 'Group destination address') : result.local ? 'Local address assignment' : result.registryAvailable ? 'No registered match' : 'Registry not loaded'));
  text('vendor-note', result.vendor ? 'Exact longest-prefix match in the local IEEE snapshot. Assignment holder, not confirmed laptop model or owner.' : !result.eligible ? 'Vendor attribution is not reliable for this address class. Local assignment may be randomized, manually configured, or virtual; the bit alone does not distinguish them.' : result.registryAvailable ? 'No matching assignment in this snapshot. An unknown result is not evidence of a suspicious device.' : 'Address analysis works. Run npm run update-registry and restart the server for vendor results.');
  details($('vendor-details'), result.vendor ? [['Assigned prefix', `${result.vendor.prefix} / ${result.vendor.bits} bits`], ['Block capacity', `${result.vendor.blockSize.toLocaleString()} addresses`], ['Registrant postal address', result.vendor.address], ['Snapshot downloaded', new Date(result.downloadedAt).toLocaleString()]] : []);
  if (hosted && !result.registryAvailable && result.eligible) text('vendor-note', 'Address analysis works. Check your connection and retry the lookup to download vendor data.');
  $('vendor-source').hidden = !result.vendor; if (result.vendor) $('vendor-source').href = result.vendor.source;
  details($('signature'), [['Administration', result.administration], ['Delivery', result.delivery], ['U/L bit', result.local ? '1 / locally assigned' : '0 / universal format'], ['I/G bit', result.group ? '1 / group' : '0 / individual'], ['Address length', '48 bits / 6 octets']]);
  text('signature-note', result.special ? 'This is a special address, not an individual laptop identifier.' : 'These are facts encoded in the address. A MAC can be changed or spoofed, so they do not authenticate a device.');
  details($('formats'), [['Colon', result.mac], ['Hyphen', result.dashed], ['Cisco dotted', result.dotted], ['Compact hex', result.hex], ['Binary octets', result.binary]]);
  renderRecords(); $('result-mac').focus({ preventScroll: true });
}
$('lookup-form').addEventListener('submit', async event => {
  event.preventDefault(); const id = ++sequence;
  $('error').hidden = true; $('lookup').disabled = true; text('lookup', 'Looking up...');
  current = null; neighbors = null; $('results').hidden = true; $('empty').hidden = false; $('neighbors').disabled = true; $('neighbor-results').replaceChildren(); $('record-results').replaceChildren();
  try {
    const mac = normalizeMac($('mac').value);
    let result;
    if (hosted) {
      const info = analyzeMac(mac);
      let data = null;
      try { data = await snapshot(); } catch { text('notice', 'Registry download unavailable. Address analysis still works; retry to load vendor data.'); }
      result = { ...info, vendor: data ? lookupVendor(info, data.entries) : null, registryAvailable: Boolean(data), downloadedAt: data?.downloadedAt };
    } else result = await api(`/api/lookup?mac=${encodeURIComponent(mac)}`);
    if (id === sequence) render(result);
  }
  catch (error) { if (id === sequence) fail(error.message); }
  finally { if (id === sequence) { $('lookup').disabled = false; text('lookup', 'Look up address →'); } }
});
$('example').onclick = () => { $('mac').value = '28:6F:B9:12:34:56'; $('lookup-form').requestSubmit(); };
$('copy').onclick = async () => { if (!current) return; try { await navigator.clipboard.writeText(current.mac); text('notice', 'MAC address copied.'); } catch { text('notice', 'Clipboard unavailable. Select the address to copy it.'); } };
$('export').onclick = () => { if (current) save(`mac-atlas-${current.hex}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), lookup: current, localCache: neighbors, importedSource: filename || null, importedRecords: records.filter(row => row.mac === current.mac), note: 'Registry postal addresses belong to organizations, not devices. Cache and imported records are not proof of current presence or identity.' }, null, 2), 'application/json'); };
$('neighbors').onclick = async () => {
  if (!current || hosted) return;
  const id = sequence, mac = current.mac; $('neighbors').disabled = true; text('neighbor-results', 'Reading existing cache entries...');
  try {
    const data = await api(`/api/neighbor?mac=${encodeURIComponent(mac)}`, { headers: { 'X-Mac-Atlas': 'local-check' } });
    if (id !== sequence) return; neighbors = data; $('neighbor-results').replaceChildren();
    const note = document.createElement('p'); note.textContent = data.matches.length ? `Cache match at ${new Date(data.checkedAt).toLocaleTimeString()}. This is the query time, not a last-seen timestamp. Presence is not confirmed.` : 'No matching cache entry. The device may still be connected; this cache is not a complete device inventory.';
    $('neighbor-results').append(note);
    for (const match of data.matches) { const dl = document.createElement('dl'); details(dl, [['Local IP', match.ip], ['Interface', match.interface], ['Evidence', match.source]]); $('neighbor-results').append(dl); }
  } catch (error) { if (id === sequence) text('neighbor-results', error.message); }
  finally { if (id === sequence) $('neighbors').disabled = false; }
};
$('template').onclick = () => save('mac-atlas-template.csv', 'mac,ip,hostname,accessPoint,switchPort,lastSeen,destination,bytes\r\n', 'text/csv');
let importSequence = 0;
$('csv').onchange = async () => {
  const file = $('csv').files[0]; if (!file) return;
  const id = ++importSequence;
  try {
    if (file.size > 2_000_000) throw new Error('Keep the CSV under 2 MB.');
    const result = importRecords(await file.text()); if (id !== importSequence) return;
    if (!result.records.length) throw new Error('No valid MAC rows found. Existing imported records were retained.');
    records = result.records; filename = file.name; text('import-status', `${records.length} rows loaded; ${result.skipped} invalid MAC rows skipped. Source: ${filename}`); $('clear-import').hidden = false; renderRecords();
  } catch (error) { if (id === importSequence) text('import-status', error.message); }
  $('csv').value = '';
};
$('clear-import').onclick = () => { importSequence++; records = []; filename = ''; $('record-results').replaceChildren(); text('import-status', 'Imported records cleared from this tab.'); $('clear-import').hidden = true; };
(hosted ? snapshot().then(data => ({ ...data, available: true })) : api('/api/status')).then(status => text('registry-status', status.available ? `IEEE snapshot / ${Object.values(status.counts).reduce((a,b) => a+b,0).toLocaleString()} assignments / ${new Date(status.downloadedAt).toLocaleDateString()}` : 'Registry unavailable / address analysis ready')).catch(() => text('registry-status', hosted ? 'Registry download unavailable / retry a lookup to load it.' : 'Local server unavailable. Start it with npm start.'));
