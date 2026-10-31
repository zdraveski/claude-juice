import { NOW as NOW_DATE } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../src/paths.js';
import { readJson, writeJsonAtomic } from '../src/cache.js';
import { readToken, fetchFable, refreshFable, keychainService } from '../src/fable.js';
import { fableCacheState } from '../src/readings.js';
import { createHash } from 'node:crypto';
import { fableEnabled } from '../src/schema.js';

const TOKEN = 'test-token-123';
const NOW = NOW_DATE.getTime();
const creds = (t = TOKEN) => JSON.stringify({ claudeAiOauth: { accessToken: t } });
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'juice-fable-'));
  writeFileSync(join(dir, '.credentials.json'), creds());
  return paths({ CLAUDE_CONFIG_DIR: dir });
}
const body = (percent = 41, resets_at = '2026-11-01T00:00:00Z') => ({
  limits: [
    { kind: 'weekly', percent: 5, resets_at },
    { kind: 'weekly_scoped', scope: { model: { display_name: 'Fable' } }, percent, resets_at },
  ],
});
const okFetch = (b = body()) => async () => ({ ok: true, json: async () => b });
const cacheFile = (p) => join(p.cacheDir, 'fable.json');
const noExec = () => { throw new Error('should not run'); };

test('fableEnabled', () => {
  assert.equal(fableEnabled('auto', 'darwin'), false);
  assert.equal(fableEnabled('auto', 'win32'), true);
  assert.equal(fableEnabled('auto', 'linux'), true);
  assert.equal(fableEnabled('on', 'darwin'), true);
  assert.equal(fableEnabled('off', 'win32'), false);
});

test('readToken: file on win32, null on problems', () => {
  const p = setup();
  assert.equal(readToken({ platform: 'win32', p, execFileSync: noExec }), TOKEN);
  writeFileSync(join(p.config, '.credentials.json'), '{bad');
  assert.equal(readToken({ platform: 'linux', p, execFileSync: noExec }), null);
  writeFileSync(join(p.config, '.credentials.json'), '{}');
  assert.equal(readToken({ platform: 'linux', p, execFileSync: noExec }), null);
  assert.equal(readToken({ platform: 'linux', p: paths({ CLAUDE_CONFIG_DIR: join(p.config, 'nope') }), execFileSync: noExec }), null);
});

test('the Keychain name follows Claude Code: per config folder when CLAUDE_CONFIG_DIR is set', () => {
  assert.equal(keychainService({}), 'Claude Code-credentials');
  // sha256('/Users/me/.claude-work').slice(0, 8), computed independently of the code under test
  const hash = createHash('sha256').update('/Users/me/.claude-work').digest('hex').slice(0, 8);
  assert.equal(keychainService({ CLAUDE_CONFIG_DIR: '/Users/me/.claude-work' }), `Claude Code-credentials-${hash}`);
  assert.equal(keychainService({ CLAUDE_CONFIG_DIR: '/x', CLAUDE_SECURESTORAGE_CONFIG_DIR: '' }), 'Claude Code-credentials', 'an empty override means the plain name');
  const calls = [];
  readToken({ platform: 'darwin', p: setup(), env: { CLAUDE_CONFIG_DIR: '/Users/me/.claude-work' }, execFileSync: (...a) => { calls.push(a); return creds(); } });
  assert.equal(calls[0][1][2], `Claude Code-credentials-${hash}`);
});

