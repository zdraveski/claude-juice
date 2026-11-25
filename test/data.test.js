import { NOW, at, fixture } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalize } from '../plugin/src/data.js';
import { remember } from '../plugin/src/lastseen.js';
import { sendsPromptCache } from '../plugin/src/readings.js';

const nowS = Math.floor(NOW / 1000);
// Last seen as lastseen.js answers it: the saved Session and Weekly readings, no other chats.
const seen = (ago = 86400000, five = { used: 30, resetsAt: nowS + 3600 }, seven = { used: 20, resetsAt: nowS + 86400 }) => ({
  subscriberSeenAt: NOW.getTime() - ago,
  session: { saved: five, sent: [] },
  week: { saved: seven, sent: [] },
});
// A chat before its first reply: no rate_limits and nothing spent yet.
const newChat = () => ({ ...fixture('payg'), cost: { total_cost_usd: 0 } });

test('busy subscriber', () => {
  const d = normalize(fixture('busy'), {}, NOW);
  assert.equal(d.account, 'subscriber');
  assert.equal(d.limits.session.used, 47);
  assert.equal(d.limits.session.windowSec, 18000);
  assert.equal(d.limits.session.resetsAt.getTime(), (nowS + 7800) * 1000);
  assert.equal(d.limits.week.windowSec, 604800);
  assert.equal(d.memoryUsed, 64);
  assert.equal(d.effort, 'high');
  assert.equal(d.costUsd, 3.42);
  assert.deepEqual(d.model, { name: 'Opus 5.5', isFable: false });
  assert.equal(d.now, NOW);
});

// Claude Code sends one decimal: 99.6 is nearly out, not out, so it must not show (and act) as used up.
test('a limit shows 100% only when it really is used up', () => {
  const used = (p) => normalize({ rate_limits: { five_hour: { used_percentage: p, resets_at: nowS + 3600 } } }, {}, NOW).limits.session.used;
  assert.deepEqual([99.4, 99.5, 99.6, 99.9, 100, 100.4, 130, 0.4, -3].map(used), [99, 99, 99, 99, 100, 100, 100, 0, 0]);
});

test('this window\'s number beats a saved one that has already ended, even without a reset time', () => {
  const ended = seen(undefined, { used: 30, resetsAt: nowS - 7200 });
  const d = normalize({ rate_limits: { five_hour: { used_percentage: 95 } } }, { lastSeen: ended }, NOW);
  assert.equal(d.limits.session.used, 95, 'not the ended 30%, which would show as an empty battery');
});

test('payg without lastSeen', () => {
  for (const name of ['payg', 'empty-rate-limits']) {
    const d = normalize(fixture(name), { lastSeen: null }, NOW);
    assert.equal(d.account, 'payg');
    assert.equal(d.limits.session, undefined);
    assert.equal(d.limits.week, undefined);
  }
});

test('lastSeen within 30 days makes a subscriber and fills the windows', () => {
  const d = normalize(newChat(), { lastSeen: seen() }, NOW);
  assert.equal(d.account, 'subscriber');
  assert.equal(d.limits.session.used, 30);
  assert.equal(d.limits.week.used, 20);
  assert.equal(d.limits.week.windowSec, 604800);
});

test('after a reply that brought no limits, lastSeen is another account', () => {
  const replied = { ...fixture('payg'), prompt_cache: { warm: true } }; // Claude Code adds prompt_cache after the first reply
  const d = normalize(replied, { lastSeen: seen() }, NOW);
  assert.equal(d.account, 'payg');
  assert.deepEqual(d.limits, {});
});

test('on Claude Code before 2.1.251 (no prompt_cache ever), a resumed chat keeps its batteries instead of "spent $"', () => {
  assert.deepEqual(['2.1.250', '2.1.251', '2.2.0', '3.0.0', '1.9.999', undefined, 'x'].map(sendsPromptCache), [false, true, true, true, false, true, true]);
  const resumed = { ...fixture('payg'), version: '2.1.200' }; // cost restored by --resume, no rate_limits yet
  const d = normalize(resumed, { lastSeen: seen() }, NOW);
  assert.equal(d.account, 'subscriber');
  assert.equal(d.limits.session.used, 30);
});

