import { fixture, strip, NOW, at } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, lstatSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { paths } from '../src/paths.js';
import { install, restore } from '../src/setup.js';
import { normalize } from '../src/data.js';
import { render } from '../src/render/index.js';
import { vis } from '../src/render/ansi.js';
import { DEFAULTS, LAYOUT_IDS } from '../src/schema.js';
import { runStatusLine } from '../src/statusline.js';
import { readBadges, refreshBadges, run } from '../src/badges.js';
import { fableCacheState } from '../src/fable.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const tmp = () => mkdtempSync(join(tmpdir(), 'juice-ff-'));
const busyText = JSON.stringify(fixture('busy'));
const TERM = { columns: 200, theme: 'dark', ends: 'round', colorDepth: 'truecolor' };
// Always a temp CLAUDE_CONFIG_DIR: juice must never see the real login.
const node = (args, dir, input = '') => spawnSync(process.execPath, args, { input, encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: dir } });
const installed = () => {
  const d = tmp();
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: ROOT.replaceAll('\\', '/'), inPluginCache: false });
  return { d, p };
};

test('installed launcher is a .mjs and runs end to end', () => {
  const { d, p } = installed();
  assert.match(p.launcherFile, /juice-statusline\.mjs$/);
  const r = node([p.launcherFile], d, busyText);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Session/);
  assert.equal(r.stderr, '');
  // Node 18 and 20.0-20.9 reject this flag; they never guess the module type anyway.
  if (!process.allowedNodeEnvironmentFlags.has('--no-experimental-detect-module')) return;
  const old = node(['--no-experimental-detect-module', p.launcherFile], d, busyText);
  assert.equal(old.status, 0);
  assert.match(old.stdout, /Session/);
  assert.equal(old.stderr, '');
});

test('launcher works through a junction or symlink', (t) => {
  const { d } = installed();
  const link = join(tmp(), 'link');
  try { symlinkSync(d, link, 'junction'); } catch { return t.skip('cannot create a link here'); }
  const r = node([join(link, 'juice-statusline.mjs')], d, busyText);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Session/);
});

test('launcher says how to get back when juice is gone', () => {
  const r = node([join(ROOT, 'bin', 'launcher.js')], tmp(), busyText);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'juice is not installed. Reinstall it and type /juice restore to get your old status line back.');
});

test('64.1 used renders as 64% used in every layout; token memory is whole', () => {
  const d = normalize({ ...fixture('busy'), context_window: { used_percentage: 64.1 } }, {}, NOW);
  assert.equal(d.memoryUsed, 64);
  for (const layout of LAYOUT_IDS) {
    const s = strip(render(d, { ...DEFAULTS, layout }, TERM).text);
    assert.match(s, /64%/, layout);
    assert.doesNotMatch(s, /\d\.\d{3,}/, layout);
  }
  const t = normalize({ context_window: { context_window_size: 3, current_usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }, {}, NOW);
  assert.equal(t.memoryUsed, 33);
});

test('badges refresh again after 2.5 s, not after 1 s', async () => {
  const dir = tmp();
  const calls = [];
  const go = (s) => runStatusLine({ stdinText: busyText, env: { CLAUDE_CONFIG_DIR: dir }, now: at(s), platform: 'darwin', spawnDetached: (a) => calls.push(a) });
  writeFileSync(join(dir, 'juice.json'), JSON.stringify({ badges: [{ command: 'echo hi' }] }));
  await go(0);
  await go(1);
  assert.equal(calls.length, 1);
  await go(3);
  assert.equal(calls.length, 2);
});

test('a cache stamped in the future counts as stale', async () => {
  assert.equal(fableCacheState({ fetchedAt: +NOW + 5000, used: 1 }, +NOW).stale, true);
  assert.equal(fableCacheState({ fetchedAt: +NOW + 5000, used: 1 }, +NOW).usable, false);
  assert.equal(fableCacheState({ fetchedAt: +NOW - 1000, used: 1 }, +NOW).usable, true);
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  await refreshBadges({ p, settings: { badges: [{ command: 'x' }] }, key: 'k', stdinText: '', runImpl: async () => ({ ok: true, stdout: 'a' }) });
  assert.equal(readBadges(p, 'k', new Date(Date.now() - 60000)).stale, true);
});

test('badge output is capped at 4096 characters', async () => {
  const r = await run('node -e "process.stdout.write(\'x\'.repeat(100000))"', { input: '', timeoutMs: 5000 });
  assert.ok(r.stdout.length <= 4096, `got ${r.stdout.length}`);
});

test('an empty badge leaves no gap at the start of the line', () => {
  const d = { ...normalize(fixture('busy'), {}, NOW), badges: ['', ''] };
  for (const layout of LAYOUT_IDS) {
    const s = strip(render(d, { ...DEFAULTS, layout }, TERM).text);
    assert.doesNotMatch(s, /^\s/, layout);
  }
});

test('CJK characters count as 2 columns', () => {
  assert.equal(vis('日本語'), 6);
  assert.equal(vis('한글'), 4);
  assert.equal(vis('ａ'), 2);
  assert.equal(vis('abc'), 3);
});

test('refresh-badges sweeps old cache files only', async () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  mkdirSync(join(p.cacheDir, 'badges'), { recursive: true });
  const old = new Date(Date.now() - 8 * 86400000);
  const mk = (f, aged) => { const x = join(p.cacheDir, f); writeFileSync(x, '1'); if (aged) utimesSync(x, old, old); return x; };
  const gone = [mk('badges/old.json', 1), mk('badges-abc.lock', 1), mk('x.json.1.tmp', 1)];
  const kept = [mk('badges/new.json', 0), mk('fable.json', 1), mk('lastseen.json', 1), mk('badges-new.lock', 0)];
  await refreshBadges({ p, settings: { badges: [] }, key: 'k', stdinText: '', runImpl: async () => ({ ok: true, stdout: '' }) });
  gone.forEach((f) => assert.equal(existsSync(f), false, f));
  kept.forEach((f) => assert.equal(existsSync(f), true, f));
});

test('setup and restore write through a symlinked settings.json', (t) => {
  const d = tmp(), real = join(tmp(), 'real.json');
  writeFileSync(real, JSON.stringify({ theme: 'dark', statusLine: { type: 'command', command: 'old' } }));
  try { symlinkSync(real, join(d, 'settings.json'), 'file'); } catch { return t.skip('cannot create a symlink here'); }
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: ROOT.replaceAll('\\', '/'), inPluginCache: false });
  assert.ok(lstatSync(join(d, 'settings.json')).isSymbolicLink());
  assert.match(JSON.parse(readFileSync(real, 'utf8')).statusLine.command, /juice-statusline\.mjs/);
  restore(p);
  assert.ok(lstatSync(join(d, 'settings.json')).isSymbolicLink());
  assert.equal(JSON.parse(readFileSync(real, 'utf8')).statusLine.command, 'old');
});

test('parseLink throws on a bad link and returns settings for a good one', async () => {
  const { parseLink, encodeLink } = await import('../src/schema.js');
  assert.throws(() => parseLink('#c=!!!'));
  assert.throws(() => parseLink(''));
  assert.equal(parseLink('#c=' + encodeLink({ ...DEFAULTS, layout: 'panel' })).layout, 'panel');
});
