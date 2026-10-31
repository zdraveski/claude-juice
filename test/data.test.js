import { NOW, fixture } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/data.js';

const nowS = Math.floor(NOW / 1000);
const seen = (ago = 86400000) => ({
  fiveHour: { used: 30, resetsAt: nowS + 3600 },
  sevenDay: { used: 20, resetsAt: nowS + 86400 },
  subscriberSeenAt: NOW.getTime() - ago,
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

test('after a reply that cost something but brought no limits, lastSeen is another account', () => {
  const d = normalize(fixture('payg'), { lastSeen: seen() }, NOW);
  assert.equal(d.account, 'payg');
  assert.deepEqual(d.limits, {});
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

test('fable only when fresh', () => {
  const iso = new Date(NOW.getTime() + 86400000).toISOString();
  const f = (ago) => ({ used: 41, resetsAt: iso, fetchedAt: NOW.getTime() - ago });
  const d = normalize(fixture('busy'), { fable: f(30 * 60000) }, NOW);
  assert.equal(d.limits.fable.used, 41);
  assert.equal(d.limits.fable.windowSec, 604800);
  assert.equal(d.limits.fable.resetsAt.toISOString(), iso);
  assert.equal(normalize(fixture('busy'), { fable: f(2 * 3600000) }, NOW).limits.fable, undefined);
});

// Live usage from Anthropic (cached next to the Fable number) keeps idle and brand-new windows current.
const iso = (s) => new Date((nowS + s) * 1000 + 300).toISOString(); // a few hundred ms off, like the real service
const live = (session, week, ago = 60000) => ({ fetchedAt: NOW.getTime() - ago, session, week });

test('live usage: in the same window the higher reading wins', () => {
  const d = normalize(fixture('busy'), { fable: live({ used: 60, resetsAt: iso(7800) }, { used: 40, resetsAt: iso(277200) }) }, NOW);
  assert.equal(d.limits.session.used, 60);
  assert.equal(d.limits.week.used, 50);
});

test('live usage: a newer window wins even with a lower number', () => {
  const d = normalize(fixture('busy'), { fable: live({ used: 3, resetsAt: iso(7800 + 18000) }) }, NOW);
  assert.equal(d.limits.session.used, 3);
  assert.equal(d.limits.session.windowSec, 18000);
});

test('a new chat with no numbers yet shows live usage', () => {
  const d = normalize(newChat(), { lastSeen: seen(), fable: live({ used: 33, resetsAt: iso(3600) }, { used: 25, resetsAt: iso(86400) }) }, NOW);
  assert.equal(d.account, 'subscriber');
  assert.equal(d.limits.session.used, 33);
  assert.equal(d.limits.week.used, 25);
});

test('live usage never makes an API-key user a subscriber, and readings over an hour old are ignored', () => {
  const d = normalize(fixture('payg'), { fable: live({ used: 33, resetsAt: iso(3600) }) }, NOW);
  assert.equal(d.account, 'payg');
  assert.equal(d.limits.session, undefined);
  const old = live({ used: 99, resetsAt: iso(7800) }, undefined, 2 * 3600000);
  assert.equal(normalize(fixture('busy'), { fable: old }, NOW).limits.session.used, 47);
});

test('API-key and gateway users never get a Fable battery, even with a fresh Fable reading', () => {
  const fable = { used: 41, resetsAt: new Date(NOW.getTime() + 86400000).toISOString(), fetchedAt: NOW.getTime() - 60000 };
  for (const name of ['payg', 'gateway']) assert.equal(normalize(fixture(name), { fable }, NOW).limits.fable, undefined, name);
  assert.equal(normalize(fixture('busy'), { fable }, NOW).limits.fable.used, 41, 'subscribers still get it');
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
  const f = normalize(fixture('busy'), { fable: { used: 5, resetsAt: 'garbage', fetchedAt: NOW.getTime() } }, NOW);
  assert.equal(f.limits.fable.resetsAt, null);
  const l = normalize(newChat(), { lastSeen: { ...seen(), fiveHour: { used: 30, resetsAt: 1e20 } } }, NOW);
  assert.equal(l.limits.session.resetsAt, null);
});

test('model name loses OSC sequences and line breaks', () => {
  const s = fixture('busy');
  s.model.display_name = '\x1b]0;x\x07\x1b[31mhi';
  assert.equal(normalize(s, {}, NOW).model.name, 'hi');
  s.model.display_name = ' a\nb\tc ';
  assert.equal(normalize(s, {}, NOW).model.name, 'a b c');
});