test('a resumed chat (cost restored, no reply yet) still counts as the subscriber it was', () => {
  const resumed = fixture('payg'); // cost 1.25, no rate_limits, no prompt_cache
  const d = normalize(resumed, { lastSeen: seen() }, NOW);
  assert.equal(d.account, 'subscriber');
  assert.equal(d.limits.session.used, 30);
});

test('an idle window shows the newer saved reading, not its own old one', () => {
  const idle = fixture('busy'); // its own Session: 47%, window ends in 2h 10m
  const newer = seen(undefined, { used: 60, resetsAt: nowS + 7800 }); // another session saw 60% since
  assert.equal(normalize(idle, { lastSeen: newer }, NOW).limits.session.used, 60);
  idle.rate_limits.five_hour = { used_percentage: 90, resets_at: nowS - 600 }; // its window already ended
  const nextWindow = seen(undefined, { used: 4, resetsAt: nowS + 17000 });
  assert.equal(normalize(idle, { lastSeen: nextWindow }, NOW).limits.session.used, 4);
});

test('lastSeen older than 30 days is payg', () => {
  const d = normalize(fixture('payg'), { lastSeen: seen(31 * 86400000) }, NOW);
  assert.equal(d.account, 'payg');
  assert.equal(d.limits.session, undefined);
});

test('fresh stdin beats lastSeen', () => {
  const d = normalize(fixture('busy'), { lastSeen: seen() }, NOW);
  assert.equal(d.limits.session.used, 47);
});

test('gateway has a budget and no session/week', () => {
  const d = normalize(fixture('gateway'), {}, NOW);
  assert.equal(d.account, 'gateway');
  assert.equal(d.limits.budget.used, 63);
  assert.equal(d.limits.budget.windowSec, null);
  assert.equal(d.limits.budget.resetsAt.getTime(), (nowS + 864000) * 1000);
  assert.equal(d.limits.session, undefined);
  assert.equal(d.limits.week, undefined);
});

test('spend_limit without used_percentage omits budget', () => {
  const s = fixture('gateway');
  delete s.rate_limits.spend_limit.used_percentage;
  assert.equal(normalize(s, {}, NOW).limits.budget, undefined);
});

// How old a fetched reading may be is readFetched's rule (test/fetched.test.js): here it arrives already counting.
test('fable only from a fetched reading', () => {
  const iso = new Date(NOW.getTime() + 86400000).toISOString();
  const d = normalize(fixture('busy'), { fetched: { fable: { used: 41, resetsAt: iso } } }, NOW);
  assert.equal(d.limits.fable.used, 41);
  assert.equal(d.limits.fable.windowSec, 604800);
  assert.equal(d.limits.fable.resetsAt.toISOString(), iso);
  assert.equal(normalize(fixture('busy'), {}, NOW).limits.fable, undefined);
});

// Live usage from Anthropic (fetched next to the Fable number) keeps idle and brand-new windows current.
const iso = (s) => new Date((nowS + s) * 1000 + 300).toISOString(); // a few hundred ms off, like the real service
const live = (session, week) => ({ session, week });

test('live usage: in the same window the higher reading wins', () => {
  const d = normalize(fixture('busy'), { fetched: live({ used: 60, resetsAt: iso(7800) }, { used: 40, resetsAt: iso(277200) }) }, NOW);
  assert.equal(d.limits.session.used, 60);
  assert.equal(d.limits.week.used, 50);
});

test('live usage: a newer window wins even with a lower number, once ours has ended', () => {
  const s = fixture('busy');
  s.rate_limits.five_hour.resets_at = nowS - 60; // an idle window still showing the window that just ended
  const d = normalize(s, { fetched: live({ used: 3, resetsAt: iso(18000 - 60) }) }, NOW);
  assert.equal(d.limits.session.used, 3);
  assert.equal(d.limits.session.windowSec, 18000);
});

