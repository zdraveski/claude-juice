import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';
import { doctor, ago } from '../src/doctor.js';
import { install } from '../src/setup.js';
import { paths, hideHome } from '../src/paths.js';
import { runStatusLine } from '../src/statusline.js';
import { NOW } from './helpers.js';

const config = () => {
  const d = join(mkdtempSync(join(tmpdir(), 'juice-doctor-')), '.claude');
  mkdirSync(d, { recursive: true });
  return d;
};
const io = (dir, out) => ({ out: (l) => out.push(l), err: (l) => out.push(l), env: { CLAUDE_CONFIG_DIR: dir }, now: NOW, platform: 'linux', open() {} });
async function run(dir, argv) {
  const out = [];
  const code = await main(argv, io(dir, out));
  return { code, text: out.join('\n') };
}
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const check = (dir, extra = {}) => doctor(paths({ CLAUDE_CONFIG_DIR: dir }), { env: {}, platform: 'linux', now: NOW, cwd: dir, version, ...extra }).join('\n');

test('doctor: nothing set up says so and how to fix it', async () => {
  const d = config();
  const r = await run(d, ['doctor']);
  assert.equal(r.code, 0);
  assert.match(r.text, /^! No status line is set\. Run \/juice setup\.$/m);
  assert.match(r.text, /need attention/);
});

test('doctor: after setup everything looks fine and names the juice the line runs', async () => {
  const d = config();
  await run(d, ['setup']);
  const r = await run(d, ['doctor']);
  assert.match(r.text, /^✓ juice is your status line, refreshing once a minute$/m);
  assert.match(r.text, new RegExp(`^✓ The status line runs juice ${version.replaceAll('.', '\\.')} from a folder on this computer$`, 'm'));
  assert.match(r.text, /^✓ Drawing works/m);
  assert.match(r.text, /Everything looks fine\.$/);
});

test('doctor: another status line is named but its command (which can hold a key) never printed', async () => {
  const d = config();
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'mytool --key sk-secret-123' } }));
  const text = check(d);
  assert.match(text, /Another status line is set/);
  assert.doesNotMatch(text, /sk-secret|mytool/);
});

test('doctor: a missing launcher, and a juice line pointing elsewhere', async () => {
  const d = config();
  await run(d, ['setup']);
  unlinkSync(join(d, 'juice-statusline.mjs'));
  assert.match(check(d), /launcher file is missing/);
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'node "/elsewhere/.claude/juice-statusline.mjs"', refreshInterval: 60 } }));
  assert.match(check(d), /points at a folder that isn't this one/);
});

test('doctor: installed from the plugin store, it names the store version and spots a mismatch', () => {
  const d = config();
  const root = join(d, 'plugins', 'cache', 'juice', 'juice', '0.2.5');
  for (const f of ['bin', 'src', 'package.json']) cpSync(new URL(`../${f}`, import.meta.url), join(root, f), { recursive: true });
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  install(p, { pluginRoot: root, platform: 'linux', env: {}, cwd: d });
  const text = check(d);
  assert.match(text, /^✓ The status line runs juice 0\.2\.5$/m);
  assert.match(text, new RegExp(`These /juice commands are juice ${version.replaceAll('.', '\\.')} but the status line runs 0\\.2\\.5`));
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8')), enabledPlugins: { 'juice@juice': false } }));
  assert.match(check(d), /turned off in \/plugin/);
});

test('doctor: shows the status line\'s last problem with juice\'s file and line, never a full path', async () => {
  const d = config();
  // A refresh that breaks (here, a clock that throws) must still draw something, and leave the reason for the doctor.
  const broken = { getTime() { throw new Error('clock broke'); } };
  const stdinText = JSON.stringify({ model: { display_name: 'Opus 5.5' }, rate_limits: { five_hour: { used_percentage: 10, resets_at: Math.floor(NOW / 1000) + 3600 } } });
  const text = await runStatusLine({ stdinText, env: { CLAUDE_CONFIG_DIR: d }, now: broken, platform: 'linux', spawnDetached() {} });
  assert.equal(text, 'Opus 5.5');
  const err = JSON.parse(readFileSync(join(d, 'juice-cache', 'last-error.json'), 'utf8'));
  assert.match(err.where, /^[\w.-]+\.js:\d+$/);
  const report = check(d, { now: new Date(err.at + 5 * 60000) });
  assert.match(report, /^! The status line hit a problem 5 min ago: clock broke \([\w.-]+\.js:\d+\)\. Run \/juice setup;/m);
  assert.doesNotMatch(report, new RegExp(d.replaceAll('\\', '\\\\')));
  // A problem from more than a day ago has passed: the doctor no longer flags it.
  assert.doesNotMatch(check(d, { now: new Date(err.at + 25 * 3600000) }), /hit a problem/);
});

