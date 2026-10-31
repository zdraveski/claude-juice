import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';
import { CUSTOMIZER_URL, LOOKS } from '../src/schema.js';

function env(sub = '.claude') {
  const root = mkdtempSync(join(tmpdir(), 'juice-cli-'));
  const dir = join(root, sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}
async function run(dir, argv) {
  const out = [], err = [], opened = [];
  const code = await main(argv, {
    out: (l) => out.push(l), err: (l) => err.push(l), env: { CLAUDE_CONFIG_DIR: dir },
    now: new Date(2026, 9, 28), platform: 'linux', open: (u) => opened.push(u),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), opened };
}
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const OLD = { statusLine: { type: 'command', command: 'node old.js' }, theme: 'dark' };

// Claude Code finds updates by plugin.json's version; the refresher's User-Agent reads package.json's.
test('plugin.json and package.json carry the same version', () => {
  const version = (f) => json(new URL(`../${f}`, import.meta.url)).version;
  assert.equal(version('.claude-plugin/plugin.json'), version('package.json'));
});

test('setup backs up, keeps other keys, and a second setup keeps the backup', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify(OLD));
  const r = await run(d, ['setup']);
  assert.equal(r.code, 0);
  const s = json(join(d, 'settings.json'));
  assert.equal(s.theme, 'dark');
  assert.match(s.statusLine.command, /^node "/);
  assert.match(s.statusLine.command, /juice-statusline\.mjs"$/);
  assert.equal(s.statusLine.padding, 0);
  assert.deepEqual(json(join(d, 'juice-backup.json')).statusLine, OLD.statusLine);
  assert.match(readFileSync(join(d, 'juice-statusline.mjs'), 'utf8'), /const PINNED = ".*";/);
  const again = await run(d, ['setup']);
  assert.equal(again.code, 0);
  assert.deepEqual(json(join(d, 'juice-backup.json')).statusLine, OLD.statusLine);
});

// The countdowns go stale while Claude Code is idle unless it re-runs the status line on a timer.
test('setup asks for a refresh every minute, and adds it to an older juice install', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify(OLD));
  await run(d, ['setup']);
  assert.equal(json(join(d, 'settings.json')).statusLine.refreshInterval, 60);
  const older = json(join(d, 'settings.json'));
  delete older.statusLine.refreshInterval;
  writeFileSync(join(d, 'settings.json'), JSON.stringify(older));
  const r = await run(d, ['setup']);
  assert.equal(r.code, 0);
  assert.equal(json(join(d, 'settings.json')).statusLine.refreshInterval, 60);
  assert.deepEqual(json(join(d, 'juice-backup.json')).statusLine, OLD.statusLine, 'the saved old line is untouched');
  assert.match((await run(d, ['setup'])).out, /already your status line/);
});

test('looks lists all twelve, numbered with their ids, each with a plain-text preview', async () => {
  const d = env();
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ fable: 'off', terminal: 'light' }));
  const r = await run(d, ['looks']);
  assert.equal(r.code, 0);
  for (const [n, l] of LOOKS.entries()) assert.ok(r.out.includes(`${n + 1}. ${l.name} (${l.id})`), l.id);
  assert.ok(!r.out.includes('\x1b'), 'no colour codes, Claude Code shows this as plain text');
  assert.ok(!/[-]/.test(r.out), 'no rounded-end glyphs that show as boxes');
  assert.equal((r.out.match(/resets in/g) || []).length > 5, true, r.out);
  assert.equal(existsSync(join(d, 'juice-cache')), false, 'listing never writes anything');
});

test('restore puts the old status line back; no backup changes nothing', async () => {
  const d = env();
  const none = await run(d, ['restore']);
  assert.equal(none.code, 0);
  assert.match(none.out, /nothing to restore/i);
  assert.equal(existsSync(join(d, 'settings.json')), false);
  writeFileSync(join(d, 'settings.json'), JSON.stringify(OLD));
  await run(d, ['setup']);
  assert.equal((await run(d, ['restore'])).code, 0);
  assert.equal(json(join(d, 'settings.json')).statusLine.command, 'node old.js');
});

test('restore removes statusLine when there was none; setup with no settings.json works', async () => {
  const d = env();
  await run(d, ['setup']);
  assert.equal(json(join(d, 'juice-backup.json')).statusLine, null);
  await run(d, ['restore']);
  assert.equal('statusLine' in json(join(d, 'settings.json')), false);
});

