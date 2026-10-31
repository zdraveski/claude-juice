// Plays thousands of made-up histories (several sessions, idle windows, /clear, limits resetting, an account switch,
// numbers fetched from Anthropic, a clock that jumps back) through juice's readings rules and requires:
// 1. a limit that has reset is never shown while any source has a current one;
// 2. a session seen for the first time never lowers a number in the same window.
// (Until 1.0.0 it also compared every refresh with a frozen copy of 0.2.6's rules: the readings rewrite showed
// exactly the same numbers, so that copy was deleted.)
// A failure names its seed: JUICE_SEED=<n> node --test test/readings.property.test.js replays just that history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { remember } from '../src/lastseen.js';
import { normalize } from '../src/data.js';

const HISTORIES = 150, STEPS = 40;
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const WINDOWS = { five: 5 * HOUR, seven: 7 * DAY };
const START = Date.UTC(2026, 9, 28, 14, 20);

// Small seeded random numbers, so every failure can be replayed.
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n), pick: (xs) => xs[Math.floor(next() * xs.length)] };
}

// An account's real usage: each window moves on (and starts low) once it has reset.
function account(r, now) {
  const w = (len) => ({ used: r.int(60), resetsAt: now + r.int(len) + MIN });
  return { five: w(WINDOWS.five), seven: w(WINDOWS.seven) };
}
function roll(acc, now, r) {
  for (const k of ['five', 'seven']) {
    while (acc[k].resetsAt <= now) acc[k] = { used: r.int(10), resetsAt: acc[k].resetsAt + WINDOWS[k] };
  }
}
// Sources disagree on a reset time by a few seconds (and, rarely, by more than juice's 60 s tolerance).
const jitter = (r) => r.pick([0, 0, r.int(40) - 20, r.int(180) - 90]) * 1000;
const snapshot = (acc, r) => ({
  five_hour: { used_percentage: acc.five.used, resets_at: Math.floor((acc.five.resetsAt + jitter(r)) / 1000) },
  seven_day: { used_percentage: acc.seven.used, resets_at: Math.floor((acc.seven.resetsAt + jitter(r)) / 1000) },
});
const iso = (ms) => new Date(ms).toISOString();

