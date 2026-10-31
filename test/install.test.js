// juice installed into a Claude folder, the way Claude Code runs it: the launcher, the plugin store, links.
import { fixture } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, symlinkSync, lstatSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { paths } from '../src/paths.js';
import { install, restore } from '../src/setup.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const tmp = () => mkdtempSync(join(tmpdir(), 'juice-install-'));
const busyText = JSON.stringify(fixture('busy'));
// Always a temp CLAUDE_CONFIG_DIR: juice must never see the real login.
const node = (args, dir, input = '') => spawnSync(process.execPath, args, { input, encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: dir } });
const installed = () => {
  const d = tmp();
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: ROOT.replaceAll('\\', '/') });
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

test('installed from the plugin store and turned off in /plugin, the launcher says so instead of drawing', () => {
  const d = tmp();
  const root = join(d, 'plugins', 'cache', 'mkt', 'juice', '1.2.3');
  for (const f of ['bin', 'src', 'package.json']) cpSync(join(ROOT, f), join(root, f), { recursive: true });
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: root.replaceAll('\\', '/') });
  assert.match(node([p.launcherFile], d, busyText).stdout, /Session/, 'on: it draws');
  const s = JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8'));
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, enabledPlugins: { 'juice@mkt': false } }));
  const off = node([p.launcherFile], d, busyText);
  assert.match(off.stdout, /juice is turned off/);
  assert.doesNotMatch(off.stdout, /Session/);
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
  assert.equal(r.stdout.trim(), 'juice is not installed. Install it again, then type /juice setup to use it or /juice restore to get your old status line back.');
});

test('setup and restore write through a symlinked settings.json', (t) => {
  const d = tmp(), real = join(tmp(), 'real.json');
  writeFileSync(real, JSON.stringify({ theme: 'dark', statusLine: { type: 'command', command: 'old' } }));
  try { symlinkSync(real, join(d, 'settings.json'), 'file'); } catch { return t.skip('cannot create a symlink here'); }
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: ROOT.replaceAll('\\', '/') });
  assert.ok(lstatSync(join(d, 'settings.json')).isSymbolicLink());
  assert.match(JSON.parse(readFileSync(real, 'utf8')).statusLine.command, /juice-statusline\.mjs/);
  restore(p);
  assert.ok(lstatSync(join(d, 'settings.json')).isSymbolicLink());
  assert.equal(JSON.parse(readFileSync(real, 'utf8')).statusLine.command, 'old');
});