test('restore with no saved copy removes juice instead of leaving people stuck', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ theme: 'dark', statusLine: { type: 'command', command: 'node "/elsewhere/juice-statusline.mjs"' } }));
  const r = await run(d, ['restore']);
  assert.equal(r.code, 0);
  assert.match(r.out, /No earlier status line was saved/);
  assert.deepEqual(json(join(d, 'settings.json')), { theme: 'dark' });
});

test('setup knows its own line under another spelling of the folder, and never saves juice as the old line', { skip: process.platform !== 'win32' && 'folder spelling only varies on Windows' }, async () => {
  const d = env();
  const juiceElsewhere = { type: 'command', command: `node "${d.replaceAll('\\', '/').toUpperCase()}/juice-statusline.mjs"`, refreshInterval: 60 };
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: juiceElsewhere }));
  const r = await run(d, ['setup']);
  assert.equal(r.code, 0, 'no "your status line has changed" question');
  assert.match(r.out, /already your status line/);
  assert.equal(existsSync(join(d, 'juice-backup.json')), false);
  // A backup an older juice wrote with its own line in it is never "restored".
  writeFileSync(join(d, 'juice-backup.json'), JSON.stringify({ statusLine: juiceElsewhere }));
  await run(d, ['restore']);
  assert.equal('statusLine' in json(join(d, 'settings.json')), false);
  assert.equal(existsSync(join(d, 'juice-backup.json')), false);
});

test('a wrapper that merely mentions juice-statusline.mjs is the person\'s own line: backed up, never removed by restore', async () => {
  const d = env();
  const mine = { type: 'command', command: 'bash ~/bin/my-wrapper.sh --then juice-statusline.mjs' };
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: mine }));
  assert.match((await run(d, ['restore'])).out, /isn't your status line/);
  assert.deepEqual(json(join(d, 'settings.json')).statusLine, mine);
  await run(d, ['setup']);
  assert.deepEqual(json(join(d, 'juice-backup.json')).statusLine, mine);
  await run(d, ['restore']);
  assert.deepEqual(json(join(d, 'settings.json')).statusLine, mine);
});

test('a juice line pointing at another machine\'s folder is repaired, keeping its other fields', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'node "/Users/someoneelse/.claude/juice-statusline.mjs"', padding: 1, refreshInterval: 30 } }));
  const r = await run(d, ['setup']);
  assert.match(r.out, /pointed somewhere else/);
  const sl = json(join(d, 'settings.json')).statusLine;
  assert.equal(sl.command, `node "${d.replaceAll('\\', '/')}/juice-statusline.mjs"`);
  assert.deepEqual([sl.padding, sl.refreshInterval], [1, 30]);
});

test('a damaged backup is set aside and the current status line is still saved', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify(OLD));
  writeFileSync(join(d, 'juice-backup.json'), '{"statusLine":{"type":"comm');
  const r = await run(d, ['setup']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /damaged/);
  assert.deepEqual(json(join(d, 'juice-backup.json')).statusLine, OLD.statusLine);
  assert.ok(readdirSync(d).some((f) => /^juice-backup-\d+\.json$/.test(f)), 'the damaged one is kept, not deleted');
  await run(d, ['restore']);
  assert.equal(json(join(d, 'settings.json')).statusLine.command, 'node old.js');
});

test('on macOS and Linux the command names the first node on PATH as PATH names it; restore still knows it', async () => {
  const { install, restore } = await import('../src/setup.js');
  const { paths } = await import('../src/paths.js');
  // A PATH like a Mac's: a folder holding node (Homebrew's /opt/homebrew/bin), written the POSIX way.
  const posix = (dir) => dir.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '');
  const bin = env('bin'), fnm = env('fnm_multishells/9_1/bin');
  writeFileSync(join(bin, 'node'), ''); writeFileSync(join(fnm, 'node'), '');
  const d = env(), p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: '/dev/juice', platform: 'darwin', env: { PATH: `/nowhere:${posix(bin)}` } });
  assert.equal(json(join(d, 'settings.json')).statusLine.command, `"${posix(bin)}/node" "${d.replaceAll('\\', '/')}/juice-statusline.mjs"`);
  const e = env();
  install(paths({ CLAUDE_CONFIG_DIR: e }), { pluginRoot: '/dev/juice', platform: 'linux', env: { PATH: posix(fnm) } });
  assert.match(json(join(e, 'settings.json')).statusLine.command, /^node "/, "fnm's per-shell folder vanishes, so plain node");
  assert.match(restore(p).join(' '), /Removed juice/);
});

