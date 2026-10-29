import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip, at } from './helpers.js';
import { render } from '../src/render/index.js';
import { LAYOUTS } from '../src/render/layouts.js';
import { DEFAULTS, LAYOUT_IDS } from '../src/schema.js';
import { SAMPLES, withAccount } from '../src/samples.js';
import { fg } from '../src/render/ansi.js';
import { palette, NEUTRAL } from '../src/render/palette.js';

const term = { columns: 200, theme: 'dark', ends: 'round', colorDepth: 'truecolor' };
const run = (data, over = {}, t = {}) => render(data, { ...DEFAULTS, ...over }, { ...term, ...t }).text;
const text = (...a) => strip(run(...a));
const inOrder = (s, parts) => parts.reduce((from, p) => {
  const i = s.indexOf(p, from);
  assert.ok(i >= 0, `"${p}" not found in order in: ${s}`);
  return i + p.length;
}, 0);

test('bar busy max reads in order', () => {
  inOrder(text(SAMPLES.busy), ['Opus 5.5', 'high', 'Memory', '64%', 'Session', '47%', 'resets in 2h 10m', 'Fable', '41%', 'Weekly', '50%', 'resets in 3d 5h']);
  assert.equal(text(SAMPLES.busy).match(/resets in/g).length, 2, 'Fable resets with Weekly, so it has no countdown of its own');
});
test('bar trouble shows the warnings', () => {
  const s = text(SAMPLES.trouble);
  for (const w of ['summary soon', 'resets in 2h 5m', 'resets in 1d 2h']) assert.ok(s.includes(w), w);
});
test('refills warnings shows the countdown only where it matters', () => {
  const s = text(SAMPLES.busy, { refills: 'warnings' });
  assert.ok(!s.includes('resets in 2h 10m') && s.includes('resets in 3d 5h'), s);
});
test('Fable keeps its own countdown when Weekly is hidden or resets at another time', () => {
  assert.ok(text(SAMPLES.busy, { show: ['memory', 'session', 'fable'] }).includes('resets in 3d 5h'));
  const apart = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, resetsAt: at(104400) } } };
  assert.ok(text(apart).includes('resets in 1d 5h'));
});
test('warnings do not rely on colour alone: ! going fast, !! nearly out', () => {
  const busy = text(SAMPLES.busy);
  assert.equal((busy.match(/!/g) || []).length, 1, busy);
  assert.match(busy, /Weekly \S+ ! resets in 3d 5h/);
  const trouble = text(SAMPLES.trouble);
  for (const name of ['Memory', 'Session', 'Weekly']) assert.match(trouble, new RegExp(`${name} \\S+ !!`), name);
  for (const layout of LAYOUT_IDS) assert.ok(text(SAMPLES.trouble, { layout }).includes('!!'), layout);
  const fable = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, used: 97 } } };
  assert.match(text(fable), /Fable \S+ !!/, 'Fable keeps its warning even with no countdown');
});
test('Fable has its own colour while fine, and warns like the others when not', () => {
  const v = (t) => { const n = parseInt(NEUTRAL[t].fable.slice(1), 16); return `;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`; };
  for (const layout of ['bar', 'segments', 'panel']) {
    const s = run(SAMPLES.busy, { layout });
    assert.ok(s.includes(v('dark')), layout);
    assert.ok(!run(SAMPLES.busy, { layout, show: ['memory', 'session', 'week'] }).includes(v('dark')), `${layout}: only Fable is violet`);
    assert.ok(run(SAMPLES.busy, { layout }, { theme: 'light' }).includes(v('light')), `${layout} light`);
  }
  const low = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, used: 93 } } };
  for (const layout of LAYOUT_IDS) assert.ok(!run(low, { layout }).includes(v('dark')), layout);
});
test('focus busy', () => {
  const s = text(SAMPLES.busy, { layout: 'focus' });
  inOrder(s, ['Weekly', '50% used ! · resets in 3d 5h', 'Memory 64%', 'Session 47%', 'Fable 41%']);
});
test('panel busy', () => {
  const lines = text(SAMPLES.busy, { layout: 'panel' }).split('\n');
  assert.equal(lines.length, 5);
  assert.ok(lines[1].startsWith('Memory') && lines[1].includes('64% used') && lines[1].includes('in this chat'));
  const f = lines.find((l) => l.startsWith('Fable weekly'));
  assert.ok(f && !f.includes('resets'), f);
  assert.ok(lines.findIndex((l) => l.startsWith('Fable')) < lines.findIndex((l) => l.startsWith('Weekly')));
  assert.equal(new Set(lines.slice(1).map((l) => l.search(/[▆■]/))).size, 1, 'battery bars line up');
});
test('segments busy', () => inOrder(text(SAMPLES.busy, { layout: 'segments' }), ['Session', '47%', 'resets in 2h 10m']));
test('show order and omission', () => {
  const s = text(SAMPLES.busy, { show: ['model', 'effort', 'week', 'session'] });
  assert.ok(s.indexOf('Week') < s.indexOf('Session'));
  assert.ok(!s.includes('Memory'));
});
test('payg', () => {
  const s = text(withAccount(SAMPLES.busy, 'payg'));
  assert.ok(!s.includes('Session') && !s.includes('Week'));
  assert.ok(s.includes('spent $3.42'));
});
test('cost on/auto for a subscriber', () => {
  assert.ok(text(SAMPLES.busy, { cost: 'on' }).includes('$3.42 value'));
  assert.ok(!text(SAMPLES.busy, { cost: 'auto' }).includes('$'));
  assert.ok(!text(withAccount(SAMPLES.busy, 'payg'), { cost: 'off' }).includes('$'));
  assert.ok(!text({ ...SAMPLES.busy, costUsd: null }, { cost: 'on' }).includes('$'));
});
test('fable model highlights the Fable battery', () => {
  const s = run({ ...SAMPLES.busy, model: { name: 'Fable 5.1', isFable: true } });
  assert.ok(s.includes(fg(palette(DEFAULTS, 'dark').accent, 'Fable')));
});
test('plain ends', () => assert.ok(!/[]/.test(run(SAMPLES.busy, {}, { ends: 'plain' }))));
test('light theme', () => assert.ok(run(SAMPLES.busy, {}, { theme: 'light' }).includes('38;2;29;138;78')));
test('badges first', () => assert.ok(text({ ...SAMPLES.busy, badges: ['[RTK 98 ↓61%]'] }).startsWith('[RTK 98 ↓61%]')));
test('no effort', () => {
  const s = text({ ...SAMPLES.busy, effort: null });
  assert.ok(!/[▂▃▅▆]/.test(s) && !s.includes('high'));
});
test('model names', () => {
  assert.ok(text({ ...SAMPLES.busy, model: { name: 'Haiku 5.5', isFable: false } }).includes('Haiku 5.5'));
  assert.ok(text({ ...SAMPLES.busy, model: { name: 'Sonnet 5.5', isFable: false } }).includes('Sonnet 5.5'));
});
test('LAYOUTS keys match LAYOUT_IDS', () => assert.deepEqual(Object.keys(LAYOUTS), [...LAYOUT_IDS]));
test('256 colour output has no truecolor escapes', () => assert.ok(!/38;2;/.test(run(SAMPLES.busy, {}, { colorDepth: '256' }))));
test('unknown layout falls back to bar', () => assert.equal(run(SAMPLES.busy, { layout: 'nope' }), run(SAMPLES.busy)));
test('gateway shows Budget', () => {
  const d = { ...SAMPLES.busy, account: 'gateway', limits: { budget: { used: 20, resetsAt: null, windowSec: null } } };
  assert.ok(text(d).includes('Budget'));
});
test('fit flags hide things', async () => {
  const { makeCtx } = await import('../src/render/palette.js');
  const ctx = makeCtx({ ...SAMPLES.busy, badges: ['[B]'] }, { ...DEFAULTS }, term);
  ctx.fit = { noRefills: true, noEffortWord: true, noModel: true, badges: true };
  const s = strip(LAYOUTS.bar({ ...SAMPLES.busy, badges: ['[B]'] }, ctx));
  assert.ok(!s.includes('resets in 2h 10m') && !s.includes('high') && !s.includes('Opus') && !s.includes('[B]'), s);
  assert.ok(s.includes('resets in 3d 5h'), 'a battery going fast keeps its countdown');
});
