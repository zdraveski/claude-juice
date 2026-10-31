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

test('Pro/trouble/bar at 80 keeps every red battery and when it runs out', () => {
  const r = go(withAccount(SAMPLES.trouble, 'pro'), 'bar', 80);
  const t = strip(r.text);
  assert.ok(widest(r.text) <= 80, t);
  assert.match(t, /Memory \S+■!!  Session \S+■!! out ~2:44 PM  Week \S+■!! out ~9:48 PM/, 'marks stay, glued to the battery; the run-out time beats the countdown');
  assert.ok(!t.includes('…'), t);
  assert.ok(t.includes('Week ') && !t.includes('Weekly'), 'squeezed label is the short one');
  assert.deepEqual(r.dropped, ['the effort level', 'the model name', 'spacing', 'battery size', 'warning words']);
});

test('a narrow window keeps every battery and gives up words, names and spacing first', () => {
  const t = strip(go(SAMPLES.busy, 'bar', 80).text);
  for (const name of ['Memory', 'Session', 'Fable', 'Week']) assert.ok(t.includes(name), `${name} missing: ${t}`);
  assert.ok(!t.includes('Opus'), t);
});

test('a battery that is fine goes only when nothing else is left to give, and then nothing lesser comes back', () => {
  const r = go(SAMPLES.busy, 'bar', 60);
  assert.equal(r.dropped.at(-1), 'batteries that are fine');
  assert.ok(r.dropped.includes('battery size') && r.dropped.includes('warning words'), r.dropped.join(', '));
});

test('a red Fable battery says when it runs out even while Weekly shows the shared reset', () => {
  const red = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, used: 80 } } };
  for (const id of ['bar', 'segments', 'panel']) {
    const fable = strip(go(red, id, 400).text).split(/Fable/)[1].split(/Weekly/)[0];
    assert.match(fable, /runs out ~/, id);
    assert.doesNotMatch(fable, /resets/, `${id}: the countdown is Weekly's to show`);
  }
});

test('focus respects refills=warnings for its big battery', () => {
  const ctx = makeCtx(SAMPLES.quiet, { ...DEFAULTS, layout: 'focus', refills: 'warnings' }, term(400));
  assert.doesNotMatch(strip(fit(LAYOUTS.focus, SAMPLES.quiet, ctx, 400).text), /resets/);
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
  const labels = FIT_STEPS.map(([, label]) => label);
  let cuts = 0;
  for (const id of Object.keys(LAYOUTS)) for (const [n, d] of Object.entries(SAMPLES)) for (const w of [20, 30, 60, 80, 120, 200]) {
    const r = go(d, id, w), at = `${id}/${n}/${w}`;
    const idx = r.dropped.filter((x) => x !== 'the end of the line').map((x) => labels.indexOf(x));
    assert.ok(idx.every((i) => i >= 0) && idx.every((v, i) => !i || v > idx[i - 1]), at);
    if (strip(r.text).includes('…')) {
      cuts++;
      const ctx = makeCtx(d, { ...DEFAULTS, layout: id }, term(w));
      let allTried = false;
      const probe = fit((x, c) => { allTried ||= FIT_STEPS.every(([f]) => c.fit[f]); return LAYOUTS[id](x, c); }, d, ctx, w);
      assert.ok(allTried, at);
      assert.equal(probe.dropped.at(-1), 'the end of the line', at);
    }
  }
  assert.ok(cuts > 0, 'no case exercised the cut');
});

test('FIT_STEPS has the ten steps in the agreed order', () => {
  assert.deepEqual(FIT_STEPS.map((s) => s[0]), ['badges', 'noRefills', 'noEffortWord', 'noCost', 'noEffort', 'noModel', 'tight', 'small', 'shortWords', 'onlyTrouble']);
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
