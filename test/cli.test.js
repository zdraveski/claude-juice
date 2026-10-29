import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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
  assert.equal((await run(d, ['badges', 'remove', '1'])).code, 0);
  assert.equal((await run(d, ['badges', 'remove', '1'])).code, 1);
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
  install(paths({ CLAUDE_CONFIG_DIR: d }), { pluginRoot: "C:/dev/it$'s/$&/juice", inPluginCache: false });
  const f = join(d, 'juice-statusline.mjs');
  assert.equal(spawnSync(process.execPath, ['--check', f]).status, 0);
  assert.ok(readFileSync(f, 'utf8').includes(`"C:/dev/it$'s/$&/juice"`));
});

test('a BOM in settings.json is accepted and not written back', async () => {
  const d = env();
  writeFileSync(join(d, 'settings.json'), '\uFEFF' + JSON.stringify(OLD));
  assert.equal((await run(d, ['setup'])).code, 0);
  const raw = readFileSync(join(d, 'settings.json'), 'utf8');
  assert.notEqual(raw.charCodeAt(0), 0xFEFF);
  assert.equal(JSON.parse(raw).theme, 'dark');
});
