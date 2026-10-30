import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip } from './helpers.js';
import { fg, inkOn, contrast } from '../src/render/ansi.js';
import { DEFAULTS, PRESET_IDS } from '../src/schema.js';
import { PRESETS, NEUTRAL, palette, makeCtx } from '../src/render/palette.js';
import { battery, batteryPct, batterySeg, batteryLow, ramp } from '../src/render/pieces.js';
import { SAMPLES, withAccount } from '../src/samples.js';

const mk = (round = false) => makeCtx(SAMPLES.busy, DEFAULTS, { theme: 'dark', ends: round ? 'round' : 'plain' });

test('battery: 8 cells then nub; caps only when round', () => {
  assert.match(strip(battery(mk(), 36, 'ok')), /^.{8}■$/u);
  assert.ok(!strip(battery(mk(false), 36, 'ok')).includes(''));
  assert.ok(strip(battery(mk(true), 36, 'ok')).includes(''));
});

// Visible characters with the foreground/background in effect at each one.
function cells(s) {
  const out = []; let fgc = null, bgc = null;
  for (const m of s.matchAll(/\[([\d;]*)m|([^])/gu)) {
    if (m[2] !== undefined) { out.push({ ch: m[2], fg: fgc, bg: bgc }); continue; }
    const c = m[1];
    if (c === '39') fgc = null; else if (c === '49') bgc = null;
    else if (c.startsWith('38;2;')) fgc = c; else if (c.startsWith('48;2;')) bgc = c;
  }
  return out;
}
const rgb = (hex, k) => `${k};2;${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';')}`;

test('batteryPct: text shown', () => {
  assert.ok(strip(batteryPct(mk(), 36, 'ok')).includes('36%'));
});

// 35: text on casing; 45, 50: text shifted past the fill edge; 82: text on fill; w=5/60: fallback to column 0.
for (const [left, w] of [[35, 7], [45, 7], [50, 7], [82, 7], [60, 5]]) {
  test(`batteryPct: ${left}% (w=${w}) digits are never split by the fill edge`, () => {
    const ctx = mk(), text = `${left}%`;
    const all = cells(batteryPct(ctx, left, 'ok', w)).slice(0, w);
    const i = all.map((c) => c.ch).join('').indexOf(text);
    assert.ok(i >= 0, 'text present in body');
    const run = all.slice(i, i + text.length), edge = Math.round((left / 100) * w);
    assert.ok(!(i < edge && edge < i + text.length), 'fill edge does not fall inside the text');
    assert.equal(new Set(run.map((c) => c.bg)).size, 1, 'one background across the text');
    assert.equal(new Set(run.map((c) => c.fg)).size, 1, 'one foreground across the text');
    if (run[0].bg === rgb(ctx.P.good, 48)) assert.equal(run[0].fg, rgb(inkOn(ctx.P.good), 38));
    else assert.equal(run[0].bg, rgb(ctx.P.casing, 48));
  });
}

test('batteryPct: text on fill uses ink colour as its foreground', () => {
  const ctx = mk(), all = cells(batteryPct(ctx, 82, 'ok')).slice(0, 7);
  const run = all.filter((c) => '82%'.includes(c.ch));
  assert.equal(run.length, 3);
  for (const c of run) assert.deepEqual([c.bg, c.fg], [rgb(ctx.P.good, 48), rgb(inkOn(ctx.P.good), 38)]);
});

test('even-pace tick: one │ where the even pace would be, none without a window', () => {
  const ctx = mk();
  assert.equal(strip(battery(ctx, 19, 'warn', 10, 0.11)).indexOf('│'), 1);
  assert.equal(strip(battery(ctx, 62, 'crit', 10, 0.57)).indexOf('│'), 5);
  assert.ok(!strip(battery(ctx, 62, 'crit', 10)).includes('│'));
  assert.ok(!strip(battery(ctx, 62, 'crit', 10, 0)).includes('│'), 'nothing to mark at the very start');
  assert.equal(strip(batteryLow(ctx, 40, 'ok', 14, 0.5)).indexOf('│'), 7);
});

// 62% halfway through: the tick would land on the centred digits, so they move clear of it and of the fill edge.
for (const [pct, w, tick] of [[62, 7, 0.57], [19, 7, 0.11], [35, 7, 0.5], [82, 7, 0.5]]) {
  test(`batteryPct: ${pct}% with tick at ${tick} keeps the digits whole`, () => {
    const body = strip(batteryPct(mk(), pct, 'ok', w, tick)).slice(0, w);
    assert.ok(body.includes(`${pct}%`), body);
    assert.equal(body.indexOf('│'), Math.floor(tick * w), body);
  });
}

test('batteryPct: no room for both, the digits win', () => {
  const body = strip(batteryPct(mk(), 60, 'ok', 5, 0.5)).slice(0, 5);
  assert.ok(body.includes('60%') && !body.includes('│'), body);
});

test('batterySeg: 5 segments, 3 lit', () => {
  const ctx = mk(), s = batterySeg(ctx, 53, 'ok');
  assert.equal([...strip(s)].filter((c) => c === '▊').length, 5);
  assert.equal(s.split(fg(ctx.P.good, '▊').replace(/▊.*/, '')).length - 1, 3);
});

test('batteryLow uses only ▆ and ■', () => {
  assert.match(strip(batteryLow(mk(), 50, 'warn')), /^[▆■]+$/);
});

test('ramp', () => {
  const ctx = mk(), s = ramp(ctx, 'high');
  assert.equal(strip(s), '▂▃▅▆█');
  assert.equal(s, [0, 1, 2, 3, 4].map((i) => fg(i < 3 ? ctx.P.accent : ctx.P.groove, '▂▃▅▆█'[i])).join(''));
});

test('palette', () => {
  assert.equal(palette(DEFAULTS, 'light').good, '#1d8a4e');
  assert.equal(palette({ ...DEFAULTS, colors: 'safe' }, 'dark').bad, '#ff8b4d');
  assert.equal(palette({ ...DEFAULTS, colors: 'nope' }, 'dark').good, PRESETS.claude.dark[0]);
  const c = { plentyLeft: '#111111', goingFast: '#222222', almostEmpty: '#333333', accent: '#444444' };
  const p = palette({ ...DEFAULTS, colors: { dark: c, light: c } }, 'dark');
  assert.deepEqual([p.good, p.watch, p.bad, p.accent], ['#111111', '#222222', '#333333', '#444444']);
  assert.deepEqual(Object.keys(PRESETS), PRESET_IDS);
});

test('Fable colour: violet, but grey under Calm and pink-purple under Colour-blind safe', () => {
  const fable = (colors, t) => palette({ ...DEFAULTS, colors }, t).fable;
  for (const t of ['dark', 'light']) {
    assert.equal(fable('claude', t), NEUTRAL[t].fable);
    assert.equal(fable('calm', t), PRESETS.calm[t][0], 'grey until it matters');
    assert.equal(fable('safe', t), PRESETS.safe[t][3], 'stays apart from the blue');
    const own = { plentyLeft: '#111111', goingFast: '#222222', almostEmpty: '#333333', accent: '#444444' };
    assert.equal(fable({ dark: own, light: own }, t), NEUTRAL[t].fable);
  }
});

// Same bar as the customizer's "Easy to read" readout.
test('every colour set is readable on its terminal background', () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    assert.ok(p.name && p.note, id);
    for (const t of ['dark', 'light']) {
      assert.equal(p[t].length, 4, `${id}.${t}`);
      p[t].forEach((c, i) => assert.ok(contrast(c, NEUTRAL[t].bg) >= 3, `${id}.${t}[${i}] ${c}`));
    }
  }
  for (const t of ['dark', 'light']) assert.ok(contrast(NEUTRAL[t].fable, NEUTRAL[t].bg) >= 3, `fable ${t}`);
});

test('samples and withAccount', () => {
  const d = SAMPLES.busy, before = JSON.stringify(d);
  assert.deepEqual(Object.keys(withAccount(d, 'pro').limits), ['session', 'week']);
  assert.equal(withAccount(d, 'max').limits.fable.used, 41);
  const p = withAccount(d, 'payg');
  assert.equal(p.account, 'payg');
  assert.deepEqual(p.limits, {});
  assert.equal(JSON.stringify(d), before);
});
