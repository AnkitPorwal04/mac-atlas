export function normalizeMac(input) {
  const value = String(input ?? '').trim();
  if (!/^(?:[\da-f]{12}|(?:[\da-f]{2}:){5}[\da-f]{2}|(?:[\da-f]{2}-){5}[\da-f]{2}|(?:[\da-f]{4}\.){2}[\da-f]{4})$/i.test(value)) {
    throw new Error('Enter six hexadecimal pairs, for example 28:6F:B9:12:34:56.');
  }
  return value.replace(/[:.\-]/g, '').toUpperCase().match(/../g).join(':');
}

export function analyzeMac(input) {
  const mac = normalizeMac(input), hex = mac.replaceAll(':', ''), first = parseInt(hex.slice(0, 2), 16);
  const local = Boolean(first & 2), group = Boolean(first & 1);
  const special = hex === 'FFFFFFFFFFFF' ? 'Broadcast' : hex === '000000000000' ? 'All-zero address' : null;
  return { mac, hex, dashed: mac.replaceAll(':', '-'), dotted: hex.match(/.{4}/g).join('.'),
    binary: mac.split(':').map(byte => parseInt(byte, 16).toString(2).padStart(8, '0')).join(' '),
    local, group, special, eligible: !local && !group && !special,
    administration: local ? 'Locally administered' : 'Universally administered',
    delivery: special === 'Broadcast' ? 'Broadcast' : group ? 'Multicast / group' : 'Unicast / individual' };
}

export function lookupVendor(info, entries) {
  if (!info.eligible) return null;
  for (const size of [9, 7, 6]) {
    const entry = entries[info.hex.slice(0, size)];
    if (entry) return { ...entry, prefix: info.hex.slice(0, size), bits: size * 4, blockSize: 2 ** (48 - size * 4) };
  }
  return null;
}

// IEEE and router exports can contain quoted commas, newlines and escaped quotes.
export function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === '"' && !value.trim() && !closed) { quoted = true; value = ''; }
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(value); value = ''; closed = false;
      if (c !== ',') { if (row.some(v => v.trim())) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else if (closed && (c === ' ' || c === '\t')) continue;
    else if (closed || c === '"') throw new Error('Malformed CSV quoting. Use a standard comma-separated CSV export.');
    else value += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quote.');
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

export function importRecords(text) {
  if (text.length > 2_000_000) throw new Error('Keep the CSV under 2 MB.');
  const [header, ...rows] = parseCsv(text);
  const keys = header?.map(v => v.trim().toLowerCase().replace(/[ _-]/g, ''));
  if (!keys?.includes('mac')) throw new Error('The CSV needs a mac column. Download the template for supported columns.');
  if (new Set(keys).size !== keys.length) throw new Error('CSV column names must be unique.');
  if (rows.length > 10000) throw new Error('Use at most 10,000 rows per file.');
  const fields = ['mac', 'ip', 'hostname', 'accesspoint', 'switchport', 'lastseen', 'destination', 'bytes'];
  let skipped = 0;
  const records = [];
  for (const row of rows) {
    const record = Object.fromEntries(fields.map(key => [key, (row[keys.indexOf(key)] ?? '').trim().slice(0, 1000)]));
    try { record.mac = normalizeMac(record.mac); } catch { skipped++; continue; }
    records.push(record);
  }
  return { records, skipped };
}

export function parseArp(text, target) {
  const mac = normalizeMac(target), matches = [];
  for (const line of text.split('\n')) {
    const match = line.match(/\((\d+\.\d+\.\d+\.\d+)\) at ((?:[\da-f]{1,2}:){5}[\da-f]{1,2}) on (\S+)/i);
    if (!match) continue;
    const found = normalizeMac(match[2].split(':').map(v => v.padStart(2, '0')).join(':'));
    if (found === mac) matches.push({ ip: match[1], interface: match[3], source: 'macOS ARP cache' });
  }
  return matches;
}
