import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip } from './helpers.js';
import { render } from '../src/render/index.js';
import { LAYOUTS } from '../src/render/layouts.js';
import { FIT_STEPS, fit } from '../src/render/fit.js';
import { makeCtx } from '../src/render/palette.js';
import { vis } from '../src/render/ansi.js';
import { DEFAULTS, LOOKS, applySet } from '../src/schema.js';
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

test('in a narrow window an amber battery gives way before a red one, and words before a red battery', () => {
  const at = (s) => new Date(SAMPLES.busy.now.getTime() + s * 1000);
  const d = { ...SAMPLES.busy, memoryUsed: 72, limits: { session: { used: 88, resetsAt: at(7500), windowSec: 18000 }, week: { used: 80, resetsAt: at(200000), windowSec: 604800 } } };
  const t = strip(go(d, 'bar', 40).text);
  assert.match(t, /Session .*88%.* ?!!\s+Week(ly)? .*80%.* ?!!$/, t);
  assert.doesNotMatch(t, /Memory|…/, t);
});

// A red Weekly once vanished at 40-57 columns because its neighbour's "out ~2:44 PM" was kept instead.
test('every red battery stays on screen, with its number, before any run-out or reset words', () => {
  for (const w of [40, 44, 50, 56, 58, 60, 64]) { // three red batteries as words need 39 columns
    const t = strip(go(SAMPLES.trouble, 'bar', w).text);
    for (const re of [/Memory \S*91%/, /Session \S*88%/, /Week(ly)? \S*95%/]) assert.match(t, re, `${w}: ${t}`);
    assert.doesNotMatch(t, /…/, `${w}: ${t}`);
  }
});

// The spotlight layout separates items with " │ " and " · ", not two spaces; a cut there once showed "Week 9…".
test('every layout, at every width, cuts only between items while each item fits on its own', () => {
  for (const layout of Object.keys(LAYOUTS)) for (const sample of ['busy', 'trouble']) for (let w = 24; w <= 140; w++) {
    for (const ln of strip(go(SAMPLES[sample], layout, w).text).split('\n')) {
      if (ln.endsWith('…')) assert.match(ln, / …$/, `${layout} ${sample} @${w}: cut mid-item: ${ln}`);
    }
  }
});

test('every battery as words comes before hiding any', () => {
  const t = strip(go(SAMPLES.busy, 'bar', 60).text);
  for (const name of ['Memory 64%', 'Session 47%', 'Fable 41%', 'Week 50%!']) assert.ok(t.includes(name), `${name} missing: ${t}`);
});

test('once a fine battery is hidden, the room it frees goes back to the batteries, never to lesser things', () => {
  const r = go(SAMPLES.busy, 'bar', 40), t = strip(r.text);
  assert.equal(r.dropped.at(-1), 'batteries that are fine');
  assert.match(t, /Weekly \S+ ! resets Sat 7:20 PM/, 'full size and full words again');
  assert.ok(!t.includes('Opus') && !t.includes('▂'), 'hidden things stay hidden: the model and effort are less important than a battery');
});

// The sweep the audits ran, kept as a test: every look, every width, both themes.
test('sweep: never too wide, and nothing less important shows while a battery that is fine is hidden', () => {
  const lesser = ['◆', '▂', 'spent', 'value'];
  for (const look of LOOKS) for (const [n, d] of Object.entries(SAMPLES)) for (let w = 20; w <= 250; w += 3) for (const theme of ['dark', 'light']) {
    const r = render(d, applySet(DEFAULTS, [`look=${look.id}`]).settings, term(w, { theme })), t = strip(r.text), at = `${look.id}/${n}/${w}/${theme}`;
    assert.ok(widest(r.text) <= w, `${at} is ${widest(r.text)} wide`);
    if (r.dropped.includes('batteries that are fine')) for (const x of lesser) assert.ok(!t.includes(x), `${at} shows "${x}" while hiding a battery: ${t}`);
  }
});

// From 70 columns the three red batteries of the trouble sample fit as words ("Memory 91%!!  Session 88%!! out ~…").
test('sweep: a red battery keeps its "!!" and its run-out time wherever the words fit', () => {
  for (const look of LOOKS) for (let w = 70; w <= 250; w += 2) {
    const s = applySet(DEFAULTS, [`look=${look.id}`]).settings, t = strip(render(SAMPLES.trouble, s, term(w)).text);
    const reds = ['memory', 'session', 'week'].filter((id) => s.show.includes(id)).length;
    assert.equal((t.match(/!!/g) || []).length, reds, `${look.id}/${w}: ${t}`);
    if (s.show.includes('session')) assert.match(t, /out ~2:44 PM/, `${look.id}/${w}: Session runs out soon and must say when: ${t}`);
  }
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

// The panel pads between a battery's name and its number; that padding once read as a gap, leaving "Session …".
test('the Everything look keeps each red battery\'s number in a narrow window', () => {
  const everything = applySet(DEFAULTS, ['look=everything']).settings;
  for (let w = 26; w <= 44; w++) {
    const rows = strip(render(SAMPLES.trouble, everything, term(w)).text).split('\n');
    for (const [name, n] of [['Session', '88%'], ['Weekly', '95%']]) {
      const row = rows.find((r) => r.startsWith(name));
      assert.ok(row?.includes(n), `@${w} ${name}: ${row}`);
    }
  }
});

test('trouble/bar at 24 is cut with an ellipsis and says so', () => {
  const r = go(SAMPLES.trouble, 'bar', 24);
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

test('FIT_STEPS has the thirteen steps in the agreed order', () => {
  assert.deepEqual(FIT_STEPS.map((s) => s[0]), ['badges', 'noRefills', 'noEffortWord', 'noCost', 'noEffort', 'noModel', 'tight', 'small', 'shortWords', 'bare', 'onlyTrouble', 'onlyRed', 'noNotes']);
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
