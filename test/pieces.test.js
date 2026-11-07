import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip } from './helpers.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fg, vis, inkOn, contrast, mix, to256 } from '../src/render/ansi.js';
import { DEFAULTS, PRESET_IDS, BATTERY_IDS, FORM_IDS } from '../src/schema.js';
import { PRESETS, NEUTRAL, palette, makeCtx } from '../src/render/palette.js';
import { battery, batteryPct, batterySeg, batteryLow, ramp, chip, form, CLIMB_MS } from '../src/render/pieces.js';
import { EFFORT } from '../src/render/words.js';
import { SAMPLES, withAccount } from '../src/samples.js';

// The checks that name the casing or the tick are about the classic cells.
const mk = (round = false) => makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'classic' }, { theme: 'dark', ends: round ? 'round' : 'plain' });

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
  assert.equal(strip(s), '▂▃▅▁▁', 'the steps above the level are flat, so the level reads without colour');
  assert.equal(s, [0, 1, 2, 3, 4].map((i) => (i < 3 ? fg(mix(ctx.P.sub, ctx.P.accent, (i + 1) / 5), '▂▃▅▆█'[i]) : fg(ctx.P.groove, '▁'))).join(''));
  assert.notEqual(strip(ramp(ctx, 'medium')), strip(ramp(ctx, 'max')));
});

test('ramp on the real line climbs to the level a step at a time, holds, and starts again', () => {
  const at = (frame, effort) => strip(ramp({ ...mk(), animate: true, now: new Date(frame * CLIMB_MS + CLIMB_MS / 2) }, effort));
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((f) => at(f, 'high')), ['▁▁▁▁▁', '▂▁▁▁▁', '▂▃▁▁▁', '▂▃▅▁▁', '▂▃▅▁▁', '▂▃▅▁▁', '▁▁▁▁▁']);
  assert.deepEqual([0, 1, 5, 6].map((f) => at(f, 'low')), ['▁▁▁▁▁', '▂▁▁▁▁', '▂▁▁▁▁', '▁▁▁▁▁'], 'every level starts again together');
  assert.deepEqual([4, 5, 6].map((f) => at(f, 'max')), ['▂▃▅▆▁', '▂▃▅▆█', '▁▁▁▁▁'], 'max holds a frame at the top');
  for (let f = 0; f < 14; f++) for (const e of Object.keys(EFFORT)) assert.equal(vis(ramp({ ...mk(), animate: true, now: new Date(f * CLIMB_MS) }, e)), 5, 'the width never moves');
  assert.equal(strip(ramp({ ...mk(), now: new Date(0) }, 'high')), '▂▃▅▁▁', 'previews stay still');
  assert.equal(makeCtx(SAMPLES.busy, DEFAULTS, { theme: 'dark', animate: true }).animate, true);
  assert.equal(makeCtx(SAMPLES.busy, DEFAULTS, { theme: 'dark' }).animate, false);
});

test('battery pictures on the real line climb to what is used in 4 steps and hold; the number never moves', () => {
  const live = (f) => ({ ...mk(), animate: true, now: new Date(f * CLIMB_MS + CLIMB_MS / 2) });
  const lit = (f) => batteryLow(live(f), 100, 'ok', 8).split(fg(mk().P.good, '▆').replace(/▆.*/, '')).length - 1;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(lit), [2, 4, 6, 8, 8, 8, 2], 'never from nothing; starts again with the effort steps');
  assert.deepEqual([0, 1, 2].map((f) => batteryLow(live(f), 100, 'crit', 8)), Array(3).fill(batteryLow(mk(), 100, 'crit', 8)), 'a red battery stands still');
  const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'dots' }, { theme: 'dark', animate: true });
  assert.deepEqual([0, 1, 3, 6].map((f) => strip(form({ ...ctx, now: new Date(f * CLIMB_MS) }, 100, 'ok'))),['••······', '••••····', '••••••••', '••······']);
  assert.equal(strip(form({ ...ctx, animate: false }, 50, 'ok')), '••••····', 'previews stay still');
  // 80% used, half the window gone: the tick (going fast) only shows against the whole fill.
  assert.deepEqual([0, 3].map((f) => strip(battery(live(f), 80, 'warn', 8, 0.5)).includes('│')), [false, true]);
});