test('live usage: at the reset, a window one source says still runs is not shown as reset', () => {
  const s = fixture('busy');
  s.rate_limits.five_hour = { used_percentage: 28, resets_at: nowS }; // this window says it resets right now
  const d = normalize(s, { fetched: live({ used: 28, resetsAt: iso(6) }) }, NOW); // the service: 6 seconds more
  assert.equal(d.limits.session.used, 28);
  assert.ok(d.limits.session.resetsAt > NOW, 'not drawn as refilled while the service still counts it');
});

test('live usage from another window while ours is still running is another account, so ours stays', () => {
  const d = normalize(fixture('busy'), { fetched: live({ used: 80, resetsAt: iso(7800 + 9000) }, { used: 70, resetsAt: iso(500000) }) }, NOW);
  assert.equal(d.limits.session.used, 47);
  assert.equal(d.limits.week.used, 50);
});

test('a new chat with no numbers yet shows live usage', () => {
  const d = normalize(newChat(), { lastSeen: seen(), fetched: live({ used: 33, resetsAt: iso(3600) }, { used: 25, resetsAt: iso(86400) }) }, NOW);
  assert.equal(d.account, 'subscriber');
  assert.equal(d.limits.session.used, 33);
  assert.equal(d.limits.week.used, 25);
});

test('live usage never makes an API-key user a subscriber', () => {
  const d = normalize(fixture('payg'), { fetched: live({ used: 33, resetsAt: iso(3600) }) }, NOW);
  assert.equal(d.account, 'payg');
  assert.equal(d.limits.session, undefined);
});

test('API-key and gateway users never get a Fable battery, even with a fresh Fable reading', () => {
  const fetched = { fable: { used: 41, resetsAt: new Date(NOW.getTime() + 86400000).toISOString() } };
  for (const name of ['payg', 'gateway']) assert.equal(normalize(fixture(name), { fetched }, NOW).limits.fable, undefined, name);
  assert.equal(normalize(fixture('busy'), { fetched }, NOW).limits.fable.used, 41, 'subscribers still get it');
});

test('model name is stripped; fable detected by id then name', () => {
  const s = fixture('busy');
  s.model.display_name = '\x1b[31mOpus\x1b[0m';
  assert.equal(normalize(s, {}, NOW).model.name, 'Opus');
  s.model = { id: 'claude-fable-5-1', display_name: 'X' };
  assert.equal(normalize(s, {}, NOW).model.isFable, true);
  s.model = { display_name: 'Fable 5.1' };
  assert.equal(normalize(s, {}, NOW).model.isFable, true);
  s.model = { id: 'x' };
  assert.equal(normalize(s, {}, NOW).model, null);
});

test('memoryUsed falls back to current_usage, else null', () => {
  const s = fixture('busy');
  s.context_window.used_percentage = null;
  s.context_window.current_usage = { input_tokens: 20000, cache_creation_input_tokens: 40000, cache_read_input_tokens: 60000 };
  assert.equal(normalize(s, {}, NOW).memoryUsed, 60);
  s.context_window.current_usage = null;
  assert.equal(normalize(s, {}, NOW).memoryUsed, null);
  s.context_window = { context_window_size: 1000000, used_percentage: 12 };
  assert.equal(normalize(s, {}, NOW).memoryUsed, 12);
});

test('odd input hides pieces and clamps', () => {
  const s = fixture('busy');
  s.context_window.used_percentage = 140;
  s.rate_limits.five_hour.used_percentage = NaN;
  s.rate_limits.seven_day.used_percentage = -5;
  s.effort.level = 'turbo';
  s.cost.total_cost_usd = 'x';
  const d = normalize(s, { badges: ['ok', 3, null] }, NOW);
  assert.equal(d.memoryUsed, 100);
  assert.equal(d.limits.session, undefined);
  assert.equal(d.limits.week.used, 0);
  assert.equal(d.effort, null);
  assert.equal(d.costUsd, null);
  assert.deepEqual(d.badges, ['ok']);
});

