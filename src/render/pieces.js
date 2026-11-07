import { fg, bg, bold, inkOn, mix, contrast } from './ansi.js';
import { tone } from './palette.js';
import { EFFORT } from './words.js';

const EIGHTH = ' ▏▎▍▌▋▊▉', RAMP = '▂▃▅▆█';
// Without colour (NO_COLOR, plain-text previews) lit and unlit cells must differ by shape.
const OFF = '░';

// Steps above the level are drawn flat, so the staircase climbs by shape, not by colour alone.
export function ramp(ctx, effort) {
  const n = EFFORT[effort][0];
  let s = '';
  // Lit steps warm from the quiet grey to the accent as they climb.
  for (let i = 0; i < 5; i++) s += i < n ? fg(mix(ctx.P.sub, ctx.P.accent, (i + 1) / 5), RAMP[i]) : fg(ctx.P.groove, '▁');
  return s;
}

// The model's name on a tag tinted with the accent; rounded ends only when ctx.round.
export function chip(ctx, text) {
  const { P } = ctx, tint = mix(P.bg, P.accent, ctx.dark ? 0.22 : 0.14);
  const body = fg(P.accent, '◆ ') + fg(P.text, bold(text));
  return ctx.round ? fg(tint, CAP_L) + bg(tint, body) + fg(tint, CAP_R) : bg(tint, ' ' + body + ' ');
}

// The even-pace tick: the cell where the fill would be now if the limit were used evenly (elapsed is 0..1).
// Fill past the tick means going fast, which reads without colour.
const tickAt = (elapsed, w) => (elapsed > 0 && elapsed < 1 ? Math.floor(elapsed * w) : -1);
const CAP_L = '\ue0b6', CAP_R = '\ue0b4';
// Liquid's leading edge: brighter on dark terminals, deeper on light ones, unless that barely shows (a yellow made whiter).
const edge = (c, dark) => {
  const up = mix(c, '#ffffff', 0.45), down = mix(c, '#000000', 0.25), [first, other] = dark ? [up, down] : [down, up];
  return contrast(first, c) > 1.15 ? first : other;
};

// One battery's look under ctx.style (see BATTERY_IDS); classic is the flat look juice started with.
// glossy: lit-from-above cells in tinted glass; outline: walls and dots, no casing; hot: the fill heats from
// good to the warning colour, only when warning; liquid: a bright leading edge; pace: soft up to the even pace, no tick.
function skin(ctx, c, level, cells, w, elapsed) {
  const { P, style, dark } = ctx, glossy = style === 'glossy', outline = style === 'outline';
  const casing = outline ? null : glossy ? mix(P.casing, c, dark ? 0.16 : 0.22) : P.casing;
  const last = Math.ceil(cells - 1 / 8) - 1; // the last cell showing any fill
  const soft = style === 'pace' && elapsed > 0 && elapsed < 1 ? Math.floor(elapsed * w) : 0;
  const heat = style === 'hot' && (level === 'warn' || level === 'crit');
  const color = (i) => (heat ? mix(P.good, c, last > 0 ? Math.min(1, i / last) : 1)
    : style === 'liquid' && i === last ? edge(c, dark)
    : i < soft ? mix(c, casing, 0.55) : c);
  const cell = (i) => {
    const f = Math.max(0, Math.min(1, cells - i)), col = color(i), glyph = f >= 1 ? '█' : EIGHTH[Math.floor(f * 8)];
    if (outline) return glyph === ' ' ? fg(P.groove, '·') : fg(col, glyph);
    if (glossy && f >= 1) return bg(col, fg(mix(col, '#ffffff', 0.38), '▀'));
    if (glossy && glyph === ' ') return bg(casing, fg(mix(casing, '#ffffff', dark ? 0.07 : 0.45), '▀'));
    return bg(casing, fg(col, glyph));
  };
  const tick = (i) => (outline ? fg(P.text, '│') : cells - i >= 0.5 ? bg(color(i), fg(casing, '│')) : bg(casing, fg(P.text, '│')));
  // A number on the fill takes the fill colour where it starts as background, so the whole number is one colour.
  const digit = (ch, onFill, at) => (outline ? fg(onFill ? color(at) : c, bold(ch))
    // Off the fill, glossy's glass would pull the background toward the digit colour, so digits sit on the plain casing.
    : onFill ? bg(color(at), fg(inkOn(color(at)), bold(ch))) : bg(P.casing, fg(c, bold(ch))));
  // Rounded caps only when ctx.round and there is a casing to round; always ends in the nub.
  const shell = (body, first, end) => (outline
    ? fg(P.mute, '▕') + body + fg(P.mute, '▏') + fg(P.mute, '▪')
    : (ctx.round ? fg(first, CAP_L) : '') + body + (ctx.round ? fg(end, CAP_R) : '') + fg(glossy ? mix(P.nub, c, 0.35) : P.nub, '■'));
  return { casing, color, cell, tick, digit, shell, ticks: style !== 'pace' };
}

