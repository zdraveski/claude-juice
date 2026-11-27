// End-to-end check, run in CI on all three systems (node scripts/e2e.mjs): installs juice the way Claude Code lays it out, into a fake
// home whose name has a space, an apostrophe, an accent and an ampersand, with CLAUDE_CONFIG_DIR unset, then runs
// the exact settings.json command through bash (the shell Claude Code uses, Git Bash on Windows) and, on macOS and
// Linux, through sh with a bare PATH (Claude Code started from a desktop app). Also runs /juice doctor, and on macOS
// and Linux checks the line survives uninstalling the Node it was set up with. Then walks what a new user meets, each
// in a home of its own: a first setup with no status line, every command, a project that sets its own line, a broken
// install, and an update from an older juice. Never touches the real ~/.claude, and never draws the line while the
// Fable battery is on (that would read the login).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, readdirSync, copyFileSync, statSync, symlinkSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, parse } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(repo, 'plugin', 'package.json'), 'utf8'));
const V = version.replaceAll('.', '\\.');
// Copied file by file: Node 22's fs.cpSync on Windows mangled this folder name, so the copy landed elsewhere
// (juice itself never copies files, so users can't hit that).
const copy = (from, to) => {
  if (statSync(from).isDirectory()) { mkdirSync(to, { recursive: true }); for (const f of readdirSync(from)) copy(join(from, f), join(to, f)); }
  else copyFileSync(from, to);
};
const plugin = (to) => { for (const f of ['bin', 'src', 'package.json', '.claude-plugin']) copy(join(repo, 'plugin', f), join(to, f)); };
// A fresh home with juice in Claude Code's plugin store, as <version>. The temp folder by its full name, as a real
// home folder always is (C:\Users\Zoë, not RUNNER~1).
// Every temp folder goes when the run ends, passed or failed.
const temps = [];
const temp = () => { const t = mkdtempSync(join(realpathSync.native(tmpdir()), 'juice-e2e-')); temps.push(t); return t; };
process.on('exit', () => { for (const t of temps) rmSync(t, { recursive: true, force: true }); });
const install = (name, v = version) => {
  const home = join(temp(), name);
  const config = join(home, '.claude'), market = join(config, 'plugins', 'cache', 'juice', 'juice');
  const x = { home, config, market, plugin: join(market, v), settings: join(config, 'settings.json'), launcher: join(config, 'juice-statusline.mjs'), env: { ...process.env, HOME: home, USERPROFILE: home } };
  delete x.env.CLAUDE_CONFIG_DIR;
  plugin(x.plugin);
  assert.ok(existsSync(join(x.plugin, 'bin', 'juice.js')), `the copied plugin is missing at ${x.plugin}`);
  return x;
};
// A juice command, run from the top of the drive by default: the project-settings scan walks up from the working folder,
// and on Windows the temp folder sits inside the real home. One that exits other than `code` fails with what juice said.
const juiceIn = (x, args, { code = 0, cwd = parse(x.home).root } = {}) => {
  const r = spawnSync(process.execPath, [join(x.plugin, 'bin', 'juice.js'), ...args], { env: x.env, cwd, encoding: 'utf8' });
  assert.equal(r.status, code, `juice ${args.join(' ')} exited ${r.status}, not ${code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}${r.error ? `\nerror: ${r.error.message}` : ''}`);
  return r;
};
const lines = (r) => r.stdout.trimEnd().split(/\r?\n/);
const S = (x) => JSON.parse(readFileSync(x.settings, 'utf8'));