test('doctor: a saved error keeps file names but never the folders around them', async () => {
  const d = config();
  // A home folder with a space in its name, as many Windows ones have.
  const home = process.platform === 'win32' ? 'C:\\Users\\Zoë Smith' : '/Users/zoë smith';
  const where = join(home, 'AppData', 'juice', 'src', 'fable.js');
  const thrower = { getTime() { throw new Error(`Cannot find module '${where}' imported from file:///C:/Opt/x/statusline.js`); } };
  const stdinText = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 10, resets_at: Math.floor(NOW / 1000) + 3600 } } });
  await runStatusLine({ stdinText, env: { CLAUDE_CONFIG_DIR: d, HOME: home, USERPROFILE: home }, now: thrower, platform: 'linux', spawnDetached() {} });
  const err = JSON.parse(readFileSync(join(d, 'juice-cache', 'last-error.json'), 'utf8'));
  assert.equal(err.message, "Cannot find module 'fable.js' imported from statusline.js");
});

test('doctor: a project\'s settings file is named from where you are, never by the folders above it', () => {
  // A client's name in a folder path must not end up in a pasted report, inside the home folder or out of it.
  const home = mkdtempSync(join(tmpdir(), 'juice-home-'));
  const d = join(home, '.claude'), proj = join(home, 'acme-secret', 'app'), here = join(proj, 'src');
  mkdirSync(d, { recursive: true });
  mkdirSync(join(proj, '.claude'), { recursive: true });
  mkdirSync(here, { recursive: true });
  writeFileSync(join(proj, '.claude', 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'mine --key sk-1' } }));
  const text = check(d, { cwd: here, env: { HOME: home, USERPROFILE: home } });
  assert.match(text, /^! \.\.\/\.claude\/settings\.json sets its own status line.*take that setting out/m);
  assert.doesNotMatch(text, /acme-secret|sk-1/);
  assert.doesNotMatch(text, new RegExp(home.replaceAll('\\', '\\\\')));
});

test('doctor: never a false ✓ about the launcher, and never crashes on a strange one', async () => {
  const d = config();
  await run(d, ['setup']);
  writeFileSync(join(d, 'juice-statusline.mjs'), 'this is not javascript {{{');
  assert.match(check(d), /launcher file is damaged/);
  writeFileSync(join(d, 'juice-statusline.mjs'), 'const PINNED = "\\x41";');
  assert.match(check(d), /launcher file is damaged/, 'a hand-edited constant that is not valid JSON');
  unlinkSync(join(d, 'juice-statusline.mjs'));
  mkdirSync(join(d, 'juice-statusline.mjs'));
  assert.match(check(d), /launcher file is missing|damaged/, 'a folder where the file should be');
  // A juice line for another folder: only the "points elsewhere" line, no ✓ about this folder's launcher.
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'node "/elsewhere/.claude/juice-statusline.mjs"', refreshInterval: 60 } }));
  const text = check(d);
  assert.match(text, /points at a folder that isn't this one/);
  assert.doesNotMatch(text, /✓ The status line runs/);
});

test('doctor: the real refresh time, and a Node that setup pinned but is gone', async () => {
  const d = config();
  await run(d, ['setup']);
  const s = JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8'));
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, statusLine: { ...s.statusLine, refreshInterval: 600 } }));
  assert.match(check(d), /^✓ juice is your status line, refreshing every 600 seconds$/m);
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, statusLine: { ...s.statusLine, refreshInterval: 'abc' } }));
  assert.match(check(d), /doesn't refresh on its own/);
  // The doctor says run setup, so setup must fix it: a hand-typed "60" or -5 is replaced, never "nothing changed".
  for (const odd of ['60', -5]) {
    writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, statusLine: { ...s.statusLine, refreshInterval: odd } }));
    assert.match((await run(d, ['setup'])).text, /refreshes once a minute/, String(odd));
    assert.match(check(d), /^✓ juice is your status line, refreshing once a minute$/m, String(odd));
  }
  const launcher = s.statusLine.command.replace(/^.*\s(?="[^"]*"\s*$)/, '').trim();
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, statusLine: { ...s.statusLine, command: `PATH="/gone/nvm/v20/bin:$PATH" node ${launcher}` } }));
  assert.match(check(d), /The Node juice was set up with is gone/);
});

