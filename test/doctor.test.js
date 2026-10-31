import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';
import { doctor, ago } from '../src/doctor.js';
import { install } from '../src/setup.js';
import { paths } from '../src/paths.js';
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
  assert.match(report, /^! The status line last hit a problem 5 min ago: clock broke \([\w.-]+\.js:\d+\)$/m);
  assert.doesNotMatch(report, new RegExp(d.replaceAll('\\', '\\\\')));
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
  assert.match(check(d), /Fable limit: turned off\./);
  writeFileSync(join(d, 'juice.json'), JSON.stringify({ fable: 'auto' }));
  assert.match(check(d, { platform: 'darwin' }), /off on macOS unless you turn it on/);
  mkdirSync(join(d, 'juice-cache'), { recursive: true });
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ backoffUntil: NOW.getTime() + 10 * 60000 }));
  assert.match(check(d), /^! Fable limit: the last check failed; juice tries again in 10 min/m);
  writeFileSync(join(d, 'juice-cache', 'fable.json'), JSON.stringify({ used: 5, fetchedAt: NOW.getTime() - 3 * 60000 }));
  assert.match(check(d), /^· Fable limit: last checked 3 min ago$/m);
});

test('ago: plain words for how long ago', () => {
  assert.deepEqual([0, 30e3, 5 * 60e3, 3 * 3600e3, 3 * 86400e3, -60e3, NaN].map(ago), ['just now', 'just now', '5 min ago', '3 h ago', '3 days ago', 'just now', 'just now']);
});
