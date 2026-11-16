import { fixture, strip, NOW, at, cleanEnv } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, linkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runStatusLine } from '../src/statusline.js';
import { resolveTarget, turnedOff } from '../bin/launcher.js';
import { badgeKey, approve } from '../src/badges.js';
import { paths } from '../src/paths.js';

// settings may be a function of the config dir, for badges that must be approved on "this computer".
const setup = (platform = 'win32', settings) => {
  const dir = mkdtempSync(join(tmpdir(), 'juice-sl-'));
  if (settings) writeFileSync(join(dir, 'juice.json'), JSON.stringify(typeof settings === 'function' ? settings(paths({ CLAUDE_CONFIG_DIR: dir })) : settings));
  const calls = [];
  const run = (stdinText) => runStatusLine({ stdinText, env: { CLAUDE_CONFIG_DIR: dir }, now: NOW, platform, spawnDetached: (a) => calls.push(a) });
  return { dir, calls, run };
};
const busy = JSON.stringify(fixture('busy'));

test('busy fixture renders and remembers', async () => {
  const { dir, run } = setup();
  assert.match(strip(await run(busy)), /Session/);
  assert.ok(existsSync(join(dir, 'juice-cache', 'lastseen.json')));
});

test('empty and bad stdin never throw', async () => {
  const { run } = setup();
  assert.equal(await run(''), '');
  assert.equal(await run('{bad'), '');
});

test('stdin that starts with a BOM still draws', async () => {
  const { run } = setup();
  assert.match(strip(await run('﻿' + busy)), /Session/);
});

test('model name alone renders', async () => {
  const { run } = setup();
  assert.match(strip(await run('{"model":{"display_name":"Opus 5.5"}}')), /Opus 5\.5/);
});

test('internal error falls back to the model name', async () => {
  const out = await runStatusLine({ stdinText: '{"model":{"display_name":"Opus 5.5"}}', env: null, now: NOW, platform: 'win32', spawnDetached() {} });
  assert.equal(strip(out), 'Opus 5.5 juice: /juice doctor');
});

const brokenStdin = (model) => JSON.stringify({ ...(model && { model: { display_name: model } }), rate_limits: { five_hour: { used_percentage: 10, resets_at: Math.floor(NOW / 1000) + 3600 } } });
const broken = { getTime() { throw new Error('clock broke'); } };
const drawBroken = (env, s) => runStatusLine({ stdinText: s, env: { CLAUDE_CONFIG_DIR: setup().dir, ...env }, now: broken, platform: 'linux', spawnDetached() {} });

test('a broken run says where to look: dim, or plain without colour', async () => {
  assert.equal(await drawBroken({}, brokenStdin('Opus 5.5')), 'Opus 5.5 \x1b[2mjuice: /juice doctor\x1b[22m');
  assert.equal(await drawBroken({ NO_COLOR: '1' }, brokenStdin('Opus 5.5')), 'Opus 5.5 juice: /juice doctor');
  assert.equal(await drawBroken({ NO_COLOR: '1' }, brokenStdin()), 'juice: /juice doctor');
});

test('a run that works shows no hint, even with empty stdin', async () => {
  const { run } = setup();
  for (const s of ['', '{}', 'not json', busy]) assert.doesNotMatch(strip(await run(s)), /juice doctor/);
});

test('the real line stands still unless motion is on', async () => {
  // NOW is minute-aligned, so it is climb frame 0, and 10 s later is frame 5 of the same climb.
  const draw = (settings, now) => runStatusLine({ stdinText: busy, env: { CLAUDE_CONFIG_DIR: setup('win32', settings).dir }, now, platform: 'win32', spawnDetached() {} });
  assert.equal(await draw(undefined, NOW), await draw(undefined, at(10)));
  assert.notEqual(await draw({ motion: 'on' }, NOW), await draw({ motion: 'on' }, at(10)));
});

test('fable refresh spawns once per lock window, and not on darwin auto', async () => {
  const a = setup('win32', { fable: 'on' });
  await a.run(busy);
  assert.deepEqual(a.calls, [['refresh-fable']]);
  await a.run(busy);
  assert.equal(a.calls.length, 1);
  const b = setup('darwin');
  await b.run(busy);
  assert.deepEqual(b.calls, []);
  const c = setup('win32', { fable: 'on' });
  await c.run(JSON.stringify(fixture('payg')));
  assert.deepEqual(c.calls, [], 'an API-key user\'s login is never sent for limits they do not have');
});

test('fable auto reads no login on a new install, and keeps a current user on even with a damaged reading', async () => {
  const { dir, calls, run } = setup('win32');
  await run(busy);
  assert.ok(!calls.some((c) => c[0] === 'refresh-fable'));
  mkdirSync(join(dir, 'juice-cache'), { recursive: true });
  writeFileSync(join(dir, 'juice-cache', 'fable.json'), 'not json');
  assert.match(strip(await run(busy)), /Session/);
  assert.ok(calls.some((c) => c[0] === 'refresh-fable'));
});

