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

// main() and install() look for project settings above process.cwd(): start in a folder of our own, so the runner's cwd can't change a result.
process.chdir(mkdtempSync(join(tmpdir(), 'juice-cwd-')));

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

test('doctor: suggests the refresh motion wants, never one chosen by hand', async () => {
  const d = config();
  await run(d, ['setup']);
  const s = JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8'));
  const at = (motion, refreshInterval) => {
    writeFileSync(join(d, 'juice.json'), JSON.stringify({ motion }));
    writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, statusLine: { ...s.statusLine, refreshInterval } }));
    return check(d);
  };
  assert.match(at('off', 1), /Run \/juice setup to refresh once a minute/);
  assert.match(at('on', 60), /Run \/juice setup to refresh every second, so the effort level and batteries climb/);
  for (const [m, r] of [['on', 1], ['off', 60], ['on', 600]]) assert.doesNotMatch(at(m, r), /Run \/juice setup to refresh/, `${m} ${r}`);
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
  assert.equal(text, 'Opus 5.5 \x1b[2mjuice: /juice doctor\x1b[22m');
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
  assert.doesNotMatch(check(d), /Run \/juice setup to refresh/, 'a time chosen by hand is left alone');
  writeFileSync(join(d, 'settings.json'), JSON.stringify({ ...s, statusLine: { ...s.statusLine, refreshInterval: 30 } }));
  assert.match(check(d), /^✓ juice is your status line, refreshing every 30 seconds\n· Run \/juice setup to refresh once a minute/m, "1.3.0's 30");
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
  // The advice follows the warning, never a value of the person's own that happens to hold the same word.
  for (const v of ['allowed', 'unreadable']) {
    writeFileSync(join(d, 'juice.json'), JSON.stringify({ layout: v }));
    assert.match(check(d), /^! juice settings: layout: .*Choosing that setting again/m, v);
  }
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

test('doctor: a settings.json with comments is juice that cannot read it, not Claude Code', async () => {
  const d = config();
  writeFileSync(join(d, 'settings.json'), '{\n  // my notes\n  "theme": "dark",\n}');
  const text = check(d);
  assert.match(text, /^! juice can't read your Claude Code settings file/m);
  assert.match(text, /Claude Code may read it fine/);
  assert.doesNotMatch(text, /so Claude Code can't read it/);
});

test('doctor: a launcher stuck on one plugin folder, and a marketplace that was renamed', async () => {
  const d = config();
  await run(d, ['setup']);
  const stuck = 'D:/shared/claude-plugins/cache/m/juice/1.3.1';
  writeFileSync(join(d, 'juice-statusline.mjs'), `const PINNED = "${stuck}";`);
  assert.match(check(d), /^! The status line is stuck on one juice folder .*won't follow updates\. Run \/juice setup\.$/m);
  // A checkout pinned on purpose is fine.
  writeFileSync(join(d, 'juice-statusline.mjs'), 'const PINNED = "/home/a/code/juice";');
  assert.doesNotMatch(check(d), /stuck on one/);
  // The launcher looks in marketplace "old", but juice now lives under "new": setup fixes that, a reinstall does not need to.
  writeFileSync(join(d, 'juice-statusline.mjs'), 'const MARKET = "old";');
  mkdirSync(join(d, 'plugins', 'cache', 'new', 'juice', '1.0.0', 'bin'), { recursive: true });
  writeFileSync(join(d, 'plugins', 'cache', 'new', 'juice', '1.0.0', 'bin', 'juice-statusline.js'), '');
  const text = check(d);
  assert.match(text, /^! The status line looks for juice under "old", but it is installed under "new"\. Run \/juice setup\.$/m);
  assert.doesNotMatch(text, /Install it again/);
});

test('doctor: Fable off, failing, and checked', () => {
  const d = config();
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ fable: 'off' }));
  assert.match(check(d), /Fable battery: turned off\./);
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ fable: 'auto' }));
  assert.match(check(d, { platform: 'darwin' }), /off on a Mac until you type \/juice set fable=on/);
  assert.match(check(d), /^· Fable battery: off until you turn it on with \/juice set fable=on, which lets juice read your Claude login\.$/m);
  mkdirSync(join(d, 'juice-cache'), { recursive: true });
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ backoffUntil: NOW.getTime() + 10 * 60000 }));
  assert.match(check(d), /^! Fable battery: the last check failed; juice tries again in 10 min\. If it keeps failing, type \/login/m);
  // Behind a company proxy the advice depends on whether this Node can use it.
  const proxy = { env: { HTTPS_PROXY: 'http://proxy:8080' } };
  assert.match(check(d, { ...proxy, node: '24.1.0' }), /type \/login/);
  const old = check(d, { ...proxy, node: '22.21.0' });
  assert.match(old, /company proxy, which juice can only get through with Node 24 or newer \(this is 22\.21\.0\)/);
  assert.doesNotMatch(old, /22\.21 or newer/, 'juice needs Node 24 everywhere');
  // Each failure gets the advice that fits it: /login only when Anthropic refused the login.
  const failed = (why) => {
    writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ backoffUntil: NOW.getTime() + 10 * 60000, why }));
    return check(d);
  };
  assert.match(failed('login'), /tries again in 10 min\. If it keeps failing, type \/login/);
  assert.match(failed('expired'), /sign-in was due for renewal/);
  for (const why of ['expired', 'busy', 'changed', 'offline']) assert.doesNotMatch(failed(why), /\/login/, why);
  assert.match(failed('busy'), /Anthropic's server was busy/);
  assert.match(failed('changed'), /github\.com\/zdraveski\/claude-juice\/issues/);
  assert.match(failed('offline'), /couldn't reach Anthropic/);
  // Stamped by a clock that was ahead: juice ignores these, and so does the doctor.
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ backoffUntil: NOW.getTime() + 30 * 86400000 }));
  assert.doesNotMatch(check(d), /last check failed/);
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ used: 5, fetchedAt: NOW.getTime() + 3600000 }));
  assert.match(check(d), /^· Fable battery: not checked in the last hour/m);
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ used: 5, fetchedAt: NOW.getTime() - 3 * 60000 }));
  assert.match(check(d), /^· Fable battery: last checked 3 min ago$/m);
});

