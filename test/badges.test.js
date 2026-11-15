import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../src/paths.js';
import { runStatusLine } from '../src/statusline.js';
import { fixture } from './helpers.js';
import { writeJsonAtomic, takeLock } from '../src/cache.js';

const busyText = JSON.stringify(fixture('busy'));
import { strip, at, NOW } from './helpers.js';
import { cleanBadge, badgeKey, readBadges, refreshBadges, addBadge, listBadges, removeBadge, run, approve, approved } from '../src/badges.js';

const tmp = () => paths({ CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'juice-badges-')) });
const ok = (stdout) => async () => ({ ok: true, stdout });

test('cleanBadge strips OSC, extra lines and non-SGR CSI', () => {
  assert.equal(cleanBadge('\x1b]8;;http://x\x07link\x1b]8;;\x07'), 'link');
  assert.equal(cleanBadge('a\nb'), 'a');
  assert.equal(cleanBadge('\x1b[2Jhi'), 'hi');
});

test('cleanBadge cuts to 40 columns and keeps colour', () => {
  assert.equal(strip(cleanBadge('x'.repeat(60))).length, 40);
  assert.ok(cleanBadge('\x1b[32mok\x1b[0m').includes('\x1b[32m'));
});

test('badgeKey differs per session', () => {
  const a = badgeKey({ session_id: 'a', workspace: { current_dir: '/x' } });
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.notEqual(a, badgeKey({ session_id: 'b', workspace: { current_dir: '/x' } }));
});

test('refreshBadges writes cache that readBadges returns', async () => {
  const p = tmp();
  const settings = { badges: [approve(p, 'rtk')] };
  await refreshBadges({ p, settings, key: 'k', stdinText: '{}', runImpl: ok('[RTK 98]\n') });
  assert.deepEqual(readBadges(p, 'k', new Date(), ['rtk']).texts, ['[RTK 98]']);
  assert.equal(readBadges(p, 'k', new Date(), ['rtk']).stale, false);
  assert.equal(readBadges(p, 'k', new Date(Date.now() + 20000), ['rtk']).stale, false, 'fresh for 30 s, so commands do not re-run on every redraw');
  assert.equal(readBadges(p, 'k', new Date(Date.now() + 31000), ['rtk']).stale, true);
  assert.deepEqual(readBadges(p, 'none', NOW, ['rtk']), { texts: [''], stale: true });
});

test('a failed run keeps the previous text', async () => {
  const p = tmp();
  const settings = { badges: [approve(p, 'a'), approve(p, 'b')] };
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: ok('one') });
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: async (c) => (c === 'a' ? { ok: false, stdout: '' } : { ok: true, stdout: 'two' }) });
  assert.deepEqual(readBadges(p, 'k', new Date(), ['a', 'b']).texts, ['one', 'two']);
});

test('a failed run keeps the old text only for a few minutes, then shows nothing until it works', async () => {
  const p = tmp();
  const settings = { badges: [approve(p, 'a')] };
  const fail = async () => ({ ok: false, stdout: '' });
  const t0 = NOW.getTime();
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: ok('main'), now: t0 });
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: fail, now: t0 + 60000 });
  assert.deepEqual(readBadges(p, 'k', at(60), ['a']).texts, ['main'], 'one bad run is no reason to blank it');
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: fail, now: t0 + 61000 });
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: fail, now: t0 + 6 * 60000 });
  assert.deepEqual(readBadges(p, 'k', at(360), ['a']).texts, [''], 'six minutes of failures: the old branch name is not current any more');
  await refreshBadges({ p, settings, key: 'k', stdinText: '', runImpl: ok('dev'), now: t0 + 7 * 60000 });
  assert.deepEqual(readBadges(p, 'k', at(420), ['a']).texts, ['dev']);
});

