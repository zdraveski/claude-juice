// The fetched reading as the status line, the doctor and /juice see it: whether it is on, what still counts,
// when to ask again, and why the last check failed. Each case writes the file fable.js writes, then reads it.
import { NOW } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../plugin/src/paths.js';
import { readFetched, FRESH_MS, WAIT_MS } from '../plugin/src/fetched.js';

const T = NOW.getTime(), MIN = 60000, HOUR = 60 * MIN;
const at = (ms) => new Date(T + ms);
function folder(saved) {
  const p = paths({ CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'juice-fetched-')) });
  if (saved !== undefined) {
    mkdirSync(p.cacheDir, { recursive: true });
    writeFileSync(p.fableFile, typeof saved === 'string' ? saved : JSON.stringify(saved));
  }
  return p;
}
const good = (ageMs, extra = {}) => ({
  used: 41, resetsAt: '2026-11-01T00:00:00.000Z',
  session: { used: 30, resetsAt: '2026-10-28T05:00:00.000Z' }, week: { used: 20, resetsAt: '2026-11-01T00:00:00.000Z' },
  fetchedAt: T - ageMs, ...extra,
});

test('on: always with on, never with off; auto only for someone who already has a reading, and never on a Mac', () => {
  // auto stays on only for someone who already has a reading (1.3.x turned it on without asking); a new install asks first.
  const has = folder(good(MIN)), none = folder(), damaged = folder('{not json');
  assert.equal(readFetched(has, 'auto', 'win32', NOW).on, true);
  assert.equal(readFetched(has, 'auto', 'linux', NOW).on, true);
  assert.equal(readFetched(damaged, 'auto', 'win32', NOW).on, true, 'a damaged file still counts as having a reading');
  assert.equal(readFetched(none, 'auto', 'win32', NOW).on, false);
  assert.equal(readFetched(has, 'auto', 'darwin', NOW).on, false);
  assert.equal(readFetched(none, 'on', 'darwin', NOW).on, true);
  assert.equal(readFetched(has, 'off', 'linux', NOW).on, false);
});

test('off reads nothing and asks for nothing', () => {
  assert.deepEqual(readFetched(folder(good(MIN)), 'off', 'linux', NOW), { on: false, reading: null, checkedAt: null, due: false, failed: null });
});

test('on with no file yet: nothing to show, and time to ask', () => {
  const f = readFetched(folder(), 'on', 'linux', NOW);
  assert.deepEqual(f, { on: true, reading: null, checkedAt: null, due: true, failed: null });
});

test('a reading counts for an hour and hands over Fable, Session and Weekly', () => {
  const f = readFetched(folder(good(30 * MIN)), 'on', 'linux', NOW);
  assert.deepEqual(f.reading, {
    fable: { used: 41, resetsAt: '2026-11-01T00:00:00.000Z' },
    session: { used: 30, resetsAt: '2026-10-28T05:00:00.000Z' }, week: { used: 20, resetsAt: '2026-11-01T00:00:00.000Z' },
  });
  assert.equal(f.checkedAt.getTime(), T - 30 * MIN);
  assert.ok(readFetched(folder(good(HOUR)), 'on', 'linux', NOW).reading, 'exactly an hour still counts');
  const old = readFetched(folder(good(HOUR + 1)), 'on', 'linux', NOW);
  assert.equal(old.reading, null);
  assert.equal(old.checkedAt.getTime(), T - HOUR - 1, 'the doctor can still say when it was last checked');
});

test('a reading stamped in the future (the clock was ahead) never counts, and is asked again', () => {
  const f = readFetched(folder(good(-10 * MIN)), 'on', 'linux', NOW);
  assert.equal(f.reading, null);
  assert.equal(f.due, true);
});

test('due: past 5 minutes, unless juice is waiting after a failed check', () => {
  assert.equal(readFetched(folder(good(4 * MIN)), 'on', 'linux', NOW).due, false);
  assert.equal(readFetched(folder(good(FRESH_MS)), 'on', 'linux', NOW).due, false, 'exactly 5 minutes is not yet due');
  assert.equal(readFetched(folder(good(6 * MIN)), 'on', 'linux', NOW).due, true);
  assert.equal(readFetched(folder(good(6 * MIN, { backoffUntil: T + 1, why: 'busy' })), 'on', 'linux', NOW).due, false);
  assert.equal(readFetched(folder('{not json'), 'on', 'linux', NOW).due, true);
});

test('failed: why and when juice tries again, while the wait runs', () => {
  const f = readFetched(folder({ backoffUntil: T + 10 * MIN, why: 'offline' }), 'on', 'linux', NOW);
  assert.deepEqual(f.failed, { why: 'offline', retryAt: at(10 * MIN) });
  assert.equal(f.reading, null);
  assert.equal(f.checkedAt, null);
  assert.equal(readFetched(folder({ backoffUntil: T - 1, why: 'offline' }), 'on', 'linux', NOW).failed, null, 'a wait that is over');
});

test('a wait longer than any juice sets can only come from a clock that was ahead, so it is ignored', () => {
  const long = readFetched(folder(good(6 * MIN, { backoffUntil: T + 10 * HOUR, why: 'busy' })), 'on', 'linux', NOW);
  assert.equal(long.failed, null);
  assert.equal(long.due, true);
  // A refused Keychain read waits half a day on purpose.
  const denied = readFetched(folder({ backoffUntil: T + 10 * HOUR, why: 'denied' }), 'on', 'darwin', NOW);
  assert.equal(denied.failed?.why, 'denied');
  // Each reason is held to its own wait: an expired login waits 5 minutes, so 10 is a clock that was ahead.
  assert.equal(readFetched(folder({ backoffUntil: T + 10 * MIN, why: 'expired' }), 'on', 'linux', NOW).failed, null);
  assert.equal(readFetched(folder({ backoffUntil: T + 10 * MIN, why: 'something new' }), 'on', 'linux', NOW).failed?.why, 'something new', 'an unknown reason waits like a failed fetch');
});

test('every wait in the table is one readFetched keeps, to the millisecond', () => {
  for (const [why, ms] of Object.entries(WAIT_MS)) {
    assert.deepEqual(readFetched(folder({ backoffUntil: T + ms, why }), 'on', 'darwin', NOW).failed, { why, retryAt: at(ms) }, why);
  }
});

test('a failed check keeps the last good reading on show while it still counts', () => {
  const f = readFetched(folder(good(20 * MIN, { backoffUntil: T + 5 * MIN, why: 'busy' })), 'on', 'linux', NOW);
  assert.equal(f.reading.fable.used, 41);
  assert.equal(f.failed.why, 'busy');
  assert.equal(f.due, false);
});
