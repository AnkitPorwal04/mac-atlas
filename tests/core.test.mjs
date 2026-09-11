import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMac, analyzeMac, lookupVendor, parseCsv, importRecords, parseArp } from '../public/core.js';

test('normalizes all four supported formats without accepting partial or mixed input', () => {
  for (const input of ['28:6f:b9:12:34:56', '28-6F-B9-12-34-56', '286f.b912.3456', ' 286fb9123456 ']) assert.equal(normalizeMac(input), '28:6F:B9:12:34:56');
  for (const input of ['', '28:6F-B9:12:34:56', 'x286fb9123456', '28:6f:b9', 'gg:00:00:00:00:00', '28:6f:b9:12:34:56;ls', null]) assert.throws(() => normalizeMac(input));
});
test('distinguishes local, group, broadcast and null addresses', () => {
  assert.equal(analyzeMac('02:00:00:00:00:01').local, true);
  assert.equal(analyzeMac('01:00:5E:00:00:01').group, true);
  assert.equal(analyzeMac('FF:FF:FF:FF:FF:FF').special, 'Broadcast');
  assert.equal(analyzeMac('00:00:00:00:00:00').eligible, false);
  const info = analyzeMac('28:6f:b9:12:34:56'); assert.equal(info.binary.split(' ').length, 6); assert.equal(info.dotted, '286F.B912.3456');
});
test('longest registry prefix wins and local/group addresses are not attributed', () => {
  const entries = { '286FB9': { organization: 'Large' }, '286FB91': { organization: 'Medium' }, '286FB9123': { organization: 'Small' }, '020000': { organization: 'Not reliable' } };
  const info = analyzeMac('286fb9123456'); assert.equal(lookupVendor(info, entries).organization, 'Small');
  assert.equal(lookupVendor(info, entries).blockSize, 4096); delete entries['286FB9123']; assert.equal(lookupVendor(info, entries).bits, 28);
  assert.equal(lookupVendor(analyzeMac('020000000001'), entries), null);
  assert.equal(lookupVendor(analyzeMac('01005e000001'), entries), null);
  assert.equal(lookupVendor(info, {}), null);
});
test('CSV handles quoted commas, escaped quotes, multiline values, BOM, and CRLF', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"hello, x","two ""quotes""\nnext"\r\n'), [['a', 'b'], ['hello, x', 'two "quotes"\nnext']]);
  for (const bad of ['a,"unfinished', 'a,"quoted"bad', 'a,un"quoted']) assert.throws(() => parseCsv(bad));
});
test('CSV tolerates incidental whitespace outside quoted values', () => {
  assert.deepEqual(parseCsv('a,b\n  "hello, x" \t, "next"  \n'), [['a', 'b'], ['hello, x', 'next']]);
  assert.throws(() => parseCsv('a,b\nx,"value" extra'));
});
test('imports explicit schema, skips invalid MAC rows, bounds size and rejects duplicate headers', () => {
  const imported = importRecords('mac,ip,host_name,accessPoint,destination\n286fb9123456,192.0.2.1,"Lab, A",Floor 2,example.test\nbad,1,2,3,4');
  assert.equal(imported.records.length, 1); assert.equal(imported.skipped, 1); assert.equal(imported.records[0].hostname, 'Lab, A');
  assert.equal(imported.records[0].accesspoint, 'Floor 2');
  assert.throws(() => importRecords('ip,hostname\n1,x')); assert.throws(() => importRecords('mac,MAC\nx,y'));
  assert.throws(() => importRecords('x'.repeat(2_000_001)));
});
test('ARP parser supports unpadded macOS octets and only returns the requested MAC', () => {
  const result = parseArp('? (192.0.2.2) at 0:1:2:3:4:5 on en0 ifscope [ethernet]\n? (192.0.2.3) at (incomplete) on en0\n? (192.0.2.4) at aa:bb:cc:dd:ee:ff on en1', '00:01:02:03:04:05');
  assert.deepEqual(result, [{ ip: '192.0.2.2', interface: 'en0', source: 'macOS ARP cache' }]);
});