test('doctor: a setting juice doesn\'t know says how to fix it, and choosing it again does', async () => {
  const d = config();
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ layout: 'nope', futureKey: { a: 1 } }));
  assert.match(check(d), /^! juice settings: .*Choosing that setting again with \/juice replaces it/m);
  // Another setting changes only itself: a newer juice's value (or a typo) and an unknown key are kept, not reset.
  const other = await run(d, ['set', 'cost=on']);
  assert.match(other.text, /Changed: cost\nWarning: layout: 'nope' isn't valid/);
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'juice.json'), 'utf8')), { layout: 'nope', futureKey: { a: 1 }, cost: 'on' });
  await run(d, ['set', 'layout=bar']);
  assert.doesNotMatch(check(d), /juice settings:/);
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ show: [] }));
  assert.match(check(d), /Type \/juice show all the batteries to bring them back/);
  // An unreadable file is never overwritten by set, so the advice is to fix or delete it.
  writeFileSync(join(d, 'juice.json'), '{bad');
  assert.match(check(d), /^! juice settings: juice\.json is unreadable, using defaults\. Fix or delete juice\.json/m);
  assert.notEqual((await run(d, ['set', 'layout=panel'])).code, 0, 'set refuses, as the advice says');
});

test('doctor: badges are counted, unapproved ones flagged, commands never printed', () => {
  const d = config();
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ badges: [{ command: 'curl https://x.example/?token=abc', sig: 'f'.repeat(64) }] }));
  const text = check(d);
  assert.match(text, /^· 1 badge$/m);
  assert.match(text, /1 badge isn't approved on this computer/);
  assert.doesNotMatch(text, /curl|token=abc/);
});

test('doctor: Fable off, failing, and checked', () => {
  const d = config();
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ fable: 'off' }));
  assert.match(check(d), /Fable battery: turned off\./);
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ fable: 'auto' }));
  assert.match(check(d, { platform: 'darwin' }), /off on a Mac until you type \/juice set fable=on/);
  mkdirSync(join(d, 'juice-cache'), { recursive: true });
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ backoffUntil: NOW.getTime() + 10 * 60000 }));
  assert.match(check(d), /^! Fable battery: the last check failed; juice tries again in 10 min\. If it keeps failing, type \/login/m);
  // Behind a company proxy the advice depends on whether this Node can use it.
  const behindProxy = check(d, { env: { HTTPS_PROXY: 'http://proxy:8080' } });
  const [maj, min] = process.versions.node.split('.').map(Number);
  const nodeCan = maj >= 24 || (maj === 22 && min >= 21);
  assert.match(behindProxy, nodeCan ? /type \/login/ : /company proxy, which juice can only get through with Node 24 or newer, or 22\.21 or newer on Node 22/);
  // Stamped by a clock that was ahead: juice ignores these, and so does the doctor.
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ backoffUntil: NOW.getTime() + 30 * 86400000 }));
  assert.doesNotMatch(check(d), /last check failed/);
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ used: 5, fetchedAt: NOW.getTime() + 3600000 }));
  assert.match(check(d), /^· Fable battery: not checked in the last hour/m);
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ used: 5, fetchedAt: NOW.getTime() - 3 * 60000 }));
  assert.match(check(d), /^· Fable battery: last checked 3 min ago$/m);
});

test('hideHome: the home folder becomes ~ with either slash, and on Windows in any letter case', () => {
  const env = { HOME: 'C:\\Users\\KIRE', USERPROFILE: 'C:\\Users\\KIRE' };
  assert.equal(hideHome('c:/users/kire/proj/.claude/settings.json', env, 'win32'), '~/proj/.claude/settings.json');
  assert.equal(hideHome('C:\\Users\\KIRE\\x and C:/Users/KIRE/y', env, 'win32'), '~\\x and ~/y');
  assert.equal(hideHome('/home/Kire/x', { HOME: '/home/kire' }, 'linux'), '/home/Kire/x', 'Linux paths do care about case');
  assert.equal(hideHome('/home/a.b/x', { HOME: '/home/a.b' }, 'linux'), '~/x', 'a dot in the name is a dot, not "any letter"');
});

test('ago: plain words for how long ago', () => {
  assert.deepEqual([0, 30e3, 5 * 60e3, 3 * 3600e3, 3 * 86400e3, -60e3, NaN].map(ago), ['just now', 'just now', '5 min ago', '3 h ago', '3 days ago', 'just now', 'just now']);
});