test('configured badge with no cache spawns a refresh and stashes stdin', async () => {
  const { dir, calls, run } = setup('darwin', (p) => ({ badges: [approve(p, 'echo hi')] }));
  await run(busy);
  const key = badgeKey(JSON.parse(busy));
  assert.deepEqual(calls, [['refresh-badges', key]]);
  assert.equal(readFileSync(join(dir, 'juice-cache', 'badges', `${key}.stdin.json`), 'utf8'), busy);
});

test('the stashed stdin is replaced, never written through a link planted at its name', async () => {
  const { dir, run } = setup('darwin', (p) => ({ badges: [approve(p, 'echo hi')] }));
  const victim = join(dir, 'victim.txt');
  writeFileSync(victim, 'mine');
  const badgeDir = join(dir, 'juice-cache', 'badges');
  mkdirSync(badgeDir, { recursive: true });
  linkSync(victim, join(badgeDir, `${badgeKey(JSON.parse(busy))}.stdin.json`)); // a hard link needs no admin rights on Windows
  await run(busy);
  assert.equal(readFileSync(victim, 'utf8'), 'mine');
});

test('the stashed stdin is private to the person', { skip: process.platform === 'win32' && 'Windows has no owner-only file mode' }, async () => {
  const { dir, run } = setup('darwin', (p) => ({ badges: [approve(p, 'echo hi')] }));
  await run(busy);
  assert.equal(statSync(join(dir, 'juice-cache', 'badges', `${badgeKey(JSON.parse(busy))}.stdin.json`)).mode & 0o777, 0o600);
});

test('a stdin pipe that never closes still ends in a drawn line', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'juice-hang-'));
  const c = spawn(process.execPath, [fileURLToPath(new URL('../bin/juice-statusline.js', import.meta.url))], { env: cleanEnv(dir), stdio: ['pipe', 'pipe', 'ignore'] });
  let out = '';
  c.stdout.on('data', (d) => { out += d; });
  c.stdin.write('{"model":{"display_name":"Opus 5.5"}}'); // and never end it
  const code = await new Promise((res) => { const t = setTimeout(() => { c.kill(); res('hung'); }, 6000); c.on('exit', (x) => { clearTimeout(t); res(x); }); });
  assert.equal(code, 0);
  assert.match(out, /Opus 5\.5/);
});

test('a badge from a copied or hand-edited juice.json never runs: it has no approval from this computer', async () => {
  const other = mkdtempSync(join(tmpdir(), 'juice-other-'));
  const signedElsewhere = approve(paths({ CLAUDE_CONFIG_DIR: other }), 'echo pwned');
  for (const badges of [[{ command: 'echo pwned' }], [signedElsewhere], [{ command: 'echo pwned', sig: '0'.repeat(64) }]]) {
    const { calls, run } = setup('darwin', { badges });
    await run(busy);
    assert.deepEqual(calls, [], JSON.stringify(badges));
  }
});

test('launcher picks the highest version, or the pinned one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'juice-ln-'));
  const mk = (...parts) => { const f = join(dir, ...parts, 'bin', 'juice-statusline.js'); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, ''); return f; };
  mk('plugins', 'cache', 'm', 'juice', '1.2.0');
  const hi = mk('plugins', 'cache', 'm', 'juice', '1.10.0');
  assert.equal(resolveTarget(dir, null), hi);
  // Folders Claude Code names by code version are no release numbers: "41f6…" must not count as version 41.
  mk('plugins', 'cache', 'm', 'juice', '41f619d61b99');
  mk('plugins', 'cache', 'm', 'juice', 'abc123def456');
  assert.equal(resolveTarget(dir, null, 'm'), hi);
  const pin = mk('pinned');
  assert.equal(resolveTarget(dir, join(dir, 'pinned')), pin);
  assert.equal(resolveTarget(join(dir, 'nothing'), null), null);
  const other = mk('plugins', 'cache', 'someone-else', 'juice', '9.0.0');
  assert.equal(resolveTarget(dir, null), other); // without a marketplace, any juice can win
  assert.equal(resolveTarget(dir, null, 'm'), hi); // with one, only its own copy runs
  const gone = mk('plugins', 'cache', 'm', 'juice', '2.0.0');
  writeFileSync(join(gone, '..', '..', '.orphaned_at'), '1');
  assert.equal(resolveTarget(dir, null, 'm'), hi, 'a version Claude Code marked as replaced or uninstalled never runs');
  assert.equal(turnedOff(dir, 'm'), false, 'no settings: on');
  writeFileSync(join(dir, 'settings.json'), '﻿' + JSON.stringify({ enabledPlugins: { 'juice@m': false, 'juice@other': true } }));
  assert.equal(turnedOff(dir, 'm'), true, 'turned off in /plugin');
  assert.equal(turnedOff(dir, 'other'), false);
  assert.equal(turnedOff(dir, null), false, 'a pinned dev install has no marketplace to check');
});
