import { fixture, strip, NOW } from './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runStatusLine } from '../src/statusline.js';
import { resolveTarget } from '../bin/launcher.js';
import { badgeKey } from '../src/badges.js';

const setup = (platform = 'win32', settings) => {
  const dir = mkdtempSync(join(tmpdir(), 'juice-sl-'));
  if (settings) writeFileSync(join(dir, 'juice.json'), JSON.stringify(settings));
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
});

test('configured badge with no cache spawns a refresh and stashes stdin', async () => {
  const { dir, calls, run } = setup('darwin', { badges: [{ command: 'echo hi' }] });
  await run(busy);
  const key = badgeKey(JSON.parse(busy));
  assert.deepEqual(calls, [['refresh-badges', key]]);
  assert.equal(readFileSync(join(dir, 'juice-cache', 'badges', `${key}.stdin.json`), 'utf8'), busy);
});

test('launcher picks the highest version, or the pinned one', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'juice-ln-'));
  const mk = (...parts) => { const f = join(dir, ...parts, 'bin', 'juice-statusline.js'); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, ''); return f; };
  mk('plugins', 'cache', 'm', 'juice', '1.2.0');
  const hi = mk('plugins', 'cache', 'm', 'juice', '1.10.0');
  assert.equal(resolveTarget(dir, null), hi);
  const pin = mk('pinned');
  assert.equal(resolveTarget(dir, join(dir, 'pinned')), pin);
  assert.equal(resolveTarget(join(dir, 'nothing'), null), null);
  const other = mk('plugins', 'cache', 'someone-else', 'juice', '9.0.0');
  assert.equal(resolveTarget(dir, null), other); // without a marketplace, any juice can win
  assert.equal(resolveTarget(dir, null, 'm'), hi); // with one, only its own copy runs
  assert.ok(pathToFileURL(hi).href);
});