test('climbing never changes a picture\'s width or where its number sits', () => {
  const at = (style, f) => ({ ...makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: style }, { theme: 'dark', animate: true }), now: new Date(f * CLIMB_MS + CLIMB_MS / 2) });
  for (const style of BATTERY_IDS) for (const [pct, e] of [[64, 0.5], [3, 0.9], [100, 0.2]]) {
    const pics = (f) => [battery(at(style, f), pct, 'warn', 8, e), batteryPct(at(style, f), pct, 'warn', 7, e), batterySeg(at(style, f), pct, 'warn'),
      batteryLow(at(style, f), pct, 'warn', 14, e), FORM_IDS.includes(style) ? form(at(style, f), pct, 'warn', false, e) : ''];
    const still = pics(3);
    for (let f = 0; f < 7; f++) pics(f).forEach((p, j) => {
      assert.equal(vis(p), vis(still[j]), `${style} ${pct}% frame ${f} piece ${j}`);
      if (j === 1) assert.equal(strip(p).indexOf(`${pct}%`), strip(still[j]).indexOf(`${pct}%`), `${style} ${pct}% frame ${f}: the number stays put`);
    });
  }
  assert.equal(strip(ramp({ ...mk(), animate: true, now: new Date(0) }, 'high', false)), '▂▃▅▁▁', 'without its word the effort level stands still');
});

test('palette', () => {
  assert.equal(palette(DEFAULTS, 'light').good, '#1d8a4e');
  assert.equal(palette({ ...DEFAULTS, colors: 'safe' }, 'dark').bad, '#ff8b4d');
  assert.equal(palette({ ...DEFAULTS, colors: 'nope' }, 'dark').good, PRESETS.claude.dark[0]);
  const c = { plentyLeft: '#111111', goingFast: '#222222', almostEmpty: '#333333', accent: '#444444' };
  const p = palette({ ...DEFAULTS, colors: { dark: c, light: c } }, 'dark');
  assert.deepEqual([p.good, p.watch, p.bad, p.accent], ['#111111', '#222222', '#333333', '#444444']);
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

test('makeCtx: style follows the setting, even without colour (the skins draw classic then)', () => {
  const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'dark' });
  assert.equal(ctx.style, 'hot');
  assert.equal(ctx.dark, true);
  assert.equal(makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'light' }).dark, false);
  assert.equal(makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'dark', colorDepth: 'none' }).style, 'hot');
});

// Battery styles. sk: a plain-ends context drawing one style.
const sk = (style, theme = 'dark', extra = {}) => makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: style }, { theme, ends: 'plain', ...extra });
// The styles that draw a battery; the forms (pie, sand, ...) draw their own shapes.
const SKINS = BATTERY_IDS.filter((id) => !FORM_IDS.includes(id));

// Every classic battery and batteryPct, hashed: the fixture was recorded from the code before the styles existed.
function classicRun() {
  const out = [];
  for (const theme of ['dark', 'light']) for (const round of [true, false]) {
    const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'classic' }, { theme, ends: round ? 'round' : 'plain' });
    for (const pct of [0, 3, 36, 45, 50, 82, 99, 100]) for (const level of ['ok', 'warn', 'crit', 'fable'])
      for (const w of [5, 7, 8, 12]) for (const elapsed of [undefined, 0.3, 0.9])
        out.push([battery(ctx, pct, level, w, elapsed), batteryPct(ctx, pct, level, w, elapsed)]);
  }
  return { count: out.length, sha256: createHash('sha256').update(JSON.stringify(out)).digest('hex') };
}

test('classic style matches the old output byte for byte', () => {
  const want = JSON.parse(readFileSync(new URL('./fixtures/battery-classic.json', import.meta.url), 'utf8'));
  assert.deepEqual(classicRun(), want);
});

test('no colour draws every battery skin as classic', () => {
  const plain = strip(batteryPct(sk('classic'), 62, 'warn', 7, 0.4));
  for (const style of SKINS) assert.equal(strip(batteryPct(sk(style, 'dark', { colorDepth: 'none' }), 62, 'warn', 7, 0.4)), plain, style);
});

