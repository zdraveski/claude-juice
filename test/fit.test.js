import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip } from './helpers.js';
import { render } from '../src/render/index.js';
import { LAYOUTS } from '../src/render/layouts.js';
import { FIT_STEPS, fit } from '../src/render/fit.js';
import { makeCtx } from '../src/render/palette.js';
import { vis } from '../src/render/ansi.js';
import { DEFAULTS } from '../src/schema.js';
import { SAMPLES, withAccount } from '../src/samples.js';

const term = (columns, extra = {}) => ({ columns, theme: 'dark', ends: 'round', colorDepth: 'truecolor', ...extra });
const go = (data, layout, columns, extra) => render(data, { ...DEFAULTS, layout }, term(columns, extra));
const widest = (t) => Math.max(...strip(t).split('\n').map(vis));

test('Pro/trouble/bar at 80 drops six things and keeps the reset times', () => {
  const r = go(withAccount(SAMPLES.trouble, 'pro'), 'bar', 80);
  const t = strip(r.text);
  assert.ok(widest(r.text) <= 80, t);
  assert.ok(t.includes('resets 2h 5m') && t.includes('resets 1d 2h'), t);
  assert.match(t, /Memory \S+■!!  Session \S+■!! resets 2h 5m  Week \S+■!! resets 1d 2h/, 'marks stay, glued to the battery');
  assert.ok(!t.includes('…'), t);
  assert.ok(t.includes('Week ') && !t.includes('Weekly'), 'squeezed label is the short one');
  assert.deepEqual(r.dropped, ['the effort word', 'the model name', 'the effort level', 'spacing', 'battery size', 'warning words']);
});

test('busy/bar at 200 drops nothing', () => {
  assert.deepEqual(go(SAMPLES.busy, 'bar', 200).dropped, []);
});

test('trouble/bar at 40 is cut with an ellipsis and says so', () => {
  const r = go(SAMPLES.trouble, 'bar', 40);
  assert.ok(strip(r.text).split('\n')[0].endsWith('…'));
  assert.equal(r.dropped.at(-1), 'the end of the line');
});

test('nothing is ever wider than 20 columns', () => {
  for (const id of Object.keys(LAYOUTS)) for (const [n, d] of Object.entries(SAMPLES))
    assert.ok(widest(go(d, id, 20).text) <= 20, `${id}/${n}`);
});

test('steps run in order and are all tried before a cut', () => {
  const labels = ['badges', 'reset times', 'the effort word', 'cost', 'batteries that are fine', 'the model name', 'the effort level', 'spacing', 'battery size', 'warning words'];
  let cuts = 0;
  for (const id of Object.keys(LAYOUTS)) for (const [n, d] of Object.entries(SAMPLES)) for (const w of [20, 30, 60, 80, 120, 200]) {
    const r = go(d, id, w), at = `${id}/${n}/${w}`;
    const idx = r.dropped.filter((x) => x !== 'the end of the line').map((x) => labels.indexOf(x));
    assert.ok(idx.every((i) => i >= 0) && idx.every((v, i) => !i || v > idx[i - 1]), at);
    if (strip(r.text).includes('…')) {
      cuts++;
      const ctx = makeCtx(d, { ...DEFAULTS, layout: id }, term(w));
      let used = {};
      const probe = fit((x, c) => { used = c.fit; return LAYOUTS[id](x, c); }, d, ctx, w);
      assert.ok(FIT_STEPS.every(([f]) => used[f]), at);
      assert.equal(probe.dropped.at(-1), 'the end of the line', at);
    }
  }
  assert.ok(cuts > 0, 'no case exercised the cut');
});

test('FIT_STEPS has the ten steps in the agreed order', () => {
  assert.deepEqual(FIT_STEPS.map((s) => s[0]), ['badges', 'noRefills', 'noEffortWord', 'noCost', 'onlyTrouble', 'noModel', 'noEffort', 'tight', 'small', 'shortWords']);
});

test('a missing columns count means 120', () => {
  const t = term(120); delete t.columns;
  const a = render(SAMPLES.busy, { ...DEFAULTS, layout: 'bar' }, t), b = go(SAMPLES.busy, 'bar', 120);
  assert.deepEqual(a, b);
});

test('256 colour output has no truecolor escapes', () => {
  const t = go(SAMPLES.busy, 'bar', 120, { colorDepth: '256' }).text;
  assert.ok(!t.includes('38;2;') && t.includes('38;5;'));
});
