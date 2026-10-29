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
    { columns: 80, theme: 'dark', ends: 'round', colorDepth: 'truecolor' });
});
test('columns fallback', () => {
  assert.equal(det({}).columns, 120);
  assert.equal(det({ COLUMNS: 'abc' }).columns, 120);
  assert.equal(det({ COLUMNS: '0' }).columns, 120);
});
test('theme', () => {
  assert.equal(det({}, DEFAULTS, 'light-daltonized').theme, 'light');
  assert.equal(det({}, DEFAULTS, 'auto').theme, 'dark');
  assert.equal(det({}, { ...DEFAULTS, terminal: 'light' }, 'dark').theme, 'light');
});
test('ends', () => {
  assert.equal(det({ TERM_PROGRAM: 'iTerm.app' }).ends, 'plain');
  assert.equal(det({ TERM_PROGRAM: 'iTerm.app' }, { ...DEFAULTS, ends: 'round' }).ends, 'round');
});
test('colour depth', () => {
  assert.equal(det({}).colorDepth, '256');
  assert.equal(det({ COLORTERM: '24bit' }).colorDepth, 'truecolor');
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
  assert.deepEqual(r, { fiveHour: { used: 47, resetsAt: 1000 }, sevenDay: { used: 12, resetsAt: 2000 }, subscriberSeenAt: NOW.getTime() });
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
