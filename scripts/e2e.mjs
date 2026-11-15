// End-to-end check, run in CI on all three systems (node scripts/e2e.mjs): installs juice the way Claude Code lays it out, into a fake
// home whose name has a space, an apostrophe, an accent and an ampersand, with CLAUDE_CONFIG_DIR unset, then runs
// the exact settings.json command through bash (the shell Claude Code uses, Git Bash on Windows) and, on macOS and
// Linux, through sh with a bare PATH (Claude Code started from a desktop app). Also runs /juice doctor, and on macOS
// and Linux checks the line survives uninstalling the Node it was set up with. Never touches the real ~/.claude.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, readdirSync, copyFileSync, statSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
// The temp folder by its full name, as a real home folder always is (C:\Users\Zoë, not RUNNER~1).
const home = join(mkdtempSync(join(realpathSync.native(tmpdir()), 'juice-e2e-')), "Zoë O'Brien & Co (1)");
const config = join(home, '.claude');
const market = join(config, 'plugins', 'cache', 'juice', 'juice');
const plugin = join(market, version);
// Copied file by file: Node 22's fs.cpSync on Windows mangled this folder name, so the copy landed elsewhere
// (juice itself never copies files, so users can't hit that).
const copy = (from, to) => {
  if (statSync(from).isDirectory()) { mkdirSync(to, { recursive: true }); for (const f of readdirSync(from)) copy(join(from, f), join(to, f)); }
  else copyFileSync(from, to);
};
mkdirSync(plugin, { recursive: true });
for (const f of ['bin', 'src', 'package.json', '.claude-plugin']) copy(join(repo, f), join(plugin, f));
assert.ok(existsSync(join(plugin, 'bin', 'juice.js')), `the copied plugin is missing at ${plugin}`);
// A newer copy Claude Code marked as replaced must never run.
mkdirSync(join(market, '99.0.0', 'bin'), { recursive: true });
writeFileSync(join(market, '99.0.0', 'bin', 'juice-statusline.js'), 'console.log("ORPHAN")');
writeFileSync(join(market, '99.0.0', '.orphaned_at'), '1');
writeFileSync(join(config, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'echo old' } }));

const env = { ...process.env, HOME: home, USERPROFILE: home };
delete env.CLAUDE_CONFIG_DIR;
// A step that fails prints what juice said, so a CI failure explains itself.
const juice = (...args) => {
  const r = spawnSync(process.execPath, [join(plugin, 'bin', 'juice.js'), ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) console.error(`juice ${args[0]} exited ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}${r.error ? `\nerror: ${r.error.message}` : ''}`);
  return r;
};

assert.equal(juice('setup').status, 0, 'setup');
const command = JSON.parse(readFileSync(join(config, 'settings.json'), 'utf8')).statusLine.command;
const now = Math.floor(Date.now() / 1000);
const stdin = readFileSync(join(repo, 'test', 'fixtures', 'busy.json'), 'utf8').replace(/"now\+(-?\d+)"/g, (_, n) => String(now + Number(n)));
const check = (label, file, args, e) => {
  const r = spawnSync(file, args, { env: e, input: stdin, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, `${label}: exit ${r.status} ${r.stderr}`);
  assert.match(r.stdout, /Session/, `${label}: ${r.stdout}`);
  assert.equal(r.stderr, '', label);
  console.log(`ok ${label}`);
};
check('bash -c, as Claude Code runs it', 'bash', ['-c', command], env);
if (process.platform !== 'win32') check('sh -c with a bare PATH', '/bin/sh', ['-c', command], { HOME: home, PATH: '/usr/bin:/bin' });

// /juice doctor sees the install as it is: juice is the line, from the plugin store, and drawing works.
const doctor = juice('doctor');
assert.equal(doctor.status, 0, 'doctor');
assert.match(doctor.stdout, /^✓ juice is your status line, refreshing once a minute$/m, doctor.stdout);
assert.match(doctor.stdout, new RegExp(`^✓ The status line runs juice ${version.replaceAll('.', '\\.')}$`, 'm'), doctor.stdout);
assert.match(doctor.stdout, /^✓ Drawing works/m, doctor.stdout);
if (process.platform === 'darwin') assert.match(doctor.stdout, /Fable battery: off on a Mac until you type/, doctor.stdout);
console.log('ok doctor');

// A hung badge is killed with its child after 2 s, and the refresher itself exits.
const pidFile = join(home, 'grandchild.pid');
writeFileSync(join(home, 'grand.cjs'), `require('fs').writeFileSync(process.argv[2], String(process.pid)); setTimeout(() => {}, 30000);`);
writeFileSync(join(home, 'mid.cjs'), `require('child_process').spawnSync(process.execPath, [__dirname + '/grand.cjs', process.argv[2]], { stdio: 'inherit' });`);
assert.equal(juice('badges', 'add', `node "${join(home, 'mid.cjs')}" "${pidFile}"`, '--yes').status, 0, 'badges add');
mkdirSync(join(config, 'juice-cache', 'badges'), { recursive: true });
writeFileSync(join(config, 'juice-cache', 'badges', '0123456789abcdef.stdin.json'), stdin);
const t0 = Date.now();
assert.equal(juice('refresh-badges', '0123456789abcdef').status, 0, 'refresh-badges');
assert.ok(Date.now() - t0 < 8000, `refresher took ${Date.now() - t0} ms`);
await new Promise((r) => setTimeout(r, 1000));
assert.ok(existsSync(pidFile), 'the badge command ran');
const pid = Number(readFileSync(pidFile, 'utf8'));
let alive = true; try { process.kill(pid, 0); } catch { alive = false; }
if (alive) process.kill(pid);
assert.equal(alive, false, 'the badge command\'s child is still running after the timeout');
console.log('ok hung badge killed with its child');

assert.equal(juice('restore').status, 0, 'restore');
assert.equal(JSON.parse(readFileSync(join(config, 'settings.json'), 'utf8')).statusLine.command, 'echo old');
console.log('ok restore');

// A Node upgrade (nvm install 24, nvm uninstall the old one): setup pinned the old Node's folder in front of PATH,
// and once that folder is gone the line must still find Node on the rest of PATH.
if (process.platform !== 'win32') {
  const old = join(home, 'old-node', 'bin');
  mkdirSync(old, { recursive: true });
  symlinkSync(process.execPath, join(old, 'node'));
  const r = spawnSync(process.execPath, [join(plugin, 'bin', 'juice.js'), 'setup'], { env: { ...env, PATH: `${old}:${process.env.PATH}` }, encoding: 'utf8' });
  assert.equal(r.status, 0, `setup with the old Node: ${r.stderr}`);
  const pinned = JSON.parse(readFileSync(join(config, 'settings.json'), 'utf8')).statusLine.command;
  assert.ok(pinned.startsWith(`PATH="${old}:$PATH" node `), pinned);
  rmSync(join(home, 'old-node'), { recursive: true });
  check('after the Node it was set up with is uninstalled', '/bin/sh', ['-c', pinned], { HOME: home, PATH: `${dirname(process.execPath)}:/usr/bin:/bin` });
}