test('hideHome leaves a folder that only starts like the home folder alone', () => {
  assert.equal(hideHome('/rootfs/x and /root/y and /root', { HOME: '/root' }, 'linux'), '/rootfs/x and ~/y and ~');
  assert.equal(hideHome('C:\\Users\\Kire2\\y and C:\\Users\\Kire\\z', { USERPROFILE: 'C:\\Users\\Kire' }, 'win32'), 'C:\\Users\\Kire2\\y and ~\\z');
  assert.equal(hideHome('/root.bak/x', { HOME: '/root' }, 'linux'), '/root.bak/x');
});

// Final review (1.4.1): a home at a drive's root hid every path on that drive, and a name that goes on with an
// accent written as a separate mark was cut before the mark.
test('hideHome leaves a drive-root home alone, and a name that goes on with an accent mark', () => {
  assert.equal(hideHome('C:\\Windows\\x and D:\\y', { HOME: 'C:\\', USERPROFILE: 'C:\\' }, 'win32'), 'C:\\Windows\\x and D:\\y');
  const accented = `/home/kire${String.fromCodePoint(0x301)}/x`;
  assert.equal(hideHome(accented, { HOME: '/home/kire' }, 'linux'), accented);
});

// The boundary first hid the home only before a slash or the end, so a quoted one kept the name (review, 1.4.1).
test('hideHome hides the home folder wherever it ends: quoted, before a full stop, or written with a final slash', () => {
  const linux = (t, HOME = '/home/kire') => hideHome(t, { HOME }, 'linux');
  assert.equal(linux("open '/home/kire' failed"), "open '~' failed");
  assert.equal(linux('"/home/kire": no access, and /home/kire, too.'), '"~": no access, and ~, too.');
  assert.equal(linux('your home is /home/kire.'), 'your home is ~.');
  assert.equal(linux('/home/kire/.claude/x', '/home/kire/'), '~/.claude/x');
  assert.equal(hideHome('C:\\Users\\a\\.claude', { USERPROFILE: 'C:\\Users\\a\\' }, 'win32'), '~\\.claude');
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

test('doctor: suggests truecolor=on only when it sees 256 colours and the setting is auto', () => {
  const d = config();
  const hint = /Only if your terminal draws full colour.*truecolor=on.*Undo it with truecolor=off/;
  assert.match(check(d, { env: {} }), hint);
  assert.doesNotMatch(check(d, { env: { COLORTERM: 'truecolor' } }), hint);
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ truecolor: 'off' }));
  assert.doesNotMatch(check(d, { env: {} }), hint, 'the person already chose');
});