test('a juice line run by a Node file with another name ("nodejs") is still juice', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: `"/usr/bin/nodejs" "${d.replaceAll('\\', '/')}/juice-statusline.mjs"` } }));
  assert.match((await run(d, ['restore'])).out, /Removed juice/);
});

test('setup run from a subfolder still finds a project setting above it that hides juice', async () => {
  const { install } = await import('../src/setup.js');
  const { paths } = await import('../src/paths.js');
  const project = env('project'), sub = join(project, 'src', 'deep');
  mkdirSync(join(project, '.claude'), { recursive: true }); mkdirSync(sub, { recursive: true });
  writeFileSync(join(project, '.claude', 'settings.json'), JSON.stringify({ disableAllHooks: true }));
  const out = install(paths({ CLAUDE_CONFIG_DIR: env() }), { pluginRoot: '/dev/juice', cwd: sub }).join('\n');
  assert.match(out, /\.claude\/settings\.json turns hooks off/);
});

test('restore with a damaged saved copy says so, keeps the file, and removes the launcher', async () => {
  const d = env();
  await run(d, ['setup']);
  assert.ok(existsSync(join(d, 'juice-statusline.mjs')));
  writeFileSync(join(d, 'juice-backup.json'), '{"statusLine":{"type":"comm');
  const r = await run(d, ['restore']);
  assert.match(r.out, /damaged, so it couldn't be put back; it is still in .*juice-backup\.json/);
  assert.ok(existsSync(join(d, 'juice-backup.json')), 'never deleted: it can still be read by hand');
  assert.ok(!existsSync(join(d, 'juice-statusline.mjs')), 'nothing runs the launcher now, so it goes');
  assert.equal('statusLine' in json(join(d, 'settings.json')), false);
});

test('a new backup is as private as settings.json', { skip: process.platform === 'win32' && 'Windows has no owner-only file mode' }, async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), JSON.stringify(OLD), { mode: 0o600 });
  await run(d, ['setup']);
  assert.equal(statSync(join(d, 'juice-backup.json')).mode & 0o777, 0o600);
});

test('setup says so when a project setting or disableAllHooks keeps juice from showing', async () => {
  const { install } = await import('../src/setup.js');
  const { paths } = await import('../src/paths.js');
  const d = env(), project = env('project');
  mkdirSync(join(project, '.claude'), { recursive: true });
  writeFileSync(join(project, '.claude', 'settings.local.json'), JSON.stringify({ statusLine: { type: 'command', command: 'echo project' } }));
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ disableAllHooks: true }));
  const out = install(paths({ CLAUDE_CONFIG_DIR: d }), { pluginRoot: '/dev/juice', cwd: project }).join('\n');
  assert.match(out, /disableAllHooks/);
  assert.match(out, /\.claude\/settings\.local\.json sets its own status line/);
  assert.doesNotMatch(install(paths({ CLAUDE_CONFIG_DIR: env() }), { pluginRoot: '/dev/juice', cwd: env() }).join('\n'), /won't show/);
});

test('invalid settings.json aborts and stays byte-identical', async () => {
  const d = env();
  const f = join(d, 'settings.json');
  writeFileSync(f, '{ not json');
  const r = await run(d, ['setup']);
  assert.equal(r.code, 1);
  assert.equal(readFileSync(f, 'utf8'), '{ not json');
  assert.equal(existsSync(join(d, 'juice-backup.json')), false);
  assert.equal(existsSync(join(d, 'juice-statusline.mjs')), false);
});

test('config dir with a space gives a quoted forward-slash command', async () => {
  const d = env('John Smith/.claude');
  await run(d, ['setup']);
  const want = `node "${d.replaceAll('\\', '/')}/juice-statusline.mjs"`;
  assert.equal(json(join(d, 'settings.json')).statusLine.command, want);
});

test('set, get, and bad set', async () => {
  const d = env();
  const r = await run(d, ['set', 'layout=panel']);
  assert.equal(r.code, 0);
  assert.match(r.out, /Changed: layout/);
  assert.equal(json(join(d, 'juice.json')).layout, 'panel');
  assert.match((await run(d, ['get'])).out, /"layout": "panel"/);
  const bad = await run(d, ['set', 'badges=x']);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /Badges can only be added with \/juice badges add/);
});

