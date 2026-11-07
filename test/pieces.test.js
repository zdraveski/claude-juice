import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip } from './helpers.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fg, inkOn, contrast, mix, to256 } from '../src/render/ansi.js';
import { DEFAULTS, PRESET_IDS, BATTERY_IDS } from '../src/schema.js';
import { PRESETS, NEUTRAL, palette, makeCtx } from '../src/render/palette.js';
import { battery, batteryPct, batterySeg, batteryLow, ramp, chip } from '../src/render/pieces.js';
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

test('makeCtx: style follows the setting, classic without colour', () => {
  const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'dark' });
  assert.equal(ctx.style, 'hot');
  assert.equal(ctx.dark, true);
  assert.equal(makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'light' }).dark, false);
  assert.equal(makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'dark', colorDepth: 'none' }).style, 'classic');
});

// Battery styles. sk: a plain-ends context drawing one style.
const sk = (style, theme = 'dark', extra = {}) => makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: style }, { theme, ends: 'plain', ...extra });

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

test('no colour draws every style as classic', () => {
  const plain = strip(batteryPct(sk('classic'), 62, 'warn', 7, 0.4));
  for (const style of BATTERY_IDS) assert.equal(strip(batteryPct(sk(style, 'dark', { colorDepth: 'none' }), 62, 'warn', 7, 0.4)), plain, style);
});

test('glossy: full cells are ▀ on the fill, glass casing is tinted', () => {
  const ctx = sk('glossy'), c = ctx.P.good;
  for (const x of cells(battery(ctx, 100, 'ok')).slice(0, 8)) assert.deepEqual([x.ch, x.bg], ['▀', rgb(c, 48)]);
  for (const x of cells(battery(ctx, 0, 'ok')).slice(0, 8)) assert.deepEqual([x.ch, x.bg], ['▀', rgb(mix(ctx.P.casing, c, 0.16), 48)]);
});

test('glossy light: the empty shine differs from the casing', () => {
  for (const colors of PRESET_IDS) {
    const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, colors }, { theme: 'light' });
    const casing = mix(ctx.P.casing, ctx.P.good, 0.22);
    assert.ok(contrast(mix(casing, '#ffffff', 0.45), casing) > 1.05, colors);
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
});

test('every style survives 256 colours', () => {
  for (const style of BATTERY_IDS) for (const pct of [0, 45, 82, 100])
    assert.ok(!/[34]8;2;/.test(to256(batteryPct(sk(style), pct, 'warn', 7, 0.5) + battery(sk(style, 'light'), pct, 'crit', 12, 0.3))), style);
});

for (const style of BATTERY_IDS) for (const [left, w, t] of [[35, 7], [45, 7], [50, 7], [82, 7], [60, 5], [62, 7, 0.57], [82, 7, 0.5]]) {
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
