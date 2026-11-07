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
  // No colour: lit and unlit must differ by shape, which only the classic cells do.
  const { P, dark } = ctx, style = ctx.mono ? 'classic' : ctx.style, glossy = style === 'glossy', outline = style === 'outline';
  const casing = outline ? null : glossy ? mix(P.casing, c, dark ? 0.16 : 0.22) : P.casing;
  const last = Math.ceil(cells - 1 / 8) - 1; // the last cell showing any fill
  // Soft up to the even-pace point; a window that has run out puts that point at the end.
  const soft = style !== 'pace' ? 0 : elapsed >= 1 ? w : Math.max(0, tickAt(elapsed, w));
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

// The forms: a shape instead of a battery, each at [normal, squeezed] width. u is used 0..1, e the even-pace
// point 0..1 (or undefined). Used and left differ by shape, so a form reads without colour too.
// The unused part is in the label grey: a thin · or ♡ in the groove colour all but vanishes.
// [0] is an empty cell: one dot halfway up (blank braille would hide the gauge). Any use shows at least
// two grains (⣀), so without colour 1% is a line on the floor, not one dot moved down from 0%.
const SAND = '⠂⡀⣀⣄⣤⣦⣶⣷⣿';
// x of w steps, rounded, but only 0 looks empty and only 1 looks full (99% must not pass for blocked).
const at = (x, w) => (x > 0 && x < 1 ? Math.min(w - 1, Math.max(1, Math.round(x * w))) : Math.round(x * w));
const run = (ctx, c, n, w, on, off) => fg(c, on.repeat(n)) + fg(ctx.P.mute, off.repeat(w - n));
// The even-pace mark goes on the same scale as the fill (at), so on pace it lands right where the fill ends.
// gap: used minus even use, in whole points. Within a point you are on pace: the mark goes where yours is (k).
// Further apart but in the same cell: step the mark one cell so ahead or behind shows.
// The tiny add keeps a half point rounding up: 0.145 * 100 is 14.4999… in floating point.
const pt = (x) => Math.round(x * 100 + 1e-9);
const gapOf = (u, e) => pt(u) - pt(e);
const nudge = (t, k, gap) => (Math.abs(gap) <= 1 ? k : t === k ? t + (gap > 0 ? -1 : 1) : t);
const FORMS = {
  pie: [[1, 1], (ctx, c, u) => fg(c, '○◔◑◕●'[at(u, 4)])],
  sand: [[5, 3], (ctx, c, u, w) => {
    const n = Math.max(u > 0 ? 2 : 0, at(u, w * 8));
    return [...Array(w).keys()].map((i) => { const g = Math.max(0, Math.min(8, n - i * 8)); return fg(g ? c : ctx.P.mute, SAND[g]); }).join('');
  }],
  slider: [[8, 5], (ctx, c, u, w) => { const k = at(u, w - 1); return fg(c, '━'.repeat(k) + '●') + fg(ctx.P.mute, '─'.repeat(w - 1 - k)); }],
  // You (●) racing the even pace (│): ahead of the line is going fast. On the line, you cover it.
  race: [[9, 6], (ctx, c, u, w, e) => {
    const k = at(u, w - 1), t = e > 0 && e < 1 ? nudge(at(e, w - 1), k, gapOf(u, e)) : -1;
    return [...Array(w).keys()].map((i) => (i === k ? fg(c, '●') : i === t ? fg(ctx.P.text, '│') : fg(ctx.P.mute, '·'))).join('');
  }],
  // Counts what is left, like the tank: any left at all keeps a heart, any used loses one.
  lives: [[5, 3], (ctx, c, u, w) => run(ctx, c, at(1 - u, w), w, '♥', '♡')],
  dots: [[8, 5], (ctx, c, u, w) => run(ctx, c, at(u, w), w, '•', '·')],
  chevrons: [[6, 4], (ctx, c, u, w) => run(ctx, c, at(u, w), w, '▸', '▹')],
  ruler: [[8, 5], (ctx, c, u, w, e) => {
    // The tick marks the last cell even use would fill: on the fill's end when on pace, inside it when ahead,
    // past it when behind. It is ╋ on a lit cell and ┿ on an unlit one, so the fill always shows in full.
    // On pace with nothing lit there is no fill end to mark, so no tick (┿ there would say behind).
    const k = at(u, w), n = e > 0 && e < 1 ? nudge(at(e, w) - 1, k - 1, gapOf(u, e)) : null;
    const t = n === null || (k === 0 && n < 0) ? -1 : Math.max(0, n);
    let s = '';
    for (let i = 0; i < w; i++) s += i === t ? fg(ctx.P.text, i < k ? '╋' : '┿') : i < k ? fg(c, '━') : fg(ctx.P.mute, '─');
    return fg(ctx.P.sub, '┣') + s + fg(ctx.P.sub, '┫');
  }],
};
export const isForm = (ctx) => Object.hasOwn(FORMS, ctx.style);
export function form(ctx, pct, level, small, elapsed) {
  const [widths, draw] = FORMS[ctx.style];
  return draw(ctx, tone(ctx, level), Math.max(0, Math.min(100, pct)) / 100, widths[small ? 1 : 0], elapsed);
}
