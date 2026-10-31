import { fg, bg, bold, inkOn } from './ansi.js';
import { tone } from './palette.js';
import { EFFORT } from './words.js';

const EIGHTH = ' ▏▎▍▌▋▊▉', RAMP = '▂▃▅▆█';
// Without colour (NO_COLOR, plain-text previews) lit and unlit cells must differ by shape.
const OFF = '░';

// Steps above the level are drawn flat, so the staircase climbs by shape, not by colour alone.
export function ramp(ctx, effort) {
  const n = EFFORT[effort][0];
  let s = '';
  for (let i = 0; i < 5; i++) s += i < n ? fg(ctx.P.accent, RAMP[i]) : fg(ctx.P.groove, '▁');
  return s;
}

// Rounded caps ( / ) only when ctx.round; always ends in the nub.
const shell = (ctx, body, first, last) =>
  (ctx.round ? fg(first, '') : '') + body + (ctx.round ? fg(last, '') : '') + fg(ctx.P.nub, '■');

const cell = (ctx, c, cells, i) => {
  const f = Math.max(0, Math.min(1, cells - i));
  return bg(ctx.P.casing, fg(c, f >= 1 ? '█' : EIGHTH[Math.floor(f * 8)]));
};

// The even-pace tick: the cell where the fill would be now if the limit were used evenly (elapsed is 0..1).
// Fill past the tick means going fast, which reads without colour.
const tickAt = (elapsed, w) => (elapsed > 0 && elapsed < 1 ? Math.floor(elapsed * w) : -1);
const tick = (ctx, c, cells, i) => (cells - i >= 0.5 ? bg(c, fg(ctx.P.casing, '│')) : bg(ctx.P.casing, fg(ctx.P.text, '│')));

export function battery(ctx, pct, level, w = 8, elapsed) {
  const c = tone(ctx, level), cells = (pct / 100) * w, t = tickAt(elapsed, w);
  let s = '';
  for (let i = 0; i < w; i++) s += i === t ? tick(ctx, c, cells, i) : cell(ctx, c, cells, i);
  return shell(ctx, s, pct > 0 ? c : ctx.P.casing, pct >= 100 ? c : ctx.P.casing);
}

export function batteryPct(ctx, pct, level, w = 7, elapsed) {
  const c = tone(ctx, level), text = `${pct}%`, cells = (pct / 100) * w, full = Math.round(cells), n = text.length, mid = Math.floor((w - n) / 2);
  // Keep the digits together: centre them unless the fill edge would cut through.
  let t0 = full >= mid + n || full <= mid ? mid : w - full >= n ? full : 0, t = tickAt(elapsed, w);
  // The tick never covers a digit: the digits move to the nearest spot clear of it and the fill edge, else the tick goes.
  if (t >= t0 && t < t0 + n) {
    const free = [...Array(w - n + 1).keys()].filter((k) => (k + n <= full || k >= full) && !(t >= k && t < k + n));
    if (free.length) t0 = free.sort((a, b) => Math.abs(a - t0) - Math.abs(b - t0))[0]; else t = -1;
  }
  const onFill = t0 + n <= full;
  let s = '';
  for (let i = 0; i < w; i++) {
    if (i >= t0 && i < t0 + n) s += onFill ? bg(c, fg(inkOn(c), bold(text[i - t0]))) : bg(ctx.P.casing, fg(c, bold(text[i - t0])));
    else s += i === t ? tick(ctx, c, cells, i) : cell(ctx, c, cells, i);
  }
  return shell(ctx, s, pct > 0 && (t0 > 0 || onFill) ? c : ctx.P.casing, pct >= 100 ? c : ctx.P.casing);
}

export function batterySeg(ctx, pct, level, n = 5) {
  const lit = pct > 0 ? Math.max(1, Math.round(pct / (100 / n))) : 0;
  let s = '';
  for (let i = 0; i < n; i++) s += bg(ctx.P.casing, i < lit ? fg(tone(ctx, level), '▊') : fg(ctx.P.segOff, ctx.mono ? OFF : '▊'));
  return shell(ctx, bg(ctx.P.casing, ' ') + s, ctx.P.casing, ctx.P.casing);
}

export function batteryLow(ctx, pct, level, w = 14, elapsed) {
  const lit = Math.round((pct / 100) * w), t = tickAt(elapsed, w);
  let s = '';
  for (let i = 0; i < w; i++) s += i === t ? fg(ctx.P.text, '│') : i < lit ? fg(tone(ctx, level), '▆') : fg(ctx.P.casing, ctx.mono ? OFF : '▆');
  return s + fg(ctx.P.nub, '■');
}