test('glossy: full cells are ▀ on the fill, glass casing is tinted', () => {
  const ctx = sk('glossy'), c = ctx.P.good;
  for (const x of cells(battery(ctx, 100, 'ok')).slice(0, 8)) assert.deepEqual([x.ch, x.bg], ['▀', rgb(c, 48)]);
  for (const x of cells(battery(ctx, 0, 'ok')).slice(0, 8)) assert.deepEqual([x.ch, x.bg], ['▀', rgb(mix(ctx.P.casing, c, 0.16), 48)]);
});

const hexOf = (esc) => '#' + esc.split(';').slice(2).map((v) => (+v).toString(16).padStart(2, '0')).join('');

test('glossy: the empty shine stands out from its glass in every set, theme and level', () => {
  for (const theme of ['dark', 'light']) for (const colors of PRESET_IDS) for (const level of ['ok', 'warn', 'crit', 'fable']) {
    const empty = cells(battery(makeCtx(SAMPLES.busy, { ...DEFAULTS, colors }, { theme }), 0, level))[1];
    assert.equal(empty.ch, '▀');
    assert.ok(contrast(hexOf(empty.fg), hexOf(empty.bg)) > 1.15, `${colors} ${theme} ${level}`);
  }
});

test('outline: walls, dots, no background, no caps', () => {
  const round = makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'outline' }, { theme: 'dark', ends: 'round' });
  assert.match(strip(battery(round, 36, 'ok')), /^▕.{8}▏▪$/u);
  assert.ok(strip(battery(round, 36, 'ok')).includes('·'));
  assert.ok(!batteryPct(round, 82, 'ok').includes('48;2'));
  assert.ok(!batteryPct(round, 36, 'warn', 7, 0.5).includes('48;2'));
});

test('hot: heats only when warning', () => {
  assert.equal(battery(sk('hot'), 50, 'ok', 8, 0.3), battery(sk('classic'), 50, 'ok', 8, 0.3));
  assert.equal(batteryPct(sk('hot'), 50, 'fable', 7), batteryPct(sk('classic'), 50, 'fable', 7));
  const ctx = sk('hot'), body = cells(battery(ctx, 88, 'crit')).slice(0, 8).filter((x) => x.ch !== ' ');
  assert.equal(body[0].fg, rgb(ctx.P.good, 38));
  assert.equal(body.at(-1).fg, rgb(ctx.P.bad, 38));
  assert.ok(new Set(body.map((x) => x.fg)).size > 3, 'the colour changes along the fill');
});

test('liquid: the last lit cell is the edge, and it stands out in every set and theme', () => {
  for (const theme of ['dark', 'light']) for (const colors of PRESET_IDS) for (const level of ['ok', 'warn', 'crit']) {
    const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, colors, battery: 'liquid' }, { theme });
    const c = ctx.P[{ ok: 'good', warn: 'watch', crit: 'bad' }[level]];
    const body = cells(battery(ctx, 50, level)).slice(0, 4);
    assert.deepEqual(body.slice(0, 3).map((x) => x.fg), [c, c, c].map((h) => rgb(h, 38)), `${colors} ${theme}`);
    const edge = '#' + body[3].fg.split(';').slice(2).map((v) => (+v).toString(16).padStart(2, '0')).join('');
    assert.ok(contrast(edge, c) > 1.15, `${colors} ${theme} ${level}`);
    if (contrast(mix(c, theme === 'dark' ? '#ffffff' : '#000000', theme === 'dark' ? 0.45 : 0.25), c) > 1.15)
      assert.equal(edge, mix(c, theme === 'dark' ? '#ffffff' : '#000000', theme === 'dark' ? 0.45 : 0.25), 'brighter on dark, deeper on light');
  }
});

test('pace: soft before the pace point, no tick', () => {
  const ctx = sk('pace'), c = ctx.P.good, soft = mix(c, ctx.P.casing, 0.55);
  const s = battery(ctx, 80, 'ok', 8, 0.5);
  assert.deepEqual(cells(s).slice(0, 6).map((x) => x.fg), [soft, soft, soft, soft, c, c].map((h) => rgb(h, 38)));
  assert.ok(!strip(s).includes('│'));
  assert.equal(battery(ctx, 80, 'ok', 8), battery(sk('classic'), 80, 'ok', 8), 'no window: classic');
  // A window that has run out (a stale cache clamps elapsed to 1) puts the pace point at the end: all soft.
  assert.ok(cells(battery(ctx, 80, 'ok', 8, 1)).slice(0, 6).every((x) => x.fg === rgb(soft, 38)));
});