test('readToken darwin uses security with exact args', () => {
  const calls = [];
  const execFileSync = (...a) => { calls.push(a); return creds(); };
  assert.equal(readToken({ platform: 'darwin', p: setup(), execFileSync }), TOKEN);
  assert.deepEqual(calls[0], ['security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { timeout: 3000, encoding: 'utf8' }]);
  assert.equal(readToken({ platform: 'darwin', p: setup(), execFileSync: noExec }), null);
});

test('fetchFable sends the exact request and picks the Fable entry', async () => {
  let seen;
  const f = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => body() }; };
  assert.deepEqual(await fetchFable(TOKEN, f, '0.1.0'), { used: 41, resetsAt: '2026-11-01T00:00:00Z' });
  assert.equal(seen.url, 'https://api.anthropic.com/api/oauth/usage');
  assert.equal(seen.opts.method ?? 'GET', 'GET');
  assert.equal(seen.opts.redirect, 'error');
  assert.deepEqual(seen.opts.headers, {
    Authorization: `Bearer ${TOKEN}`, 'anthropic-beta': 'oauth-2025-04-20',
    Accept: 'application/json', 'User-Agent': 'juice/0.1.0',
  });
});

test('fetchFable still finds the entry when it carries a version, like "Fable 5.1"', async () => {
  const b = body();
  b.limits.find((l) => l.kind === 'weekly_scoped').scope.model.display_name = 'Fable 5.1';
  assert.equal((await fetchFable(TOKEN, okFetch(b), 'v')).used, 41);
});

test('fetchFable returns null on bad responses', async () => {
  assert.equal(await fetchFable(TOKEN, async () => ({ ok: false, status: 401 }), 'v'), null);
  assert.equal(await fetchFable(TOKEN, async () => { throw new Error('net'); }, 'v'), null);
  assert.equal(await fetchFable(TOKEN, async () => ({ ok: true, json: async () => { throw new Error('x'); } }), 'v'), null);
  assert.equal(await fetchFable(TOKEN, okFetch({ limits: [] }), 'v'), null);
  assert.equal(await fetchFable(TOKEN, okFetch({}), 'v'), null);
  assert.equal(await fetchFable(TOKEN, okFetch(body('x')), 'v'), null);
  assert.equal(await fetchFable(TOKEN, okFetch(body(10, 'not a date')), 'v'), null);
});

test('fetchFable also reads Session and Weekly, and works with no Fable entry', async () => {
  const five_hour = { utilization: 15, resets_at: '2026-10-28T16:39:59.96Z' };
  const seven_day = { utilization: 95, resets_at: '2026-11-01T00:00:00Z' };
  const session = { used: 15, resetsAt: five_hour.resets_at }, week = { used: 95, resetsAt: seven_day.resets_at };
  assert.deepEqual(await fetchFable(TOKEN, okFetch({ ...body(), five_hour, seven_day }), 'v'), { used: 41, resetsAt: '2026-11-01T00:00:00Z', session, week });
  assert.deepEqual(await fetchFable(TOKEN, okFetch({ five_hour, seven_day }), 'v'), { session, week });
  assert.deepEqual(await fetchFable(TOKEN, okFetch({ five_hour: { utilization: 'x', resets_at: 'y' } }), 'v'), null);
});

test('refreshFable failure keeps Session and Weekly too', async () => {
  const p = setup();
  const old = { session: { used: 15, resetsAt: '2026-10-28T16:40:00Z' }, week: { used: 95, resetsAt: '2026-11-01T00:00:00Z' }, fetchedAt: NOW - 400000 };
  writeJsonAtomic(cacheFile(p), old);
  await refreshFable({ p, platform: 'win32', execFileSync: noExec, now: NOW, version: 'v', fetchImpl: async () => ({ ok: false }) });
  assert.deepEqual(readJson(cacheFile(p)), { ...old, backoffUntil: NOW + 900000 });
});

test('fetchFable aborts a hanging request', async () => {
  const f = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
  const t0 = Date.now();
  assert.equal(await fetchFable(TOKEN, f, 'v', 50), null);
  assert.ok(Date.now() - t0 < 2000);
});

test('refreshFable success writes cache without the token', async () => {
  const p = setup();
  assert.equal(await refreshFable({ p, platform: 'win32', fetchImpl: okFetch(), execFileSync: noExec, now: NOW, version: '0.1.0' }), true);
  const raw = readFileSync(cacheFile(p), 'utf8');
  assert.deepEqual(JSON.parse(raw), { used: 41, resetsAt: '2026-11-01T00:00:00Z', fetchedAt: NOW });
  assert.ok(!raw.includes(TOKEN));
});