test('null stdin', () => {
  const d = normalize(null, {}, NOW);
  assert.equal(d.model, null);
  assert.equal(d.effort, null);
  assert.equal(d.memoryUsed, null);
  assert.deepEqual(d.limits, {});
  assert.equal(d.account, 'payg');
  assert.deepEqual(d.badges, []);
});

test('unusable reset times become null, not Invalid Date', () => {
  const s = fixture('busy');
  s.rate_limits.five_hour.resets_at = 1e20;
  assert.equal(normalize(s, {}, NOW).limits.session.resetsAt, null);
  const f = normalize(fixture('busy'), { fetched: { fable: { used: 5, resetsAt: 'garbage' } } }, NOW);
  assert.equal(f.limits.fable.resetsAt, null);
  const l = normalize(newChat(), { lastSeen: seen(undefined, { used: 30, resetsAt: 1e20 }) }, NOW);
  assert.equal(l.limits.session.resetsAt, null);
});

test('model name loses OSC sequences and line breaks', () => {
  const s = fixture('busy');
  s.model.display_name = '\x1b]0;x\x07\x1b[31mhi';
  assert.equal(normalize(s, {}, NOW).model.name, 'hi');
  s.model.display_name = ' a\nb\tc ';
  assert.equal(normalize(s, {}, NOW).model.name, 'a b c');
});

test('a window signed into another account shows its own numbers, not the saved account\'s later window', () => {
  const s = fixture('busy'); // own Session 47%, resets in 2h 10m; own Weekly too
  const other = seen(undefined, { used: 80, resetsAt: nowS + 17000 }, { used: 90, resetsAt: s.rate_limits.seven_day.resets_at + 86400 });
  const d = normalize(s, { lastSeen: other }, NOW);
  assert.equal(d.limits.session.used, 47);
  assert.equal(d.limits.week.used, s.rate_limits.seven_day.used_percentage);
});

// Plays refreshes through remember() then normalize(), as the status line does, and returns what the last one shows.
function play(refreshes) {
  const dir = mkdtempSync(join(tmpdir(), 'juice-data-'));
  try {
    let d;
    for (const [stdin, t] of refreshes) d = normalize(stdin, { lastSeen: remember(stdin, { cacheDir: dir }, t) }, t);
    return d;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('after an account switch, a /clear window\'s old copy cannot lower what a new chat just sent for the same week', () => {
  const weekA = nowS + 5 * 86400, weekB = nowS + 86400; // two accounts, both weeks still running
  const week = (session_id, used, resets_at) => ({ session_id, rate_limits: { seven_day: { used_percentage: used, resets_at } } });
  const b = week('b', 10, weekB), a = week('a-new', 40, weekA), cleared = week('a-cleared', 22, weekA);
  assert.equal(play([[b, NOW], [a, at(10)]]).limits.week.used, 40);
  assert.equal(play([[b, NOW], [a, at(10)], [cleared, at(20)]]).limits.week.used, 40, 'not the 22% the cleared window still carries');
});

test('a reset time sent in milliseconds is not stretched a thousand times', () => {
  const s = fixture('busy');
  s.rate_limits.five_hour.resets_at = (nowS + 7800) * 1000;
  assert.equal(normalize(s, {}, NOW).limits.session.resetsAt.getTime(), (nowS + 7800) * 1000);
});

test('a reset time of zero or below is unknown, not a window that already ended', () => {
  const lim = (resets_at) => normalize({ rate_limits: { five_hour: { used_percentage: 95, resets_at } } }, {}, NOW).limits.session;
  for (const r of [0, -5, '1970-01-01T00:00:00Z', '1969-06-01T00:00:00Z']) {
    assert.equal(lim(r).resetsAt, null, String(r));
    assert.equal(lim(r).used, 95, String(r));
  }
});