test('badge text read back from the cache is cleaned again, so a tampered file cannot reach the terminal', () => {
  const p = tmp();
  writeJsonAtomic(join(p.cacheDir, 'badges', 'k.json'), { texts: ['\x1b]52;c;AAAA\x07hi', '\x1b[2Jok', 'x'.repeat(200), 7], commands: ['a', 'b', 'c', 'd'], at: NOW.getTime() });
  const { texts } = readBadges(p, 'k', NOW, ['a', 'b', 'c', 'd']);
  assert.deepEqual(texts.slice(0, 2), ['hi', 'ok']);
  assert.equal(strip(texts[2]).length, 40);
  assert.equal(texts[3], '');
});

test('a badge cache that cannot be written holds the refresher back for minutes, not seconds', async () => {
  const p = tmp();
  mkdirSync(join(p.cacheDir, 'badges', 'k.json'), { recursive: true }); // a folder where the file should be
  const t0 = NOW.getTime();
  await refreshBadges({ p, settings: { badges: [approve(p, 'a')] }, key: 'k', stdinText: '', runImpl: ok('x'), now: t0 });
  assert.equal(takeLock(p, 'badges-k', new Date(t0 + 3000), 2500), false);
  assert.equal(takeLock(p, 'badges-k', new Date(t0 + 301000), 2500), true);
});

test('the sweep removes old temp files in the badge folder too, and keeps new ones', async () => {
  const p = tmp();
  const dir = join(p.cacheDir, 'badges');
  mkdirSync(dir, { recursive: true });
  for (const f of ['old.json.1.a.tmp', 'new.json.1.b.tmp']) writeFileSync(join(dir, f), '');
  utimesSync(join(dir, 'old.json.1.a.tmp'), 1, 1);
  await refreshBadges({ p, settings: { badges: [] }, key: 'k', stdinText: '' });
  assert.ok(!existsSync(join(dir, 'old.json.1.a.tmp')));
  assert.ok(existsSync(join(dir, 'new.json.1.b.tmp')));
});

test('after a removal, texts follow their command, not their position', async () => {
  const p = tmp();
  await refreshBadges({ p, settings: { badges: [approve(p, 'a'), approve(p, 'b')] }, key: 'k', stdinText: '', runImpl: async (c) => ({ ok: true, stdout: c.toUpperCase() }) });
  assert.deepEqual(readBadges(p, 'k', new Date(), ['b']).texts, ['B']); // before the next refresh, A's text is gone
  await refreshBadges({ p, settings: { badges: [approve(p, 'b')] }, key: 'k', stdinText: '', runImpl: async () => ({ ok: false, stdout: '' }) });
  assert.deepEqual(readBadges(p, 'k', new Date(), ['b']).texts, ['B']); // a failed run keeps B's own text, not A's
});

test('add, list and remove badges', () => {
  const p = tmp();
  addBadge(p, 'echo hi');
  addBadge(p, 'echo yo');
  assert.deepEqual(listBadges(p), ['echo hi', 'echo yo']);
  assert.throws(() => addBadge(p, ''), Error);
  assert.throws(() => addBadge(p, 'x'.repeat(501)), Error);
  removeBadge(p, 1);
  assert.deepEqual(listBadges(p), ['echo yo']);
});

test('default run captures stdout and honours the timeout', async () => {
  // Generous: starting Node through cmd takes over 5 s on a busy Windows machine running tests in parallel.
  assert.deepEqual(await run(`node -e "process.stdout.write('hi')"`, { input: '', timeoutMs: 15000 }), { ok: true, stdout: 'hi' });
  assert.equal((await run(`node -e "setTimeout(()=>{},5000)"`, { input: '', timeoutMs: 200 })).ok, false);
});

test('a failing command is not ok, so the badge keeps its last good text', async () => {
  assert.equal((await run('exit 3', { input: '', timeoutMs: 5000 })).ok, false);
});

test('a command that leaves a helper running still counts, and does not keep us waiting', async () => {
  const t0 = Date.now();
  // The helper inherits stdout and stderr and lives 10 s after the command itself has exited. ok: true means the
  // command's own exit counted (waiting out the 8 s limit would be ok: false); far under 10 s means we never waited.
  const cmd = `node -e "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{stdio:'inherit'}).unref(); process.stdout.write('hi')"`;
  const r = await run(cmd, { input: '', timeoutMs: 8000 });
  assert.deepEqual(r, { ok: true, stdout: 'hi' });
  assert.ok(Date.now() - t0 < 7500, `took ${Date.now() - t0}ms`);
});

