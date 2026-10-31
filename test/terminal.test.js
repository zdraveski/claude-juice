import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../src/paths.js';
import { DEFAULTS } from '../src/schema.js';
import { detectTerminal, readClaudeTheme } from '../src/terminal.js';
import { remember, recall } from '../src/lastseen.js';
import { NOW, at } from './helpers.js';

const det = (env = {}, settings = DEFAULTS, claudeTheme = null) => detectTerminal({ env, settings, claudeTheme });
const tmpPaths = () => paths({ CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'juice-')) });

test('detects everything from env', () => {
  assert.deepEqual(det({ COLUMNS: '80', TERM_PROGRAM: 'vscode', COLORTERM: 'truecolor' }, DEFAULTS, 'dark'),
    { columns: 76, theme: 'dark', ends: 'round', colorDepth: 'truecolor' }, "four columns stay free for Claude Code's indent");
});
test('columns fallback', () => {
  assert.equal(det({}).columns, 116);
  assert.equal(det({ COLUMNS: 'abc' }).columns, 116);
  assert.equal(det({ COLUMNS: '0' }).columns, 116);
  assert.equal(det({ COLUMNS: '10' }).columns, 6, 'a tiny window still gets a line that fits');
  assert.equal(det({ COLUMNS: '3' }).columns, 1);
});
test('theme', () => {
  assert.equal(det({}, DEFAULTS, 'light-daltonized').theme, 'light');
  assert.equal(det({}, DEFAULTS, 'auto').theme, 'dark');
  assert.equal(det({ COLORFGBG: '0;15' }, DEFAULTS, 'auto').theme, 'light', "Claude's auto theme follows a light terminal");
  assert.equal(det({ COLORFGBG: '0;default;7' }, DEFAULTS, null).theme, 'light');
  assert.equal(det({ COLORFGBG: '15;0' }, DEFAULTS, 'auto').theme, 'dark');
  assert.equal(det({ COLORFGBG: '0;15' }, DEFAULTS, 'dark').theme, 'dark', 'an explicit Claude theme wins');
  assert.equal(det({}, { ...DEFAULTS, terminal: 'light' }, 'dark').theme, 'light');
});
test('ends', () => {
  assert.equal(det({ TERM_PROGRAM: 'iTerm.app' }).ends, 'plain');
  assert.equal(det({ TERM_PROGRAM: 'iTerm.app' }, { ...DEFAULTS, ends: 'round' }).ends, 'round');
});
test('colour depth', () => {
  assert.equal(det({}).colorDepth, '256');
  assert.equal(det({ COLORTERM: '24bit' }).colorDepth, 'truecolor');
  assert.equal(det({ WT_SESSION: 'a1b2' }).colorDepth, 'truecolor');
  assert.equal(det({ NO_COLOR: '1', COLORTERM: 'truecolor' }).colorDepth, 'none');
  assert.equal(det({ NO_COLOR: '' }).colorDepth, '256', 'an empty NO_COLOR does not count');
});
test('readClaudeTheme', () => {
  const d = mkdtempSync(join(tmpdir(), 'juice-'));
  assert.equal(readClaudeTheme(join(d, 'nope.json')), null);
  writeFileSync(join(d, 'bad.json'), '{x');
  assert.equal(readClaudeTheme(join(d, 'bad.json')), null);
  writeFileSync(join(d, 'ok.json'), '{"theme":"light"}');
  assert.equal(readClaudeTheme(join(d, 'ok.json')), 'light');
});