test('badges add needs --yes, then add/list/remove', async () => {
  const d = env();
  const r = await run(d, ['badges', 'add', 'rtk gain']);
  assert.equal(r.code, 2);
  assert.match(r.out, /rtk gain/);
  assert.match(r.out, /Run again with --yes to add it\./);
  assert.equal(existsSync(join(d, 'juice.json')), false);
  assert.equal((await run(d, ['badges', 'add', 'rtk gain', '--yes'])).code, 0);
  assert.match((await run(d, ['badges', 'list'])).out, /1\. rtk gain/);
  const ask = await run(d, ['badges', 'remove', '1']);
  assert.equal(ask.code, 2);
  assert.match(ask.out, /This would remove badge 1: rtk gain/);
  assert.match((await run(d, ['badges', 'list'])).out, /1\. rtk gain/, 'asking removed nothing');
  assert.equal((await run(d, ['badges', 'remove', '1', '--yes'])).code, 0);
  assert.equal((await run(d, ['badges', 'remove', '1', '--yes'])).code, 1);
});

test('set warns when nothing is left to show, instead of quietly leaving an empty line', async () => {
  const d = env();
  const r = await run(d, ['set', 'show=']);
  assert.match(r.out, /status line will be empty/);
  assert.doesNotMatch((await run(d, ['set', 'show=memory'])).out, /empty/);
});

test('a --yes inside the badge command belongs to the command; only a final --yes adds it', async () => {
  const d = env();
  const ask = await run(d, ['badges', 'add', 'npx', '--yes', 'ccusage']);
  assert.equal(ask.code, 2, 'not the go-ahead');
  assert.match(ask.out, /This badge would run: npx --yes ccusage/);
  assert.equal((await run(d, ['badges', 'add', 'npx', '--yes', 'ccusage', '--yes'])).code, 0);
  assert.equal((await run(d, ['badges', 'list'])).out, '1. npx --yes ccusage');
});

test('badges list says which badges this computer never approved, so they never run', async () => {
  const d = env();
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ badges: [{ command: 'echo copied' }] }));
  await run(d, ['badges', 'add', 'echo mine', '--yes']);
  const out = (await run(d, ['badges', 'list'])).out;
  assert.match(out, /1\. echo copied \(not approved on this computer/);
  assert.match(out, /2\. echo mine$/m);
});

test('get and badges list warn when juice.json cannot be read, instead of passing for the defaults', async () => {
  const d = env();
  writeFileSync(join(d, 'juice.json'), '{ broken');
  assert.match((await run(d, ['get'])).out, /Warning: juice\.json is unreadable/);
  assert.match((await run(d, ['badges', 'list'])).out, /Warning: juice\.json is unreadable/);
});

test('the /juice flow for removing one of two badges removes only that one', async () => {
  const d = env();
  await run(d, ['badges', 'add', 'echo A', '--yes']);
  await run(d, ['badges', 'add', 'echo B', '--yes']);
  await run(d, ['badges', 'remove', '1']); // first run: shows what it would do
  await run(d, ['badges', 'remove', '1', '--yes']); // re-run after the user agrees
  assert.equal((await run(d, ['badges', 'list'])).out, '1. echo B');
});

test('an unreadable juice.json is never overwritten with defaults', async () => {
  const d = env();
  const f = join(d, 'juice.json');
  writeFileSync(f, '{ "layout": "panel", oops');
  const r = await run(d, ['set', 'cost=on']);
  assert.equal(r.code, 1);
  assert.match(r.err, /can't be read, so juice changed nothing/);
  assert.equal(readFileSync(f, 'utf8'), '{ "layout": "panel", oops');
  assert.equal((await run(d, ['badges', 'add', 'x', '--yes'])).code, 1);
  writeFileSync(f, '﻿' + JSON.stringify({ layout: 'panel', badges: [{ command: 'x' }] }));
  assert.equal((await run(d, ['set', 'cost=on'])).code, 0, 'a BOM is fine');
  assert.deepEqual([json(f).layout, json(f).badges.length, json(f).cost], ['panel', 1, 'on']);
});

test('customize prints and opens the link', async () => {
  const d = env();
  const r = await run(d, ['customize']);
  assert.ok(r.out.startsWith(CUSTOMIZER_URL));
  assert.match(r.out, /#c=/);
  assert.equal(r.opened.length, 1);
  assert.ok(r.opened[0].startsWith(CUSTOMIZER_URL));
});

test('refresh-badges rejects a bad key, refresh-fable does nothing when off, unknown command exits 1', async () => {
  const d = env();
  assert.equal((await run(d, ['refresh-badges', '../x'])).code, 1);
  assert.equal(existsSync(join(d, 'juice-cache')), false);
  await run(d, ['set', 'fable=off']);
  assert.equal((await run(d, ['refresh-fable'])).code, 0);
  assert.equal(existsSync(join(d, 'juice-cache')), false);
  assert.equal((await run(d, ['nope'])).code, 1);
  assert.equal((await run(d, [])).code, 1);
});

const statusOf = (d) => json(join(d, 'settings.json')).statusLine;
const put = (d, statusLine) => writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine }));