function history(seed) {
  const r = rng(seed);
  const dir = mkdtempSync(join(tmpdir(), 'juice-prop-'));
  const p = { cacheDir: dir };
  const log = [];
  try {
    let now = START;
    const accounts = { a: account(r, now), b: account(r, now), payg: null, gateway: null };
    let current = 'a';
    let fable = null;
    const sessions = new Map(); // id -> what that window last sent
    let nextId = 0;
    let prev = null; // last refresh: { now, fable, data }

    for (let step = 0; step < STEPS; step++) {
      const what = r.pick(['tick', 'tick', 'use', 'reply', 'reply', 'idle', 'idle', 'start', 'clear', 'switch', 'fetch', 'skew']);
      let refresh = null; // [id, isNewSession]
      if (what === 'tick') now += r.pick([r.int(90) * MIN, r.int(90) * MIN, 6 * HOUR, 3 * DAY]);
      if (what === 'skew') now -= r.int(10) * MIN;
      for (const k of ['a', 'b']) roll(accounts[k], now, r);
      if (what === 'use' && accounts[current]) for (const k of ['five', 'seven']) accounts[current][k].used = Math.min(100, accounts[current][k].used + r.int(15));
      if (what === 'switch') current = r.pick(['a', 'b', 'payg', 'gateway'].filter((k) => k !== current));
      if (what === 'fetch') {
        const acc = accounts[r.next() < 0.8 ? current : 'a'] ?? accounts.a;
        fable = r.next() < 0.15 ? null : {
          used: r.int(100), resetsAt: iso(acc.seven.resetsAt + jitter(r)),
          session: { used: acc.five.used, resetsAt: iso(acc.five.resetsAt + jitter(r)) },
          week: { used: acc.seven.used, resetsAt: iso(acc.seven.resetsAt + jitter(r)) },
          fetchedAt: now - r.int(70) * MIN,
        };
      }
      const version = r.pick(['2.1.300', '2.1.300', '2.1.200', undefined]);
      const limitsNow = () => {
        if (current === 'gateway') return { spend_limit: { used_percentage: r.int(100), resets_at: Math.floor((now + DAY) / 1000) } };
        return accounts[current] ? snapshot(accounts[current], r) : undefined;
      };
      if (what === 'reply') {
        const id = sessions.size && r.next() < 0.7 ? r.pick([...sessions.keys()]) : `s${nextId++}`;
        refresh = [id, !sessions.has(id)];
        sessions.set(id, { rate_limits: limitsNow(), replied: true, version });
      }
      if (what === 'idle' && sessions.size) refresh = [r.pick([...sessions.keys()]), false];
      if (what === 'start') {
        // A new window before its first reply: nothing yet, or (a resumed chat) numbers from some time ago.
        const id = `s${nextId++}`;
        const old = r.next() < 0.5 ? undefined : snapshot(account(r, now - r.int(3 * DAY)), r);
        sessions.set(id, { rate_limits: old, replied: false, version });
        refresh = [id, true];
      }
      if (what === 'clear' && sessions.size) {
        // /clear: a new session id that still carries the old window's numbers.
        const from = sessions.get(r.pick([...sessions.keys()]));
        const id = `s${nextId++}`;
        sessions.set(id, { ...from, replied: false });
        refresh = [id, true];
      }
      if (!refresh) continue;

      const [id, isNew] = refresh;
      const s = sessions.get(id);
      const stdin = { session_id: id, model: { display_name: 'Opus 5.5', id: 'claude-opus-5-5' } };
      if (s.version) stdin.version = s.version;
      if (s.rate_limits) stdin.rate_limits = s.rate_limits;
      if (s.replied) stdin.prompt_cache = { ttl: '5m' };
      const at = new Date(now);
      log.push(`${step} ${what} ${id}${isNew ? ' (new)' : ''} now=${iso(now)} ${JSON.stringify(stdin.rate_limits ?? null)} fable=${JSON.stringify(fable)}`);

      const rec = remember(stdin, p, at);
      const data = normalize(stdin, { lastSeen: rec, fable }, at);
      const where = `seed ${seed}, step ${step}\n${log.slice(-8).join('\n')}`;

      // 1. A reset limit never hides a current one from any source.
      for (const [key, five, kept] of [['session', 'five_hour', 'fiveHour'], ['week', 'seven_day', 'sevenDay']]) {
        const shown = data.limits[key];
        if (!shown?.resetsAt || shown.resetsAt.getTime() > now) continue;
        const own = stdin.rate_limits?.[five];
        const f = fable && now - fable.fetchedAt >= 0 && now - fable.fetchedAt <= HOUR ? fable[key] : null;
        const current = [own && own.resets_at * 1000, rec?.[kept] && rec[kept].resetsAt * 1000, f && Date.parse(f.resetsAt)]
          .some((t) => t > now);
        assert.ok(!current, `${key} shows a reset limit while a current one exists at ${where}`);
      }

      // 2. A session seen for the first time never lowers a number in the same window.
      if (isNew && prev && prev.now === now && prev.fable === fable && data.account === 'subscriber' && prev.data.account === 'subscriber') {
        for (const key of ['session', 'week']) {
          const a = prev.data.limits[key], b = data.limits[key];
          if (a?.resetsAt && b?.resetsAt && a.resetsAt.getTime() === b.resetsAt.getTime()) {
            assert.ok(b.used >= a.used, `a new session lowered ${key} from ${a.used} to ${b.used} at ${where}`);
          }
        }
      }
      prev = { now, fable, data };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('readings: no reset limit hiding a current one, no new session lowering a number', () => {
  const only = process.env.JUICE_SEED;
  const seeds = only ? [Number(only)] : Array.from({ length: HISTORIES }, (_, i) => i + 1);
  for (const seed of seeds) history(seed);
});