export function battery(ctx, pct, level, w = 8, elapsed) {
  const c = tone(ctx, level), cells = (pct / 100) * w, k = skin(ctx, c, level, cells, w, elapsed), t = k.ticks ? tickAt(elapsed, w) : -1;
  let s = '';
  for (let i = 0; i < w; i++) s += i === t ? k.tick(i) : k.cell(i);
  return k.shell(s, pct > 0 ? k.color(0) : k.casing, pct >= 100 ? k.color(w - 1) : k.casing);
}

export function batteryPct(ctx, pct, level, w = 7, elapsed) {
  const c = tone(ctx, level), text = `${pct}%`, cells = (pct / 100) * w, full = Math.round(cells), n = text.length, mid = Math.floor((w - n) / 2);
  const k = skin(ctx, c, level, cells, w, elapsed);
  // Keep the digits together: centre them unless the fill edge would cut through.
  let t0 = full >= mid + n || full <= mid ? mid : w - full >= n ? full : 0, t = k.ticks ? tickAt(elapsed, w) : -1;
  // The tick never covers a digit: the digits move to the nearest spot clear of it and the fill edge, else the tick goes.
  if (t >= t0 && t < t0 + n) {
    const free = [...Array(w - n + 1).keys()].filter((x) => (x + n <= full || x >= full) && !(t >= x && t < x + n));
    if (free.length) t0 = free.sort((a, b) => Math.abs(a - t0) - Math.abs(b - t0))[0]; else t = -1;
  }
  const onFill = t0 + n <= full;
  let s = '';
  for (let i = 0; i < w; i++) {
    if (i >= t0 && i < t0 + n) s += k.digit(text[i - t0], onFill, t0);
    else s += i === t ? k.tick(i) : k.cell(i);
  }
  return k.shell(s, pct > 0 && (t0 > 0 || onFill) ? k.color(0) : k.casing, pct >= 100 ? k.color(w - 1) : k.casing);
}

export function batterySeg(ctx, pct, level, n = 5) {
  const lit = pct > 0 ? Math.max(1, Math.round(pct / (100 / n))) : 0;
  let s = '';
  for (let i = 0; i < n; i++) s += bg(ctx.P.casing, i < lit ? fg(tone(ctx, level), '▊') : fg(ctx.P.segOff, ctx.mono ? OFF : '▊'));
  return (ctx.round ? fg(ctx.P.casing, CAP_L) : '') + bg(ctx.P.casing, ' ') + s + (ctx.round ? fg(ctx.P.casing, CAP_R) : '') + fg(ctx.P.nub, '■');
}

export function batteryLow(ctx, pct, level, w = 14, elapsed) {
  const lit = Math.round((pct / 100) * w), t = tickAt(elapsed, w);
  let s = '';
  for (let i = 0; i < w; i++) s += i === t ? fg(ctx.P.text, '│') : i < lit ? fg(tone(ctx, level), '▆') : fg(ctx.P.casing, ctx.mono ? OFF : '▆');
  return s + fg(ctx.P.nub, '■');
}
