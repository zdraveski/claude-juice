import { NOW, at } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, memLevel } from '../src/render/limits.js';

const A = (used, s, windowSec) => assess({ used, resetsAt: at(s), windowSec }, NOW);
const H5 = 18000, D7 = 604800;

test('ok / warn / crit levels', () => {
  const a = A(12, 13680, H5);
  assert.equal(a.level, 'ok');
  const b = A(50, 277200, D7);
  assert.equal(b.level, 'warn');
  assert.equal(A(62, 172800, D7).level, 'warn');
});

test('on pace to run out is crit', () => {
  assert.equal(A(88, 7500, H5).level, 'crit');
  assert.equal(A(95, 93600, D7).level, 'crit');
  assert.ok(!('runsOut' in A(88, 7500, H5)) && !('outAt' in A(88, 7500, H5)));
});

test('gates', () => {
  assert.equal(A(40, 17100, H5).level, 'ok');
  assert.equal(A(3, 9000, H5).level, 'ok');
  const n = A(92, 3600, null);
  assert.equal(n.level, 'crit');
});

test('clamp and refill', () => {
  const c = A(140, 3600, H5);
  assert.equal(c.used, 100); assert.equal(c.level, 'crit');
  const p = A(70, -60, H5);
  assert.equal(p.used, 0); assert.equal(p.resetsAt, null); assert.equal(p.level, 'ok');
});

test('memLevel', () => {
  assert.equal(memLevel(69), 'ok'); assert.equal(memLevel(70), 'warn'); assert.equal(memLevel(85), 'crit');
});
