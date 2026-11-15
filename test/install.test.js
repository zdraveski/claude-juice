// juice installed into a Claude folder, the way Claude Code runs it: the launcher, the plugin store, links.
import { fixture } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, lstatSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { paths } from '../src/paths.js';
import { install, restore } from '../src/setup.js';
import { launcherFor, constant } from '../src/launcher-file.js';

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
  // /juice restore only works once juice is on again, so the message says it in that order.
  assert.equal(off.stdout.trim(), 'juice is turned off. Turn it on in /plugin. Then /juice restore can bring back your old line.');
  assert.ok(off.stdout.trim().length <= 100, 'a status line is cut at the window edge, so the whole message must fit');
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
  // Uninstalled, /juice restore cannot run, so the line says what can be done.
  assert.equal(r.stdout.trim(), 'juice is not installed. Reinstall it and type /juice restore, or delete statusLine in settings.json.');
  assert.ok(r.stdout.trim().length <= 100, 'a status line is cut at the window edge, so the whole message must fit');
});

test('a broken juice folder gives the doctor hint, not a blank line', () => {
  const d = tmp();
  const bin = join(d, 'plugins', 'cache', 'm', 'juice', '1.0.0', 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'juice-statusline.js'), 'import "./missing-file.js";');
  const run = (extra) => spawnSync(process.execPath, [join(ROOT, 'bin', 'launcher.js')], { input: busyText, encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: d, NO_COLOR: '', ...extra } });
  const r = run({});
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '\x1b[2mjuice: /juice doctor\x1b[22m');
  assert.equal(run({ NO_COLOR: '1' }).stdout.trim(), 'juice: /juice doctor');
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

test('the launcher follows updates when the plugins folder is a link, and stays pinned for a checkout', () => {
  // A symlinked or junctioned plugins folder shows the running copy at its real place, with no /plugins/cache/ in it.
  const linked = launcherFor('D:/shared/claude-plugins/cache/my-market/juice/1.3.1');
  assert.equal(constant(linked, 'MARKET'), 'my-market');
  assert.equal(constant(linked, 'PINNED'), null);
  assert.equal(constant(launcherFor('C:\\Users\\a\\.claude\\plugins\\cache\\m2\\juice\\41f619d61b99'), 'MARKET'), 'm2');
  assert.equal(constant(launcherFor('/home/a/.claude/plugins/cache/m3/juice/1.0.0'), 'MARKET'), 'm3');
  // A checkout, even one with juice in its path, is not a plugin version folder.
  for (const checkout of ['/home/a/code/juice', '/home/a/dev/juice/main']) {
    assert.equal(constant(launcherFor(checkout), 'PINNED'), checkout);
    assert.equal(constant(launcherFor(checkout), 'MARKET'), null);
  }
});