test('refreshFable failure keeps old values and sets backoff; recovery clears it', async () => {
  const p = setup();
  const old = { used: 30, resetsAt: '2026-11-01T00:00:00Z', fetchedAt: NOW - 400000 };
  writeJsonAtomic(cacheFile(p), old);
  const args = { p, platform: 'win32', execFileSync: noExec, now: NOW, version: 'v' };
  assert.equal(await refreshFable({ ...args, fetchImpl: async () => ({ ok: false, status: 401 }) }), false);
  assert.deepEqual(readJson(cacheFile(p)), { ...old, backoffUntil: NOW + 900000 });
  assert.equal(await refreshFable({ ...args, fetchImpl: async () => { throw new Error(`boom ${TOKEN}`); } }), false);
  assert.equal(readJson(cacheFile(p)).used, 30);
  assert.ok(!readFileSync(cacheFile(p), 'utf8').includes(TOKEN));
  assert.equal(await refreshFable({ ...args, fetchImpl: okFetch() }), true);
  assert.equal('backoffUntil' in readJson(cacheFile(p)), false);
});

test('refreshFable with no token and no old cache backs off, never throws', async () => {
  const p = paths({ CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'juice-fable-')) });
  let called = false;
  const r = await refreshFable({ p, platform: 'linux', fetchImpl: async () => { called = true; }, execFileSync: noExec, now: NOW, version: 'v' });
  assert.equal(r, false);
  assert.equal(called, false);
  assert.deepEqual(readJson(cacheFile(p)), { backoffUntil: NOW + 900000 });
});

test('fableCacheState', () => {
  const c = (ageMin, extra = {}) => ({ used: 1, resetsAt: 'x', fetchedAt: NOW - ageMin * 60000, ...extra });
  assert.equal(fableCacheState(c(4), NOW).stale, false);
  assert.equal(fableCacheState(c(6), NOW).stale, true);
  assert.equal(fableCacheState(c(6, { backoffUntil: NOW + 1 }), NOW).stale, false);
  assert.equal(fableCacheState(c(6, { backoffUntil: NOW + 10 * 3600000 }), NOW).stale, true, 'a pause stamped hours ahead (clock was ahead) is ignored');
  assert.equal(fableCacheState(null, NOW).stale, true);
  assert.equal(fableCacheState({ fetchedAt: NOW + 5000, used: 1 }, NOW).stale, true, 'a fetch stamped in the future is never trusted');
});

test('refreshFable accepts a Date for now and writes numbers', async () => {
  const p = setup();
  const args = { p, platform: 'win32', execFileSync: noExec, now: NOW_DATE, version: 'v' };
  await refreshFable({ ...args, fetchImpl: okFetch() });
  const c = readJson(cacheFile(p));
  assert.equal(c.fetchedAt, NOW);
  assert.equal(fableCacheState(c, NOW_DATE).stale, false);
  await refreshFable({ ...args, fetchImpl: async () => ({ ok: false }) });
  const b = readJson(cacheFile(p));
  assert.equal(b.backoffUntil, NOW + 900000);
  assert.equal(typeof b.fetchedAt, 'number');
});

test('refreshFable sweeps temp files a cancelled refresh left behind, but not one being written now', async () => {
  const p = setup();
  const old = join(p.cacheDir, 'lastseen.json.123.abc.tmp'), fresh = join(p.cacheDir, 'lastseen.json.456.def.tmp');
  mkdirSync(p.cacheDir, { recursive: true });
  writeFileSync(old, '{}');
  writeFileSync(fresh, '{}');
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
  utimesSync(old, twoHoursAgo, twoHoursAgo);
  await refreshFable({ p, platform: 'win32', execFileSync: noExec, now: NOW_DATE, version: 'v', fetchImpl: okFetch() });
  assert.equal(existsSync(old), false, 'left behind two hours ago: swept');
  assert.equal(existsSync(fresh), true, 'another window may be writing it right now');
});