test('every style survives 256 colours', () => {
  for (const style of SKINS) for (const pct of [0, 45, 82, 100])
    assert.ok(!/[34]8;2;/.test(to256(batteryPct(sk(style), pct, 'warn', 7, 0.5) + battery(sk(style, 'light'), pct, 'crit', 12, 0.3))), style);
});

for (const style of SKINS) for (const [left, w, t] of [[35, 7], [45, 7], [50, 7], [82, 7], [60, 5], [62, 7, 0.57], [82, 7, 0.5]]) {
  test(`${style}: ${left}% (w=${w}${t ? `, tick ${t}` : ''}) digits stay whole, one colour each`, () => {
    // Outline's left wall is not a cell.
    const text = `${left}%`, all = cells(batteryPct(sk(style), left, 'warn', w, t)).filter((c) => c.ch !== '▕' && c.ch !== '\ue0b6').slice(0, w);
    const i = all.map((c) => c.ch).join('').indexOf(text);
    assert.ok(i >= 0, 'text present in body');
    const run = all.slice(i, i + text.length), edge = Math.round((left / 100) * w);
    assert.ok(!(i < edge && edge < i + text.length), 'fill edge does not fall inside the text');
    assert.equal(new Set(run.map((c) => c.bg)).size, 1, 'one background across the text');
    assert.equal(new Set(run.map((c) => c.fg)).size, 1, 'one foreground across the text');
  });
}

test('chip: model on a tinted tag, round caps only when round', () => {
  const round = makeCtx(SAMPLES.busy, DEFAULTS, { theme: 'dark', ends: 'round' }), plain = sk('glossy'), light = sk('glossy', 'light');
  assert.equal(strip(chip(round, 'Opus 5.5')), '\ue0b6◆ Opus 5.5\ue0b4');
  assert.equal(strip(chip(plain, 'Opus 5.5')), ' ◆ Opus 5.5 ');
  assert.equal(strip(chip(sk('glossy', 'dark', { colorDepth: 'none' }), 'Opus 5.5')), '◆ Opus 5.5', 'no tint, so no padding');
  const tag = (ctx) => cells(chip(ctx, 'Opus 5.5')).find((x) => x.ch === 'O');
  assert.equal(tag(plain).bg, rgb(mix(plain.P.bg, plain.P.accent, 0.22), 48));
  assert.equal(tag(light).bg, rgb(mix(light.P.bg, light.P.accent, 0.14), 48));
  assert.equal(tag(plain).fg, rgb(plain.P.text, 38));
  assert.ok(chip(plain, 'Opus 5.5').includes('\x1b[1m'), 'the name is bold');
});

test('ramp: lit steps warm toward the accent', () => {
  const ctx = mk(), steps = cells(ramp(ctx, 'max'));
  assert.equal(new Set(steps.map((x) => x.fg)).size, 5);
  assert.equal(steps[4].fg, rgb(ctx.P.accent, 38));
});

// Review: glass tinted toward the digit colour cost up to a third of the number's contrast.
test('glossy: a number off the fill sits on the plain casing, as readable as classic', () => {
  for (const theme of ['dark', 'light']) for (const colors of PRESET_IDS) for (const level of ['ok', 'warn', 'crit']) {
    const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, colors, battery: 'glossy' }, { theme });
    const digit = cells(batteryPct(ctx, 10, level, 7)).find((x) => x.ch === '1');
    assert.equal(digit.bg, rgb(ctx.P.casing, 48), `${colors} ${theme} ${level}`);
  }
});

// The forms: shapes instead of a battery, the number after them.
const FORM_W = { pie: [1, 1], sand: [5, 3], slider: [8, 5], race: [9, 6], lives: [5, 3], dots: [8, 5], chevrons: [6, 4], ruler: [10, 7] };
const fm = (style, pct, small = false, elapsed, extra) => strip(form(sk(style, 'dark', extra), pct, 'ok', small, elapsed));

