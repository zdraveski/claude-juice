import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../src/paths.js';
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
  assert.equal(removeBadge(p, 3), false);
  assert.equal(removeBadge(p, 1), true);
  assert.deepEqual(listBadges(p), ['echo yo']);
});

test('default run captures stdout and honours the timeout', async () => {
  assert.deepEqual(await run(`node -e "process.stdout.write('hi')"`, { input: '', timeoutMs: 5000 }), { ok: true, stdout: 'hi' });
  assert.equal((await run(`node -e "setTimeout(()=>{},5000)"`, { input: '', timeoutMs: 200 })).ok, false);
});

test('a failing command is not ok, so the badge keeps its last good text', async () => {
  assert.equal((await run('exit 3', { input: '', timeoutMs: 5000 })).ok, false);
});

test('a command that leaves a helper running still counts, and does not keep us waiting', async () => {
  const t0 = Date.now();
  // The helper inherits stdout and stderr and lives 3 s after the command itself has exited.
  const cmd = `node -e "require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},3000)'],{stdio:'inherit'}).unref(); process.stdout.write('hi')"`;
  const r = await run(cmd, { input: '', timeoutMs: 2500 });
  assert.deepEqual(r, { ok: true, stdout: 'hi' });
  assert.ok(Date.now() - t0 < 2000, `took ${Date.now() - t0}ms`);
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