test('an empty or half-written badge secret is replaced, so a new badge really runs', () => {
  const p = tmp();
  mkdirSync(p.cacheDir, { recursive: true });
  writeFileSync(join(p.cacheDir, 'badge-secret'), '');
  const b = approve(p, 'echo hi');
  assert.deepEqual(approved(p, [b]), [b]);
  writeFileSync(join(p.cacheDir, 'badge-secret'), 'abc'); // half a key: nothing signed with it counts
  assert.deepEqual(approved(p, [b]), []);
});

test('C1 control characters never reach the terminal', () => {
  assert.equal(cleanBadge('main \u009b31mX'), 'main 31mX');
  assert.equal(strip('a\u0085b\u009bc'), 'abc');
});

test('cleanBadge strips ESC-backslash OSC and unterminated OSC', () => {
  assert.equal(cleanBadge('\x1b]8;;http://x\x1b\\link\x1b]8;;\x1b\\'), 'link');
  assert.equal(cleanBadge('hi\x1b]0;title'), 'hi');
});

test('timeout kills a hung grandchild and resolves promptly', async () => {
  const t0 = Date.now();
  const cmd = `node -e "require('child_process').spawnSync(process.execPath,['-e','setTimeout(()=>{},5000)'],{stdio:'inherit'})"`;
  const r = await run(cmd, { input: '', timeoutMs: 300 });
  assert.equal(r.ok, false);
  assert.ok(Date.now() - t0 < 1300, `took ${Date.now() - t0}ms`);
});

test('badges refresh again after 2.5 s, not after 1 s', async () => {
  const dir = tmp().config;
  const calls = [];
  const go = (s) => runStatusLine({ stdinText: busyText, env: { CLAUDE_CONFIG_DIR: dir }, now: at(s), platform: 'darwin', spawnDetached: (a) => calls.push(a) });
  writeFileSync(join(dir, 'juice.json'), JSON.stringify({ badges: [approve(paths({ CLAUDE_CONFIG_DIR: dir }), 'echo hi')] }));
  await go(0);
  await go(1);
  assert.equal(calls.length, 1);
  await go(3);
  assert.equal(calls.length, 2);
});

test('badge output stamped in the future counts as stale', async () => {
  const p = tmp();
  await refreshBadges({ p, settings: { badges: [approve(p, 'x')] }, key: 'k', stdinText: '', runImpl: async () => ({ ok: true, stdout: 'a' }) });
  assert.equal(readBadges(p, 'k', new Date(Date.now() - 60000), ['x']).stale, true);
});

test('badge output is capped at 4096 characters', async () => {
  const r = await run('node -e "process.stdout.write(\'x\'.repeat(100000))"', { input: '', timeoutMs: 5000 });
  assert.ok(r.stdout.length <= 4096, `got ${r.stdout.length}`);
});

test('refresh-badges sweeps old cache files only', async () => {
  const p = tmp();
  mkdirSync(join(p.cacheDir, 'badges'), { recursive: true });
  const old = new Date(Date.now() - 8 * 86400000);
  const mk = (f, aged) => { const x = join(p.cacheDir, f); writeFileSync(x, '1'); if (aged) utimesSync(x, old, old); return x; };
  const gone = [mk('badges/old.json', 1), mk('badges-abc.lock', 1), mk('x.json.1.tmp', 1)];
  const kept = [mk('badges/new.json', 0), mk('fable.json', 1), mk('lastseen.json', 1), mk('badges-new.lock', 0)];
  await refreshBadges({ p, settings: { badges: [] }, key: 'k', stdinText: '', runImpl: async () => ({ ok: true, stdout: '' }) });
  gone.forEach((f) => assert.equal(existsSync(f), false, f));
  kept.forEach((f) => assert.equal(existsSync(f), true, f));
});