const now = Math.floor(Date.now() / 1000);
const stdin = readFileSync(join(repo, 'test', 'fixtures', 'busy.json'), 'utf8').replace(/"now\+(-?\d+)"/g, (_, n) => String(now + Number(n)));
// The line as Claude Code runs it: settings.json's command through bash.
const draw = (x, input = stdin) => {
  const r = spawnSync('bash', ['-c', S(x).statusLine.command], { env: x.env, input, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, `the line exited ${r.status}: ${r.stderr}`);
  assert.equal(r.stderr, '', `the line wrote to stderr: ${r.stderr}`);
  return r.stdout.replace(/\x1b\[[0-9;]*m/g, ''); // colour codes sit between the digits of a percentage
};
const lineOk = (x, label, want = [/Session/, /Weekly/]) => {
  const out = draw(x);
  for (const w of want) assert.match(out, w, `${label}: ${out}`);
  assert.doesNotMatch(out, /juice:/, `${label}: ${out}`);
  return out;
};

const main = install("Zoë O'Brien & Co (1)");
const { home, config, market, env } = main;
const juice = (...args) => juiceIn(main, args);
// A newer copy Claude Code marked as replaced must never run.
mkdirSync(join(market, '99.0.0', 'bin'), { recursive: true });
writeFileSync(join(market, '99.0.0', 'bin', 'juice-statusline.js'), 'console.log("ORPHAN")');
writeFileSync(join(market, '99.0.0', '.orphaned_at'), '1');
writeFileSync(main.settings, JSON.stringify({ statusLine: { type: 'command', command: 'echo old' } }));

const setup = juice('setup').stdout;
assert.match(setup, /^Saved your current status line so you can get it back\.$/m, setup);
assert.match(setup, /^juice is now your status line\./m, setup);
assert.equal(JSON.parse(readFileSync(join(config, 'juice-backup.json'), 'utf8')).statusLine.command, 'echo old');
const command = S(main).statusLine.command;
const check = (label, file, args, e) => {
  const r = spawnSync(file, args, { env: e, input: stdin, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, `${label}: exit ${r.status} ${r.stderr}`);
  for (const w of [/Opus 5\.5/, /Memory/, /Session/, /Weekly/]) assert.match(r.stdout, w, `${label}: ${r.stdout}`);
  assert.doesNotMatch(r.stdout, /juice:/, `${label}: ${r.stdout}`);
  assert.equal(r.stderr, '', label);
  console.log(`ok ${label}`);
};
check('bash -c, as Claude Code runs it', 'bash', ['-c', command], env);
if (process.platform !== 'win32') check('sh -c with a bare PATH', '/bin/sh', ['-c', command], { HOME: home, PATH: '/usr/bin:/bin' });

// /juice doctor sees the install as it is: juice is the line, from the plugin store, and drawing works. People paste
// it into bug reports, so it names no folder or command of theirs.
const doctor = juice('doctor').stdout;
assert.match(doctor, /^✓ juice is your status line, refreshing once a minute$/m, doctor);
assert.match(doctor, new RegExp(`^✓ The status line runs juice ${V}$`, 'm'), doctor);
assert.match(doctor, /^✓ Drawing works/m, doctor);
assert.match(doctor, process.platform === 'darwin' ? /^· Fable battery: off on a Mac until you type/m : /^· Fable battery: off until you turn it on with \/juice set fable=on/m, doctor);
assert.match(doctor, /^Everything looks fine\.$/m, doctor);
assert.doesNotMatch(doctor, /Zoë|O'Brien|echo old|juice-e2e-/, doctor);
console.log('ok doctor');

// A hung badge is killed with its child after 2 s, and the refresher itself exits.
const pidFile = join(home, 'grandchild.pid');
writeFileSync(join(home, 'grand.cjs'), `require('fs').writeFileSync(process.argv[2], String(process.pid)); setTimeout(() => {}, 30000);`);
writeFileSync(join(home, 'mid.cjs'), `require('child_process').spawnSync(process.execPath, [__dirname + '/grand.cjs', process.argv[2]], { stdio: 'inherit' });`);
assert.match(juice('badges', 'add', `node "${join(home, 'mid.cjs')}" "${pidFile}"`, '--yes').stdout, /^Added badge: node /m);
mkdirSync(join(config, 'juice-cache', 'badges'), { recursive: true });
writeFileSync(join(config, 'juice-cache', 'badges', '0123456789abcdef.stdin.json'), stdin);
const t0 = Date.now();
juice('refresh-badges', '0123456789abcdef');
assert.ok(Date.now() - t0 < 8000, `refresher took ${Date.now() - t0} ms`);
await new Promise((r) => setTimeout(r, 1000));
assert.ok(existsSync(pidFile), 'the badge command ran');
const pid = Number(readFileSync(pidFile, 'utf8'));
let alive = true; try { process.kill(pid, 0); } catch { alive = false; }
if (alive) process.kill(pid);
assert.equal(alive, false, 'the badge command\'s child is still running after the timeout');
console.log('ok hung badge killed with its child');

// The installed line itself starts the real detached refresher: with one badge, the badge cache file appears within
// a few seconds, and the line comes back at once instead of waiting for the refresher.
assert.match(juice('badges', 'remove', '1', '--yes').stdout, /^Removed badge: node /m);
juice('badges', 'add', `node -e "process.stdout.write('E2EBADGE')"`, '--yes');
const badgeDir = join(config, 'juice-cache', 'badges');
const tLine = Date.now();
check('the line with a badge, as Claude Code runs it', 'bash', ['-c', command], env);
assert.ok(Date.now() - tLine < 15000, `the line took ${Date.now() - tLine} ms: is the refresher holding the pipe?`);
const written = () => (existsSync(badgeDir) ? readdirSync(badgeDir) : []).filter((f) => f.endsWith('.json') && !f.endsWith('.stdin.json') && !f.startsWith('0123456789abcdef'));
for (let i = 0; i < 100 && !written().length; i++) await new Promise((r) => setTimeout(r, 100));
assert.ok(written().length, 'the status line never started the badge refresher: no badge cache file appeared');
assert.match(readFileSync(join(badgeDir, written()[0]), 'utf8'), /E2EBADGE/);
assert.doesNotMatch(juice('doctor').stdout, /E2EBADGE|mid\.cjs/, 'doctor shows a badge command');
console.log('ok the line starts the detached badge refresher');

// Badges get a trimmed environment: a real git badge still works on every system, a secret in the terminal stays
// out, and --env lets that one variable in.
{
  const work = join(home, 'work');
  mkdirSync(work);
  const g = spawnSync('git', ['init', '-q', '-b', 'e2e-branch'], { cwd: work, encoding: 'utf8' });
  assert.equal(g.status, 0, `git init: ${g.stderr}`);
  const shown = (tag) => `node -e "process.stdout.write('${tag}'+process.env.E2E_SECRET)"`;
  const cmds = ['git branch --show-current', shown('hidden:'), shown('let-in:')];
  juice('badges', 'add', cmds[0], '--yes');
  juice('badges', 'add', cmds[1], '--yes');
  juice('badges', 'add', cmds[2], '--env', 'E2E_SECRET', '--yes');
  const key = 'fedcba9876543210';
  writeFileSync(join(badgeDir, `${key}.stdin.json`), JSON.stringify({ ...JSON.parse(stdin), workspace: { current_dir: work } }));
  juiceIn({ ...main, env: { ...env, E2E_SECRET: 's3cret' } }, ['refresh-badges', key]);
  const c = JSON.parse(readFileSync(join(badgeDir, `${key}.json`), 'utf8'));
  const text = (cmd) => c.texts[c.commands.indexOf(cmd)];
  assert.equal(text(cmds[0]), 'e2e-branch', 'a git badge under the trimmed environment');
  assert.equal(text(cmds[1]), 'hidden:undefined', 'a badge saw a variable it was not given');
  assert.equal(text(cmds[2]), 'let-in:s3cret', '--env did not let the variable in');
  console.log('ok badges: git works, secrets stay out, --env lets one in');
}

assert.match(juice('restore').stdout, /^Your old status line is back\.$/m);
assert.equal(S(main).statusLine.command, 'echo old');
for (const f of ['juice-backup.json', 'juice-statusline.mjs']) assert.ok(!existsSync(join(config, f)), `restore left ${f}`);
console.log('ok restore');

// A Node upgrade (nvm install 24, nvm uninstall the old one): setup pinned the old Node's folder in front of PATH,
// and once that folder is gone the line must still find Node on the rest of PATH.
if (process.platform !== 'win32') {
  const old = join(home, 'old-node', 'bin');
  mkdirSync(old, { recursive: true });
  symlinkSync(process.execPath, join(old, 'node'));
  const r = spawnSync(process.execPath, [join(main.plugin, 'bin', 'juice.js'), 'setup'], { env: { ...env, PATH: `${old}:${process.env.PATH}` }, cwd: parse(home).root, encoding: 'utf8' });
  assert.equal(r.status, 0, `setup with the old Node: ${r.stderr}`);
  const pinned = S(main).statusLine.command;
  assert.ok(pinned.startsWith(`PATH="${old}:$PATH" node `), pinned);
  rmSync(join(home, 'old-node'), { recursive: true });
  check('after the Node it was set up with is uninstalled', '/bin/sh', ['-c', pinned], { HOME: home, PATH: `${dirname(process.execPath)}:/usr/bin:/bin` });
}

// People who set CLAUDE_CONFIG_DIR (the documented way to move the folder) get a different command: run that too, with a
// folder name that has a space, an accent and an apostrophe, through bash.
{
  const odd = join(temp(), "Ünïcode d'ir (2)");
  const plugin2 = join(odd, 'plugins', 'cache', 'juice', 'juice', version);
  plugin(plugin2);
  const env2 = { ...env, CLAUDE_CONFIG_DIR: odd };
  const setup2 = spawnSync(process.execPath, [join(plugin2, 'bin', 'juice.js'), 'setup'], { env: env2, cwd: parse(odd).root, encoding: 'utf8' });
  assert.equal(setup2.status, 0, `setup with CLAUDE_CONFIG_DIR: ${setup2.stdout}${setup2.stderr}`);
  const command2 = JSON.parse(readFileSync(join(odd, 'settings.json'), 'utf8')).statusLine.command;
  assert.ok(command2.includes(odd.replaceAll('\\', '/')), command2);
  check('CLAUDE_CONFIG_DIR with a space, an accent and an apostrophe, through bash', 'bash', ['-c', command2], env2);
  const doctor2 = spawnSync(process.execPath, [join(plugin2, 'bin', 'juice.js'), 'doctor'], { env: env2, cwd: parse(odd).root, encoding: 'utf8' }).stdout;
  assert.match(doctor2, /^✓ juice is your status line, refreshing once a minute$/m, doctor2);
  assert.match(doctor2, new RegExp(`^✓ The status line runs juice ${V}$`, 'm'), doctor2);
  assert.match(doctor2, /^✓ Drawing works/m, doctor2);
}

// A first setup with no status line before, the first draw (before Claude's first reply), restore, and setup again.
const first = install('first');
{
  const x = first;
  assert.deepEqual(lines(juiceIn(x, ['setup'])), ['You had no status line, so there is nothing to save.',
    "juice is now your status line. It shows up the next time Claude Code redraws it, and the batteries fill in after Claude's first reply.",
    'To undo this, run /juice restore.']);
  const { command: _, ...rest } = S(x).statusLine;
  assert.deepEqual(rest, { type: 'command', padding: 0, refreshInterval: 60 });
  assert.equal(JSON.parse(readFileSync(join(x.config, 'juice-backup.json'), 'utf8')).statusLine, null);
  const before = draw(x, JSON.stringify({ model: { display_name: 'Opus' } }));
  assert.match(before, /Opus.*batteries appear after Claude's first reply/, before);
  assert.doesNotMatch(before, /Session/, before);
  assert.equal(draw(x, '').trim(), '', 'a draw with no input');
  assert.deepEqual(lines(juiceIn(x, ['restore'])), ['Removed juice. You had no status line before, so none is set now.', 'To use juice again, run /juice setup.']);
  assert.deepEqual(S(x), {});
  for (const f of ['juice-backup.json', 'juice-statusline.mjs']) assert.ok(!existsSync(join(x.config, f)), `restore left ${f}`);
  juiceIn(x, ['setup']);
  assert.deepEqual(lines(juiceIn(x, ['setup'])), ['juice is already your status line. Nothing changed.', 'To undo this, run /juice restore.']);
  // Changed by hand since juice saved the old line: setup asks first, and --yes keeps both saved copies.
  writeFileSync(x.settings, JSON.stringify({ ...S(x), statusLine: { ...S(x).statusLine, command: 'echo mine' } }));
  const mine = readFileSync(x.settings, 'utf8');
  assert.match(juiceIn(x, ['setup'], { code: 2 }).stdout, /^Your status line has changed since juice saved a copy of the old one, so juice changed nothing\. Run setup again with --yes/m);
  assert.equal(readFileSync(x.settings, 'utf8'), mine, 'setup changed settings.json without --yes');
  const yes = juiceIn(x, ['setup', '--yes']).stdout;
  const kept = /^Kept the earlier saved copy as (juice-backup-\d+\.json) in your Claude folder\.$/m.exec(yes);
  assert.ok(kept && existsSync(join(x.config, kept[1])), yes);
  assert.match(yes, /^Saved your current status line so you can get it back\.$/m, yes);
  assert.equal(JSON.parse(readFileSync(join(x.config, 'juice-backup.json'), 'utf8')).statusLine.command, 'echo mine');
  lineOk(x, 'after setup --yes');
  console.log('ok a first setup, the first draw, restore, and setup again');
}

// Every command a person types, each followed by the line as Claude Code draws it.
{
  const x = first;
  const looks = juiceIn(x, ['looks']).stdout;
  const ids = [...looks.matchAll(/^(\d+)\. .+ \((\w+)\): /gm)];
  assert.ok(ids.length >= 15 && ids.every((m, i) => m[1] === String(i + 1)), looks);
  assert.doesNotMatch(looks, /\x1b/, 'looks printed colour codes');
  const before = readFileSync(x.settings, 'utf8');
  for (const [, , id] of ids) {
    assert.doesNotMatch(juiceIn(x, ['set', `look=${id}`]).stdout, /Warning/, id);
    lineOk(x, `look ${id}`, [/Session/, /\d+%/]); // Just the basics shows two batteries
  }
  juiceIn(x, ['set', 'look=juice']); // Sand (the last look) set its own battery; any other look undoes it
  juiceIn(x, ['set', 'layout=fuse']); // the one layout with its own narrow-window steps
  lineOk(x, 'layout=fuse', [/session/i, /\d+%/]);
  for (const kv of ['layout=panel', 'colors=ocean', 'ends=plain', 'battery=outline', 'terminal=light', 'refills=warnings', 'cost=off', 'show=model,session,week', 'order=urgent']) {
    const said = lines(juiceIn(x, ['set', kv]));
    assert.equal(said[0], `Changed: ${kv.split('=')[0]}`, kv);
    // A battery style is saved under Panel, which says it keeps its own shapes.
    assert.deepEqual(said.slice(1), kv.startsWith('battery=') ? ['Warning: battery: saved, but the Panel layout keeps its own shapes; styles show in Status bar and Tightest first (layout=bar or layout=focus)'] : [], kv);
    lineOk(x, kv);
  }
  const nope = juiceIn(x, ['set', 'look=nope']).stdout;
  assert.match(nope, /^Nothing changed\.$/m, nope);
  assert.match(nope, /^Warning: look: 'nope' isn't a look\./m, nope);
  const got = JSON.parse(juiceIn(x, ['get']).stdout);
  assert.equal(got.layout, 'panel'); assert.equal(got.order, 'urgent'); assert.equal(got.badges, 0);
  assert.equal(readFileSync(x.settings, 'utf8'), before, 'a look or a setting changed settings.json');
  console.log('ok every look and every setting draws');

  assert.equal(juiceIn(x, ['badges', 'list']).stdout.trim(), 'No badges.');
  assert.deepEqual(lines(juiceIn(x, ['badges', 'add', 'echo x'], { code: 2 })), ['This badge would run: echo x', 'Run again with --yes to add it.']);
  assert.equal(juiceIn(x, ['badges', 'list']).stdout.trim(), 'No badges.', 'a badge was added without --yes');
  assert.match(juiceIn(x, ['badges', 'add', 'echo x', '--yes']).stdout, /^Added badge: echo x$/m);
  assert.equal(juiceIn(x, ['badges', 'list']).stdout.trim(), '1. echo …');
  assert.equal(juiceIn(x, ['badges', 'list', '--show']).stdout.trim(), '1. echo x');
  assert.deepEqual(lines(juiceIn(x, ['badges', 'remove', '1'], { code: 2 })), ['This would remove badge 1: echo …', 'Run again with --yes to remove it.']);
  assert.match(juiceIn(x, ['badges', 'remove', '1', '--yes']).stdout, /^Removed badge: echo …$/m);
  juiceIn(x, ['badges', 'add', 'GITHUB_TOKEN=abc123 echo x', '--yes']);
  assert.equal(juiceIn(x, ['badges', 'list']).stdout.trim(), '1. GITHUB_TOKEN=… echo …');
  assert.match(juiceIn(x, ['badges', 'remove', '1', '--yes']).stdout, /^Removed badge: GITHUB_TOKEN=… echo …$/m);
  console.log('ok badges');

  // The Fable battery through get and doctor only: drawn with it on, the line would read the login.
  let g = JSON.parse(juiceIn(x, ['get']).stdout);
  assert.equal(g.fable, 'auto'); assert.equal(g.fableOn, false);
  juiceIn(x, ['set', 'fable=off']);
  const off = juiceIn(x, ['doctor']).stdout;
  assert.match(off, /^· Fable battery: turned off\.$/m, off);
  assert.match(off, /^Everything looks fine\.$/m, off);
  juiceIn(x, ['set', 'fable=on']);
  g = JSON.parse(juiceIn(x, ['get']).stdout);
  assert.equal(g.fable, 'on'); assert.equal(g.fableOn, true);
  assert.match(juiceIn(x, ['doctor']).stdout, /^· Fable battery: not checked yet\. juice asks in the background for plan subscribers\.$/m);
  juiceIn(x, ['set', 'fable=off']);
  console.log('ok the Fable setting');

  assert.deepEqual(lines(juiceIn(x, ['set', 'motion=on'])), ['Changed: motion', 'juice now refreshes every second.']);
  assert.equal(S(x).statusLine.refreshInterval, 1);
  assert.match(juiceIn(x, ['doctor']).stdout, /^✓ juice is your status line, refreshing every second$/m);
  lineOk(x, 'motion on');
  assert.deepEqual(lines(juiceIn(x, ['set', 'motion=off'])), ['Changed: motion', 'juice now refreshes once a minute.']);
  assert.equal(S(x).statusLine.refreshInterval, 60);
  // A refresh time the person set by hand is theirs.
  writeFileSync(x.settings, JSON.stringify({ ...S(x), statusLine: { ...S(x).statusLine, refreshInterval: 10 } }));
  for (const m of ['on', 'off']) {
    assert.deepEqual(lines(juiceIn(x, ['set', `motion=${m}`])), ['Changed: motion', 'Your status line keeps its own refresh time (every 10 seconds), so juice left it as it is.'], m);
    assert.equal(S(x).statusLine.refreshInterval, 10, m);
  }
  console.log('ok motion');
}

// A project whose own settings set a status line, and hooks turned off: setup and doctor both say so, by a short path.
// The scan walks up from the project to the drive root, so on Windows, where the temp folder sits inside the real home,
// it also reads the real home's project settings (read-only, and nothing below depends on them).
{
  const x = install('project');
  const proj = join(x.home, 'proj'), sub = join(proj, 'sub');
  mkdirSync(join(proj, '.claude'), { recursive: true });
  mkdirSync(sub);
  writeFileSync(join(proj, '.claude', 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: 'echo proj' } }));
  const said = juiceIn(x, ['setup'], { cwd: sub }).stdout;
  assert.match(said, /^\.\.\/\.claude\/settings\.json sets its own status line, so juice won't show in that project\.$/m, said);
  const doc = juiceIn(x, ['doctor'], { cwd: sub }).stdout;
  assert.match(doc, /^! \.\.\/\.claude\/settings\.json sets its own status line, so juice won't show in that project\. To use juice there, take that setting out of that file/m, doc);
  assert.match(doc, /^Lines starting with ! need attention/m, doc);
  assert.doesNotMatch(said + doc, /juice-e2e-|echo proj/, said + doc);
  writeFileSync(x.settings, JSON.stringify({ ...S(x), disableAllHooks: true }));
  assert.match(juiceIn(x, ['doctor']).stdout, /^! Your Claude Code settings turn hooks off \(disableAllHooks\)/m);
  console.log('ok a project with its own status line, and hooks turned off');
}

// A broken install: the launcher deleted, juice turned off in /plugin, juice uninstalled, a settings.json with a mistake.
{
  const x = install('broken');
  juiceIn(x, ['setup']);
  rmSync(x.launcher);
  assert.match(juiceIn(x, ['doctor']).stdout, /^! juice's launcher file is missing, so the status line draws nothing\. Run \/juice setup\.$/m);
  assert.match(juiceIn(x, ['setup']).stdout, /^Its launcher file was missing or from an older juice, so juice put it back\.$/m);
  lineOk(x, 'after setup put the launcher back');
  const good = readFileSync(x.settings, 'utf8');
  writeFileSync(x.settings, JSON.stringify({ ...S(x), enabledPlugins: { 'juice@juice': false } }));
  assert.equal(draw(x).trim(), 'juice is turned off. Turn it on in /plugin. Then /juice restore can bring back your old line.');
  assert.match(juiceIn(x, ['doctor']).stdout, /^! juice is turned off in \/plugin, so the status line only says so\. Turn it back on in \/plugin\.$/m);
  writeFileSync(x.settings, good);
  // Uninstalling marks the copy as replaced before Claude Code deletes it.
  writeFileSync(join(x.plugin, '.orphaned_at'), '1');
  assert.equal(draw(x).trim(), 'juice is not installed. Reinstall it and type /juice restore, or delete statusLine in settings.json.');
  rmSync(join(x.plugin, '.orphaned_at'));
  lineOk(x, 'after reinstalling');
  writeFileSync(x.settings, '{ "statusLine": ');
  assert.match(juiceIn(x, ['setup'], { code: 1 }).stderr, /^Your Claude Code settings file \(settings\.json in your Claude folder\) has a mistake in it, so juice changed nothing\./m);
  assert.equal(readFileSync(x.settings, 'utf8'), '{ "statusLine": ', 'setup overwrote a settings.json with a mistake in it');
  console.log('ok a broken install');
}

// An update from 1.3.x, which set the refresh to every second even with motion off. Claude Code puts the new version
// beside the old one and marks the old one replaced; people never run setup again. The first refresh after the update
// keeps the launcher current and moves the refresh time to what motion wants.
{
  const x = install('update', '1.3.1');
  juiceIn(x, ['setup']);
  writeFileSync(x.settings, JSON.stringify({ ...S(x), statusLine: { ...S(x).statusLine, refreshInterval: 1 } }));
  const next = join(x.market, version);
  plugin(next);
  writeFileSync(join(x.plugin, '.orphaned_at'), '1');
  // Older than the new version's launcher template, as after a real update (the copy keeps the repo file's time).
  const long = new Date(statSync(join(next, 'bin', 'launcher.js')).mtimeMs - 86400000);
  utimesSync(x.launcher, long, long);
  lineOk(x, 'the first refresh after an update');
  assert.equal(S(x).statusLine.refreshInterval, 60, 'the update left the refresh at every second');
  assert.match(juiceIn({ ...x, plugin: next }, ['doctor']).stdout, new RegExp(`^✓ The status line runs juice ${V}$`, 'm'));
  console.log('ok an update from an older juice');
}