test('forms: a fixed width at every level, normal and squeezed', () => {
  assert.deepEqual(Object.keys(FORM_W), FORM_IDS);
  for (const id of FORM_IDS) for (const small of [false, true]) for (const pct of [0, 1, 13, 47, 50, 88, 99, 100]) for (const e of [undefined, 0.25, 0.9])
    assert.equal(vis(form(sk(id), pct, 'warn', small, e)), FORM_W[id][+small], `${id} ${pct}% small=${small}`);
});

test('forms: the shapes', () => {
  assert.deepEqual([0, 13, 50, 70, 100].map((p) => fm('pie', p)), ['○', '◔', '◑', '◕', '●']);
  assert.equal(fm('sand', 50), '⣿⣿⣤⠂⠂');
  assert.equal(fm('sand', 100), '⣿⣿⣿⣿⣿');
  assert.equal(fm('slider', 0), '●───────');
  assert.equal(fm('slider', 50), '━━━●────');
  assert.equal(fm('slider', 100), '━━━━━━━●');
  assert.equal(fm('race', 47, false, 0.25), '··│·●····');
  assert.equal(fm('race', 47), '····●····', 'no window: no pace line');
  assert.equal(fm('race', 25, false, 0.25), '··●······', 'on pace: you cover the line');
  assert.deepEqual([0, 50, 99, 100].map((p) => fm('lives', p)), ['♥♥♥♥♥', '♥♥♡♡♡', '♥♡♡♡♡', '♡♡♡♡♡']);
  assert.equal(fm('dots', 50), '••••····');
  assert.equal(fm('chevrons', 50), '▸▸▸▹▹▹');
  assert.equal(fm('ruler', 50, false, 0.25), '┣━╋━━────┫');
  assert.equal(fm('ruler', 25, false, 0.5), '┣━━─┿────┫');
  assert.equal(fm('ruler', 50), '┣━━━━────┫');
});

test('forms: without colour they stay, and used differs from left by shape', () => {
  assert.equal(sk('slider', 'dark', { colorDepth: 'none' }).style, 'slider');
  for (const id of FORM_IDS) {
    const none = { colorDepth: 'none' };
    assert.notEqual(fm(id, 30, false, undefined, none), fm(id, 70, false, undefined, none), id);
  }
});

test('forms: lit in the level colour, the rest in the label grey; every form survives 256 colours', () => {
  const ctx = sk('dots'), c = cells(form(ctx, 50, 'crit', false));
  assert.equal(c[0].fg, rgb(ctx.P.bad, 38));
  assert.equal(c.at(-1).fg, rgb(ctx.P.mute, 38));
  for (const id of FORM_IDS) assert.ok(!/[34]8;2;/.test(to256(form(sk(id, 'light'), 45, 'warn', false, 0.5))), id);
});

test('forms: only 100% looks full and only 0% looks empty', () => {
  for (const id of FORM_IDS) for (const small of [false, true]) for (const e of [undefined, 0.5, 0.9, 0.97]) {
    assert.notEqual(fm(id, 99, small, e), fm(id, 100, small, e), `${id} 99 vs 100 small=${small} e=${e}`);
    assert.notEqual(fm(id, 1, small, e), fm(id, 0, small, e), `${id} 1 vs 0 small=${small} e=${e}`);
  }
  assert.equal(fm('pie', 88), '◕');
  assert.equal(fm('pie', 1), '◔');
  assert.equal(fm('sand', 1), '⣀⠂⠂⠂⠂');
  assert.equal(fm('sand', 1, true), '⣀⠂⠂');
  assert.equal(fm('sand', 0), '⠂⠂⠂⠂⠂', 'an empty gauge still shows');
  // Without colour an empty cell must look lighter than the least use: one dot against two.
  const dots = (s) => [...s].reduce((n, ch) => n + (ch.codePointAt(0) - 0x2800).toString(2).replace(/0/g, '').length, 0);
  const mono = (p, small) => fm('sand', p, small, undefined, { colorDepth: 'none' });
  for (const small of [false, true]) assert.ok(dots(mono(1, small)) - dots(mono(0, small)) >= 1 && mono(1, small)[0] === '⣀', `small=${small}`);
});