test('setup -> restore -> switch -> setup backs up the new one; restore deletes the backup', async () => {
  const d = env();
  put(d, { type: 'command', command: 'node X.js' });
  await run(d, ['setup']);
  await run(d, ['restore']);
  assert.equal(existsSync(join(d, 'juice-backup.json')), false);
  put(d, { type: 'command', command: 'node Y.js' });
  assert.equal((await run(d, ['setup'])).code, 0);
  await run(d, ['restore']);
  assert.equal(statusOf(d).command, 'node Y.js');
});

test('setup after a manual change asks for --yes and keeps the old backup under a new name', async () => {
  const d = env();
  put(d, { type: 'command', command: 'node X.js' });
  await run(d, ['setup']);
  put(d, { type: 'command', command: 'node Y.js' });
  const before = readFileSync(join(d, 'settings.json'), 'utf8');
  const r = await run(d, ['setup']);
  assert.equal(r.code, 2);
  assert.match(r.out, /--yes/);
  assert.equal(readFileSync(join(d, 'settings.json'), 'utf8'), before);
  assert.equal((await run(d, ['setup', '--yes'])).code, 0);
  assert.ok(readdirSync(d).some((f) => /^juice-backup-\d+\.json$/.test(f)));
  await run(d, ['restore']);
  assert.equal(statusOf(d).command, 'node Y.js');
});

test('restore leaves someone else\'s status line alone', async () => {
  const d = env();
  put(d, { type: 'command', command: 'node X.js' });
  await run(d, ['setup']);
  put(d, { type: 'command', command: 'node Y.js' });
  const r = await run(d, ['restore']);
  assert.equal(r.code, 0);
  assert.match(r.out, /isn't your status line/);
  assert.equal(statusOf(d).command, 'node Y.js');
  assert.equal(existsSync(join(d, 'juice-backup.json')), true);
});

test('a plugin path with $ replacement patterns still gives a valid launcher', async () => {
  const { install } = await import('../src/setup.js');
  const { paths } = await import('../src/paths.js');
  const { spawnSync } = await import('node:child_process');
  const d = env();
  install(paths({ CLAUDE_CONFIG_DIR: d }), { pluginRoot: "C:/dev/it$'s/$&/juice" });
  const f = join(d, 'juice-statusline.mjs');
  assert.equal(spawnSync(process.execPath, ['--check', f]).status, 0);
  assert.ok(readFileSync(f, 'utf8').includes(`"C:/dev/it$'s/$&/juice"`));
});

test('setup from the plugin cache writes its marketplace into the launcher', async () => {
  const { install } = await import('../src/setup.js');
  const { paths } = await import('../src/paths.js');
  const d = env();
  install(paths({ CLAUDE_CONFIG_DIR: d }), { pluginRoot: `${d.replaceAll('\\', '/')}/plugins/cache/juice-mk/juice/0.2.0` });
  const text = readFileSync(join(d, 'juice-statusline.mjs'), 'utf8');
  assert.ok(text.includes('const MARKET = "juice-mk";'));
  assert.ok(text.includes('const PINNED = null;'));
});

test('a BOM in settings.json is accepted and not written back', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), '\uFEFF' + JSON.stringify(OLD));
  assert.equal((await run(d, ['setup'])).code, 0);
  const raw = readFileSync(join(d, 'settings.json'), 'utf8');
  assert.notEqual(raw.charCodeAt(0), 0xFEFF);
  assert.equal(JSON.parse(raw).theme, 'dark');
});
