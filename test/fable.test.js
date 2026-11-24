import { NOW as NOW_DATE } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../src/paths.js';
import { readJson, writeJsonAtomic, takeLock } from '../src/cache.js';
import { readToken, fetchFable, refreshFable, keychainService } from '../src/fable.js';
import { fableCacheState } from '../src/readings.js';
import * as readings from '../src/readings.js';
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
// What `security` does when the Keychain holds no such item (status 44), and when the person denies or cancels the dialog.
const notFound = () => { throw Object.assign(new Error('not found'), { status: 44 }); };
const refused = () => { throw Object.assign(new Error('denied'), { status: 1 }); };

test('fableEnabled', () => {
  // auto stays on only for someone who already has a reading (1.3.x turned it on without asking); a new install asks first.
  assert.equal(fableEnabled('auto', 'win32', true), true);
  assert.equal(fableEnabled('auto', 'linux', true), true);
  assert.equal(fableEnabled('auto', 'win32', false), false);
  assert.equal(fableEnabled('auto', 'darwin', true), false);
  assert.equal(fableEnabled('on', 'darwin', false), true);
  assert.equal(fableEnabled('off', 'linux', true), false);
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
  assert.deepEqual(calls[0], ['/usr/bin/security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { timeout: 25000, encoding: 'utf8' }]);
  assert.equal(readToken({ platform: 'darwin', p: paths({ CLAUDE_CONFIG_DIR: join(setup().config, 'nope') }), execFileSync: notFound }), null);
});

test('fetchFable sends the exact request and picks the Fable entry', async () => {
  let seen;
  const f = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => body() }; };
  assert.deepEqual(await fetchFable(TOKEN, f, '0.1.0'), { used: 41, resetsAt: '2026-11-01T00:00:00.000Z' });
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

test('fetchFable says why a check failed, so the doctor can give the right advice', async () => {
  const status = (s) => async () => ({ ok: false, status: s });
  assert.equal(await fetchFable(TOKEN, status(401), 'v'), 'login');
  assert.equal(await fetchFable(TOKEN, status(403), 'v'), 'login');
  assert.equal(await fetchFable(TOKEN, status(429), 'v'), 'busy');
  assert.equal(await fetchFable(TOKEN, status(503), 'v'), 'busy');
  assert.equal(await fetchFable(TOKEN, status(404), 'v'), 'changed', 'the address moved');
  assert.equal(await fetchFable(TOKEN, async () => { throw new Error('net'); }, 'v'), 'offline');
  assert.equal(await fetchFable(TOKEN, async () => ({ ok: true, json: async () => { throw new Error('x'); } }), 'v'), 'offline', 'a sign-in page or proxy answered instead');
  assert.equal(await fetchFable(TOKEN, okFetch({ limits: [] }), 'v'), 'changed');
  assert.equal(await fetchFable(TOKEN, okFetch({}), 'v'), 'changed');
  assert.equal(await fetchFable(TOKEN, okFetch(body('x')), 'v'), 'changed');
  assert.equal(await fetchFable(TOKEN, okFetch(body(10, 'not a date')), 'v'), 'changed');
});

// 5 minutes, as often as a working login is asked: an idle window's login stays expired, and sooner only starts more processes.
test('an expired login is never sent; juice looks again in 5 minutes, after Claude Code renews it', async () => {
  const p = setup();
  const save = (expiresAt) => writeFileSync(join(p.config, '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: TOKEN, expiresAt } }));
  save(NOW - 1);
  assert.equal(readToken({ platform: 'win32', p, now: NOW, execFileSync: noExec }), false);
  let called = false;
  const r = await refreshFable({ p, platform: 'win32', execFileSync: noExec, now: NOW, version: 'v', fetchImpl: async () => { called = true; } });
  assert.equal(r, false);
  assert.equal(called, false, 'an expired token would only earn a 401');
  assert.deepEqual(readJson(cacheFile(p)), { backoffUntil: NOW + 300000, why: 'expired' });
  save(NOW + 60000);
  assert.equal(readToken({ platform: 'win32', p, now: NOW, execFileSync: noExec }), TOKEN);
  save('soon');
  assert.equal(readToken({ platform: 'win32', p, now: NOW, execFileSync: noExec }), TOKEN, 'an expiry juice cannot read is not a reason to stop');
});

test('fetchFable also reads Session and Weekly, and works with no Fable entry', async () => {
  const five_hour = { utilization: 15, resets_at: '2026-10-28T16:39:59.96Z' };
  const seven_day = { utilization: 95, resets_at: '2026-11-01T00:00:00Z' };
  const session = { used: 15, resetsAt: '2026-10-28T16:39:59.960Z' }, week = { used: 95, resetsAt: '2026-11-01T00:00:00.000Z' };
  assert.deepEqual(await fetchFable(TOKEN, okFetch({ ...body(), five_hour, seven_day }), 'v'), { used: 41, resetsAt: '2026-11-01T00:00:00.000Z', session, week });
  assert.deepEqual(await fetchFable(TOKEN, okFetch({ five_hour, seven_day }), 'v'), { session, week });
  assert.deepEqual(await fetchFable(TOKEN, okFetch({ five_hour: { utilization: 'x', resets_at: 'y' } }), 'v'), 'changed');
});

test('refreshFable failure keeps Session and Weekly too', async () => {
  const p = setup();
  const old = { session: { used: 15, resetsAt: '2026-10-28T16:40:00Z' }, week: { used: 95, resetsAt: '2026-11-01T00:00:00Z' }, fetchedAt: NOW - 400000 };
  writeJsonAtomic(cacheFile(p), old);
  await refreshFable({ p, platform: 'win32', execFileSync: noExec, now: NOW, version: 'v', fetchImpl: async () => ({ ok: false }) });
  assert.deepEqual(readJson(cacheFile(p)), { ...old, backoffUntil: NOW + 900000, why: 'changed' });
});

test('fetchFable stores the date it understood, and refuses an absurdly long one', async () => {
  const r = await fetchFable(TOKEN, okFetch(body(41, '2026-11-01 00:00:00Z')), 'v');
  assert.equal(r.resetsAt, '2026-11-01T00:00:00.000Z');
  const long = `2026-11-01T00:00:00Z${' '.repeat(100000)}`;
  assert.equal(await fetchFable(TOKEN, okFetch(body(41, long)), 'v'), 'changed');
});

test('a cache that cannot be written still holds the refresher back for the backoff', async () => {
  const p = setup();
  mkdirSync(cacheFile(p), { recursive: true }); // a folder where the file should be: every write fails
  const args = { p, platform: 'win32', execFileSync: noExec, now: NOW, version: 'v' };
  assert.equal(await refreshFable({ ...args, fetchImpl: async () => ({ ok: false }) }), false);
  assert.equal(takeLock(p, 'fable', new Date(NOW + 60000)), false, 'a minute later, no second refresher');
  assert.equal(takeLock(p, 'fable', new Date(NOW + 900001)), true, 'after the backoff it may try again');
});

test('fetchFable aborts a hanging request', async () => {
  let aborted = false;
  const f = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => { aborted = true; rej(new Error('aborted')); }));
  assert.equal(await fetchFable(TOKEN, f, 'v', 50), 'offline'); // a request nobody aborts never returns, so no clock is needed
  assert.equal(aborted, true);
});

test('refreshFable success writes cache without the token', async () => {
  const p = setup();
  assert.equal(await refreshFable({ p, platform: 'win32', fetchImpl: okFetch(), execFileSync: noExec, now: NOW, version: '0.1.0' }), true);
  const raw = readFileSync(cacheFile(p), 'utf8');
  assert.deepEqual(JSON.parse(raw), { used: 41, resetsAt: '2026-11-01T00:00:00.000Z', fetchedAt: NOW });
  assert.ok(!raw.includes(TOKEN));
});

test('refreshFable failure keeps old values and sets backoff; recovery clears it', async () => {
  const p = setup();
  const old = { used: 30, resetsAt: '2026-11-01T00:00:00Z', fetchedAt: NOW - 400000 };
  writeJsonAtomic(cacheFile(p), old);
  const args = { p, platform: 'win32', execFileSync: noExec, now: NOW, version: 'v' };
  assert.equal(await refreshFable({ ...args, fetchImpl: async () => ({ ok: false, status: 401 }) }), false);
  assert.deepEqual(readJson(cacheFile(p)), { ...old, backoffUntil: NOW + 900000, why: 'login' });
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
  assert.deepEqual(readJson(cacheFile(p)), { backoffUntil: NOW + 900000, why: 'login' });
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

test('the Keychain read waits long enough to answer the macOS dialog, and with the fetch ends before the fable lock does', () => {
  let opts;
  readToken({ platform: 'darwin', env: {}, execFileSync: (c, a, o) => { opts = o; return '{}'; } });
  assert.ok(opts.timeout >= 20000 && opts.timeout < readings.FABLE_LOCK_MS - readings.FETCH_TIMEOUT_MS, String(opts.timeout));
});

test('a Keychain item that security prints as hex is read too', () => {
  const hex = Buffer.from(JSON.stringify({ claudeAiOauth: { accessToken: TOKEN }, mcpOAuth: { 'café': {} } })).toString('hex');
  assert.equal(readToken({ platform: 'darwin', env: {}, execFileSync: () => `${hex}\n` }), TOKEN);
});

test('on a Mac whose Keychain holds no login, juice reads .credentials.json, where Claude Code keeps it then', () => {
  const p = setup();
  assert.equal(readToken({ platform: 'darwin', p, env: {}, execFileSync: notFound }), TOKEN);
  assert.equal(readToken({ platform: 'darwin', p, env: {}, execFileSync: () => '{}' }), TOKEN);
  // An expired login in the Keychain is the answer: the file is not asked to overrule it.
  const old = JSON.stringify({ claudeAiOauth: { accessToken: 'old', expiresAt: NOW - 1 } });
  assert.equal(readToken({ platform: 'darwin', p, env: {}, now: NOW, execFileSync: () => old }), false);
});

// A denied or cancelled Keychain dialog is not a lost login: asking again every 15 minutes would show the dialog all day.
test('on a Mac, a refused Keychain read is told apart from a missing item, and backs off for half a day', async () => {
  const p = setup(); // .credentials.json is there too, and must not overrule a refusal
  assert.equal(readToken({ platform: 'darwin', p, env: {}, execFileSync: refused }), 'denied');
  assert.equal(readToken({ platform: 'darwin', p, env: {}, execFileSync: () => { throw new Error('timed out'); } }), 'denied');
  let called = false;
  assert.equal(await refreshFable({ p, platform: 'darwin', env: {}, execFileSync: refused, fetchImpl: async () => { called = true; }, now: NOW, version: 'v' }), false);
  assert.equal(called, false);
  const c = readJson(cacheFile(p));
  assert.deepEqual(c, { backoffUntil: NOW + 12 * 3600000, why: 'denied' });
  assert.equal(fableCacheState(c, NOW + 3600000).backedOff, true);
  assert.equal(fableCacheState(c, NOW + 12 * 3600000 + 1).backedOff, false);
});

test('the fable lock outlasts the Keychain wait plus the fetch, so a second refresher never starts meanwhile', () => {
  const { FABLE_LOCK_MS, KEYCHAIN_TIMEOUT_MS, FETCH_TIMEOUT_MS } = readings;
  assert.ok(FABLE_LOCK_MS >= KEYCHAIN_TIMEOUT_MS + FETCH_TIMEOUT_MS + 10000, 'margin of at least 10 s');
});
