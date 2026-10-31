import { fixture, strip, NOW } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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

test('model name alone renders', async () => {
  const { run } = setup();
  assert.match(strip(await run('{"model":{"display_name":"Opus 5.5"}}')), /Opus 5\.5/);
});

test('internal error falls back to the model name', async () => {
  const out = await runStatusLine({ stdinText: '{"model":{"display_name":"Opus 5.5"}}', env: null, now: NOW, platform: 'win32', spawnDetached() {} });
  assert.equal(out, 'Opus 5.5');
});

test('fable refresh spawns once per lock window, and not on darwin auto', async () => {
  const a = setup('win32');
  await a.run(busy);
  assert.deepEqual(a.calls, [['refresh-fable']]);
  await a.run(busy);
  assert.equal(a.calls.length, 1);
  const b = setup('darwin');
  await b.run(busy);
  assert.deepEqual(b.calls, []);
  const c = setup('win32');
  await c.run(JSON.stringify(fixture('payg')));
  assert.deepEqual(c.calls, [], 'an API-key user\'s login is never sent for limits they do not have');
});

test('configured badge with no cache spawns a refresh and stashes stdin', async () => {
  const { dir, calls, run } = setup('darwin', (p) => ({ badges: [approve(p, 'echo hi')] }));
  await run(busy);
  const key = badgeKey(JSON.parse(busy));
  assert.deepEqual(calls, [['refresh-badges', key]]);
  assert.equal(readFileSync(join(dir, 'juice-cache', 'badges', `${key}.stdin.json`), 'utf8'), busy);
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
  assert.ok(pathToFileURL(hi).href);
});
