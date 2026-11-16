import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, mkdirSync, statSync, unlinkSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { paths } from '../src/paths.js';
import { readJson, writeJsonAtomic, takeLock, holdLock, removeOld, HOT_WRITE } from '../src/cache.js';
import { loadSettings, saveSettings } from '../src/settings.js';
import { DEFAULTS } from '../src/schema.js';
import { NOW, at } from './helpers.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'juice-'));

test('paths follow CLAUDE_CONFIG_DIR, always as a full path', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: '/c' });
  assert.equal(p.settingsFile, join(resolve('/c'), 'juice.json'));
  assert.equal(p.cacheDir, join(resolve('/c'), 'juice-cache'));
  assert.equal(p.claudeSettings, join(resolve('/c'), 'settings.json'));
  assert.equal(p.fableFile, join(resolve('/c'), 'juice-cache', 'fable.json'));
  assert.equal(paths({ CLAUDE_CONFIG_DIR: 'rel/cfg' }).config, resolve('rel/cfg'), 'relative becomes full, so the launcher works from any folder');
});

test('a BOM at the start of a JSON file is fine', () => {
  const f = join(tmp(), 'bom.json');
  writeFileSync(f, '﻿{"a":1}');
  assert.deepEqual(readJson(f), { a: 1 });
});

test('rewriting a file keeps its permissions (a private settings.json stays private)', { skip: process.platform === 'win32' && 'Windows has no owner-only file mode' }, () => {
  const f = join(tmp(), 'settings.json');
  writeFileSync(f, '{}', { mode: 0o600 });
  writeJsonAtomic(f, { env: { KEY: 'secret' } });
  assert.equal(statSync(f).mode & 0o777, 0o600);
});

test('round trip, and bad files read as null', () => {
  const d = tmp(), f = join(d, 'sub', 'a.json');
  writeJsonAtomic(f, { a: 1 });
  assert.deepEqual(readJson(f), { a: 1 });
  writeFileSync(join(d, 'bad.json'), '{"a":');
  writeFileSync(join(d, 'empty.json'), '');
  assert.equal(readJson(join(d, 'bad.json')), null);
  assert.equal(readJson(join(d, 'empty.json')), null);
  assert.equal(readJson(join(d, 'none.json')), null);
});

test('concurrent writers never expose a partial file', async () => {
  const d = tmp(), f = join(d, 'x.json');
  const url = new URL('../src/cache.js', import.meta.url).href;
  const code = `import(${JSON.stringify(url)}).then(m=>{for(let i=0;i<50;i++)m.writeJsonAtomic(${JSON.stringify(f)},{n:i,pad:'x'.repeat(5000)})})`;
  let running = 4;
  const done = new Promise((res, rej) => {
    for (let i = 0; i < 4; i++) {
      const c = spawn(process.execPath, ['-e', code], { stdio: 'inherit' });
      c.on('exit', (st) => { if (st) rej(new Error('child exit ' + st)); else if (!--running) res(); });
    }
  });
  let finished = false, reads = 0;
  done.then(() => { finished = true; }, () => { finished = true; });
  while (!finished) {
    const v = readJson(f);
    if (v !== null) assert.equal(v.pad.length, 5000);
    reads++;
    await new Promise((r) => setTimeout(r, 1));
  }
  await done;
  assert.ok(reads > 0);
  assert.deepEqual(readdirSync(d).filter((n) => n.endsWith('.tmp')), []);
});

test('takeLock', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  assert.equal(takeLock(p, 'u', NOW), true);
  assert.equal(takeLock(p, 'u', at(10)), false);
  assert.equal(takeLock(p, 'u', at(31)), true);
  assert.equal(takeLock(p, 'v', at(7200)), true); // taken while the clock was 2 hours ahead
  assert.equal(takeLock(p, 'v', at(60)), true); // clock corrected: refreshes carry on
});

// Windows that draw together read the clock a moment apart, so the winner's time can be just after another's.
test('takeLock leaves a lock taken a moment after this window read the clock', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  assert.equal(takeLock(p, 'u', at(1)), true);
  assert.equal(takeLock(p, 'u', NOW), false);
});

// Six windows call takeLock at the same instant; returns what each one got.
async function race(p) {
  const url = new URL('../src/cache.js', import.meta.url).href;
  const go = Date.now() + 1500; // every child waits for the same instant, so they really do collide
  const code = `import(${JSON.stringify(url)}).then(m=>{while(Date.now()<${go});process.stdout.write(String(m.takeLock({cacheDir:${JSON.stringify(p.cacheDir)}},'u',new Date(${NOW.getTime()}))))})`;
  return Promise.all(Array.from({ length: 6 }, () => new Promise((res) => {
    let out = '';
    const c = spawn(process.execPath, ['-e', code]);
    c.stdout.on('data', (d) => { out += d; });
    c.on('close', () => res(out));
  })));
}

test('takeLock gives the lock to one of many windows drawing at the same moment', async () => {
  const wins = await race(paths({ CLAUDE_CONFIG_DIR: tmp() }));
  assert.equal(wins.filter((w) => w === 'true').length, 1, wins.join());
});

test('takeLock gives a stale lock to only one of the windows that find it', async () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  mkdirSync(p.cacheDir, { recursive: true });
  writeFileSync(join(p.cacheDir, 'u.lock'), String(NOW.getTime() - 60000));
  const wins = await race(p);
  assert.equal(wins.filter((w) => w === 'true').length, 1, wins.join());
});

