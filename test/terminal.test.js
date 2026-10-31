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
  assert.equal(det({ COLUMNS: '10' }).columns, 20, 'never below 20');
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

const busy = { rate_limits: { five_hour: { used_percentage: 47, resets_at: 1000 }, seven_day: { used_percentage: 12, resets_at: 2000 } } };
test('remember then recall; payg leaves file alone', () => {
  const p = tmpPaths();
  assert.equal(recall(p), null);
  remember(busy, p, NOW);
  const r = recall(p);
  assert.deepEqual([r.fiveHour, r.sevenDay, r.subscriberSeenAt], [{ used: 47, resetsAt: 1000 }, { used: 12, resetsAt: 2000 }, NOW.getTime()]);
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
  remember({ rate_limits: { five_hour: { used_percentage: 50, resets_at: 1000 } } }, p, at(3800));
  assert.equal(recall(p).fiveHour.used, 50);
});
test('an idle window repeating old numbers never overwrites newer ones; real news does, even when lower', () => {
  const p = tmpPaths();
  const reading = (session_id, used, resets_at) => ({ session_id, rate_limits: { five_hour: { used_percentage: used, resets_at } } });
  remember(reading('idle', 20, 1000), p, NOW); // the idle session's last reply
  remember(reading('busy', 60, 1000), p, at(30)); // the busy session's newer reply
  remember(reading('idle', 20, 1000), p, at(60)); // the idle session redraws its old numbers
  assert.equal(recall(p).fiveHour.used, 60);
  remember(reading('busy', 19, 1000), p, at(90)); // plan upgraded mid-window: lower, but real news
  assert.equal(recall(p).fiveHour.used, 19);
  remember(reading('idle', 95, 1000 + 1), p, at(100)); // the idle session gets a reply too: its new numbers are news
  assert.equal(recall(p).fiveHour.used, 95);
  remember(reading('busy', 5, 1000 + 18000), p, at(120)); // the window reset
  assert.deepEqual(recall(p).fiveHour, { used: 5, resetsAt: 19000 });
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