test('ruler and race: on pace, a little ahead and a little behind always look different', () => {
  for (const small of [false, true]) for (let p = 2; p <= 98; p++) {
    const e = p / 100, r = (u) => fm('ruler', u, small, e).slice(1, -1), q = (u) => fm('race', u, small, e);
    const on = r(p), ahead = r(p + 2), behind = r(p - 2);
    assert.ok(on.includes('╋') && !on.slice(on.indexOf('╋')).includes('━'), `on ${p}% small=${small}: ${on}`);
    // Below about 18% (30% squeezed) one cell is lit: no room inside the fill for an ahead tick.
    if (p + 2 > (small ? 30 : 18)) assert.ok(ahead.slice(ahead.indexOf('╋')).includes('━'), `ahead ${p}% small=${small}: ${ahead}`);
    assert.ok(behind.includes('┿') && !behind.slice(behind.indexOf('┿')).includes('━'), `behind ${p}% small=${small}: ${behind}`);
    assert.ok(!q(p).includes('│'), `race on ${p}%: ${q(p)}`);
    assert.ok(q(p + 2).indexOf('│') < q(p + 2).indexOf('●'), `race ahead ${p}%: ${q(p + 2)}`);
    assert.ok(q(p - 2).indexOf('│') > q(p - 2).indexOf('●'), `race behind ${p}%: ${q(p - 2)}`);
  }
});

test('ruler and race: within a point of even use is on pace, more is ahead or behind, every time', () => {
  for (const small of [false, true]) for (let p = 2; p <= 98; p++) for (const d of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) {
    const e = (p + d) / 100, r = fm('ruler', p, small, e).slice(1, -1), q = fm('race', p, small, e), at = `${p}% e=${e} small=${small}`;
    const t = r.search(/[╋┿]/), lit = r.split('━').length - 1 + (r[t] === '╋'), on = Math.abs(p - Math.round(p + d)) <= 1;
    if (on) {
      assert.equal(t, lit - 1 < 0 ? 0 : lit - 1, `ruler on pace ${at}: ${r}`);
      assert.ok(!q.includes('│'), `race on pace ${at}: ${q}`);
    }
  }
  // 11 with 12 gone and 12 with 13 gone are both a point behind: same look, no flicker.
  assert.equal(fm('ruler', 11, false, 0.12), fm('ruler', 11, false, 0.11));
  assert.equal(fm('ruler', 12, false, 0.13), fm('ruler', 12, false, 0.12));
  // A half point rounds up even where floating point says 14.4999…: 16% with 14.5% gone is a point ahead, on pace.
  assert.ok(!fm('race', 16, false, 0.145).includes('│'));
  // Nothing used just after a reset is on pace: no tick, as ┿ would say behind.
  for (const small of [false, true]) for (const e of [0.001, 0.01, 0.013]) assert.doesNotMatch(fm('ruler', 0, small, e), /[╋┿]/, `e=${e} small=${small}`);
  assert.match(fm('ruler', 0, false, 0.05), /┿/, 'behind still shows at 0% once even use is past a point');
  assert.match(fm('ruler', 0, true, 0.2), /┿/, 'behind still shows at 0% once even use is past a point, squeezed too');
});
test('forms: an exact half cell rounds down, so a cell lights only when more than half is used', () => {
  assert.equal(fm('dots', 50, true), '••···');
  assert.equal(fm('lives', 50, true), '♥♡♡');
  assert.equal(fm('chevrons', 50, true), '▸▸▹▹');
  assert.equal(fm('dots', 51, true), '•••··');
  assert.equal(fm('dots', 1, true), '•····', 'but any use still lights one');
});
test('forms: a missing percentage draws like 0 at the fixed width and never throws', () => {
  for (const id of FORM_IDS) for (const small of [false, true]) for (const pct of [undefined, NaN, null]) {
    assert.equal(fm(id, pct, small, 0.5), fm(id, 0, small, 0.5), `${id} ${pct}`);
    assert.equal(vis(form(sk(id), pct, 'ok', small)), FORM_W[id][+small], `${id} ${pct}`);
  }
});

test('forms: an empty or full run sends no empty colour codes', () => {
  for (const [id, p] of [['lives', 100], ['dots', 0], ['chevrons', 0], ['dots', 100]]) assert.doesNotMatch(form(sk(id), p, 'ok', false), /m\x1b\[39m/, id);
});

test('forms: the unused part stands out from the background in every theme', () => {
  for (const theme of ['dark', 'light']) assert.ok(contrast(sk('dots', theme).P.mute, NEUTRAL[theme].bg) >= 3, theme);
});