test('an empty lock is one being written: left alone while young, replaced once old', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() }), f = join(p.cacheDir, 'u.lock');
  mkdirSync(p.cacheDir, { recursive: true });
  writeFileSync(f, '');
  assert.equal(takeLock(p, 'u', NOW), false);
  utimesSync(f, new Date(0), new Date(0)); // left empty by a window that crashed long ago
  assert.equal(takeLock(p, 'u', NOW), true);
});

// A clock hours ahead, then put right, leaves files dated in the future: they must not stay stuck for those hours.
test('a lock or leftover dated hours ahead by a wrong clock is not stuck until the clock catches up', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() }), f = join(p.cacheDir, 'u.lock'), left = join(p.cacheDir, 'u.lock.1.steal');
  mkdirSync(p.cacheDir, { recursive: true });
  const ahead = new Date(Date.now() + 3 * 3600000);
  writeFileSync(f, ''); utimesSync(f, ahead, ahead); // a run stopped before writing its time, while the clock was ahead
  assert.equal(takeLock(p, 'u', new Date()), true);
  writeFileSync(left, ''); utimesSync(left, ahead, ahead);
  removeOld(p.cacheDir, (n) => n.endsWith('.steal'), 30000);
  assert.equal(existsSync(left), false);
});

test('holdLock keeps a lock closed for as long as asked, then lets go', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  holdLock(p, 'u', NOW, 900000);
  assert.equal(takeLock(p, 'u', at(600)), false);
  assert.equal(takeLock(p, 'u', at(601), 2500), false, 'the hold wins over the caller\'s shorter wait');
  assert.equal(takeLock(p, 'u', at(901)), true);
});

test('takeLock replaces an unreadable lock', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  mkdirSync(p.cacheDir, { recursive: true });
  writeFileSync(join(p.cacheDir, 'u.lock'), 'junk');
  assert.equal(takeLock(p, 'u', NOW), true);
  assert.equal(readJson(join(p.cacheDir, 'u.lock')), NOW.getTime());
});

test('a target that can never be replaced fails at once, even with the long wait', () => {
  const d = tmp(), target = join(d, 'dir.json');
  mkdirSync(target);
  const t0 = Date.now();
  assert.throws(() => writeJsonAtomic(target, { a: 1 }));
  assert.ok(Date.now() - t0 < 300, `took ${Date.now() - t0} ms`);
  assert.deepEqual(readdirSync(d).filter((n) => n.endsWith('.tmp')), []);
});

test('the cache folders are private to the person', { skip: process.platform === 'win32' && 'Windows has no owner-only folder mode' }, () => {
  const d = tmp(), f = join(d, 'juice-cache', 'badges', 'a.json');
  writeJsonAtomic(f, {});
  assert.equal(statSync(join(d, 'juice-cache')).mode & 0o777, 0o700);
  assert.equal(statSync(join(d, 'juice-cache', 'badges')).mode & 0o777, 0o700);
});

test('loadSettings: missing -> fresh defaults, corrupt -> warning, save round trips', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  const r = loadSettings(p);
  assert.deepEqual(r.settings, DEFAULTS);
  assert.notEqual(r.settings, DEFAULTS);
  assert.notEqual(r.settings.badges, DEFAULTS.badges);
  mkdirSync(p.config, { recursive: true });
  writeFileSync(p.settingsFile, '{"a":');
  const c = loadSettings(p);
  assert.deepEqual(c.settings, { ...DEFAULTS, fable: 'off' });
  assert.equal(c.warnings.length, 1);
  assert.throws(() => saveSettings(p, { ...DEFAULTS, layout: 'panel' }), /can't be read/, 'never saves defaults over a file it could not read');
  unlinkSync(p.settingsFile);
  saveSettings(p, { ...DEFAULTS, layout: 'panel' });
  assert.equal(loadSettings(p).settings.layout, 'panel');
});

test('a broken or mistyped juice.json never turns the Fable login read back on', () => {
  // The file may hold a "no" from setup: reading the login on a guess would break that promise.
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  mkdirSync(p.config, { recursive: true });
  for (const text of ['{"fable":"off",}', '{"fable":"Off"}', '{"fable":false}', '{"fable":"no"}']) {
    writeFileSync(p.settingsFile, text);
    assert.equal(loadSettings(p).settings.fable, 'off', text);
  }
  writeFileSync(p.settingsFile, '{"fable":"Off"}');
  assert.match(loadSettings(p).warnings.join('\n'), /fable: 'Off' isn't valid, using 'off'/);
  unlinkSync(p.settingsFile);
  assert.equal(loadSettings(p).settings.fable, 'auto', 'no file at all is a fresh install, which /juice setup asks first');
});

test('hot-path writes fail fast and takeLock returns false instead of throwing', () => {
  const d = tmp(), target = join(d, 'dir.json');
  mkdirSync(target); // renaming a file over a directory always fails
  const t0 = Date.now();
  assert.throws(() => writeJsonAtomic(target, { a: 1 }, HOT_WRITE));
  assert.ok(Date.now() - t0 < 200);
  assert.deepEqual(readdirSync(d).filter((n) => n.endsWith('.tmp')), []);
  const p = paths({ CLAUDE_CONFIG_DIR: d });
  mkdirSync(join(p.cacheDir, 'u.lock'), { recursive: true });
  assert.equal(takeLock(p, 'u', NOW), false);
});