// Resets in the future of NOW: a reading from a window that has already ended never replaces anything.
const R5 = Math.floor(NOW / 1000) + 18000, R7 = R5 + 86400;
const busy = { rate_limits: { five_hour: { used_percentage: 47, resets_at: R5 }, seven_day: { used_percentage: 12, resets_at: R7 } } };
test('remember then recall; payg leaves file alone', () => {
  const p = tmpPaths();
  assert.equal(recall(p), null);
  remember(busy, p, NOW);
  const r = recall(p);
  assert.deepEqual([r.fiveHour, r.sevenDay, r.subscriberSeenAt], [{ used: 47, resetsAt: R5 }, { used: 12, resetsAt: R7 }, NOW.getTime()]);
  remember({}, p, at(60));
  remember({ rate_limits: {} }, p, at(60));
  assert.deepEqual(recall(p), r);
});
test('unchanged values within the hour do not rewrite; later they refresh the stamp', () => {
  const p = tmpPaths();
  remember(busy, p, NOW);
  const file = join(p.cacheDir, 'lastseen.json');
  const m = statSync(file).mtimeMs;
  remember(busy, p, at(600));
  assert.equal(statSync(file).mtimeMs, m);
  assert.equal(recall(p).subscriberSeenAt, NOW.getTime());
  remember(busy, p, at(3700));
  assert.equal(recall(p).subscriberSeenAt, at(3700).getTime());
  remember({ rate_limits: { five_hour: { used_percentage: 50, resets_at: R5 } } }, p, at(3800));
  assert.equal(recall(p).fiveHour.used, 50);
});
test('an idle window repeating old numbers never overwrites newer ones; real news does, even when lower', () => {
  const p = tmpPaths();
  const reading = (session_id, used, resets_at) => ({ session_id, rate_limits: { five_hour: { used_percentage: used, resets_at } } });
  remember(reading('idle', 20, R5), p, NOW); // the idle session's last reply
  remember(reading('busy', 60, R5), p, at(30)); // the busy session's newer reply
  remember(reading('idle', 20, R5), p, at(60)); // the idle session redraws its old numbers
  assert.equal(recall(p).fiveHour.used, 60);
  remember(reading('busy', 19, R5), p, at(90)); // plan upgraded mid-window: lower, but real news
  assert.equal(recall(p).fiveHour.used, 19);
  remember(reading('idle', 95, R5 + 1), p, at(100)); // the idle session gets a reply too: its new numbers are news
  assert.equal(recall(p).fiveHour.used, 95);
  remember(reading('busy', 5, R5 + 18000), p, at(120)); // the window reset
  assert.deepEqual(recall(p).fiveHour, { used: 5, resetsAt: R5 + 18000 });
});

test('a session seen for the first time (after /clear, or an upgrade) cannot lower the saved reading', () => {
  const p = tmpPaths();
  const reading = (session_id, used, resets_at) => ({ session_id, rate_limits: { five_hour: { used_percentage: used, resets_at } } });
  remember(reading('a', 40, R5), p, NOW);
  remember(reading('a', 60, R5), p, at(10));
  remember(reading('a-cleared', 40, R5), p, at(20)); // same process, new session id, its old numbers
  assert.equal(recall(p).fiveHour.used, 60);
  remember(reading('new-chat', 70, R5), p, at(30)); // a new chat's first reply is higher: it counts
  assert.equal(recall(p).fiveHour.used, 70);
});

test('after an account switch, the idle window of the old account cannot bring its numbers back', () => {
  const p = tmpPaths();
  const reading = (session_id, used, resets_at) => ({ session_id, rate_limits: { five_hour: { used_percentage: used, resets_at } } });
  remember(reading('s1', 40, R5 + 7200), p, NOW); // account A
  remember(reading('s2', 40, R5 + 7200), p, at(5)); // account A, another window
  remember(reading('s1', 10, R5), p, at(10)); // s1 switched to account B and replied
  remember(reading('s2', 40, R5 + 7200), p, at(15)); // s2 still repeats A: its window is later, but B's is running
  assert.deepEqual(recall(p).fiveHour, { used: 10, resetsAt: R5 });
});

test('a reading from a window that has already ended never replaces the current one', () => {
  const p = tmpPaths();
  const reading = (session_id, used, resets_at) => ({ session_id, rate_limits: { five_hour: { used_percentage: used, resets_at } } });
  remember(reading('a', 5, R5), p, NOW);
  remember(reading('old', 90, Math.floor(NOW / 1000) - 60), p, at(5));
  assert.equal(recall(p).fiveHour.used, 5);
});

test('remember returns what it saved, so the refresh that saw it already uses it', () => {
  const p = tmpPaths();
  assert.equal(remember(busy, p, NOW).fiveHour.used, 47);
  assert.equal(remember({}, p, at(5)).fiveHour.used, 47, 'nothing new: the saved record');
});

test('a stamp from the future is rewritten, not kept', () => {
  const p = tmpPaths();
  remember(busy, p, at(7200)); // clock 2 hours ahead
  remember(busy, p, at(60)); // clock corrected
  assert.equal(recall(p).subscriberSeenAt, at(60).getTime());
});

test('remember never throws; recall of corrupt file is null', () => {
  const p = tmpPaths();
  writeFileSync(join(p.config, 'juice-cache'), 'a file where the dir should be');
  assert.doesNotThrow(() => remember(busy, p, NOW));
  const q = tmpPaths();
  remember(busy, q, NOW);
  writeFileSync(join(q.cacheDir, 'lastseen.json'), '[1]');
  assert.equal(recall(q), null);
  assert.equal(recall({ cacheDir: '/nonexistent/x' }), null);
});
