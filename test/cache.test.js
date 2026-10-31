import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { paths } from '../src/paths.js';
import { readJson, writeJsonAtomic, takeLock, HOT_WRITE } from '../src/cache.js';
import { loadSettings, saveSettings } from '../src/settings.js';
import { DEFAULTS } from '../src/schema.js';
import { NOW, at } from './helpers.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'juice-'));

test('paths follow CLAUDE_CONFIG_DIR', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: '/c' });
  assert.equal(p.settingsFile, join('/c', 'juice.json'));
  assert.equal(p.cacheDir, join('/c', 'juice-cache'));
  assert.equal(p.claudeSettings, join('/c', 'settings.json'));
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

test('loadSettings: missing -> fresh defaults, corrupt -> warning, save round trips', () => {
  const p = paths({ CLAUDE_CONFIG_DIR: tmp() });
  const r = loadSettings(p);
  assert.deepEqual(r.settings, DEFAULTS);
  assert.notEqual(r.settings, DEFAULTS);
  assert.notEqual(r.settings.badges, DEFAULTS.badges);
  mkdirSync(p.config, { recursive: true });
  writeFileSync(p.settingsFile, '{"a":');
  const c = loadSettings(p);
  assert.deepEqual(c.settings, DEFAULTS);
  assert.equal(c.warnings.length, 1);
  saveSettings(p, { ...DEFAULTS, layout: 'panel' });
  assert.equal(loadSettings(p).settings.layout, 'panel');
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
