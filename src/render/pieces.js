import { fg, bg, bold, inkOn } from './ansi.js';
import { tone } from './palette.js';
import { EFFORT } from './words.js';

const EIGHTH = ' ▏▎▍▌▋▊▉', RAMP = '▂▃▅▆█';

export function ramp(ctx, effort) {
  const n = EFFORT[effort][0];
  let s = '';
  for (let i = 0; i < 5; i++) s += fg(i < n ? ctx.P.accent : ctx.P.groove, RAMP[i]);
  return s;
}

// Rounded caps ( / ) only when ctx.round; always ends in the nub.
const shell = (ctx, body, first, last) =>
  (ctx.round ? fg(first, '') : '') + body + (ctx.round ? fg(last, '') : '') + fg(ctx.P.nub, '■');

const cell = (ctx, c, cells, i) => {
  const f = Math.max(0, Math.min(1, cells - i));
  return bg(ctx.P.casing, fg(c, f >= 1 ? '█' : EIGHTH[Math.floor(f * 8)]));
};

export function battery(ctx, pct, level, w = 8) {
  const c = tone(ctx, level), cells = (pct / 100) * w;
  let s = '';
  for (let i = 0; i < w; i++) s += cell(ctx, c, cells, i);
  return shell(ctx, s, pct > 0 ? c : ctx.P.casing, pct >= 100 ? c : ctx.P.casing);
}

export function batteryPct(ctx, pct, level, w = 7) {
  const c = tone(ctx, level), text = `${pct}%`, cells = (pct / 100) * w, full = Math.round(cells), n = text.length, mid = Math.floor((w - n) / 2);
  // Keep the digits together: centre them unless the fill edge would cut through.
  const t0 = full >= mid + n || full <= mid ? mid : w - full >= n ? full : 0, onFill = t0 + n <= full;
  let s = '';
  for (let i = 0; i < w; i++) {
    if (i >= t0 && i < t0 + n) s += onFill ? bg(c, fg(inkOn(c), bold(text[i - t0]))) : bg(ctx.P.casing, fg(c, bold(text[i - t0])));
    else s += cell(ctx, c, cells, i);
  }
  return shell(ctx, s, pct > 0 && (t0 > 0 || onFill) ? c : ctx.P.casing, pct >= 100 ? c : ctx.P.casing);
}

export function batterySeg(ctx, pct, level, n = 5) {
  const lit = pct > 0 ? Math.max(1, Math.round(pct / (100 / n))) : 0;
  let s = '';
  for (let i = 0; i < n; i++) s += bg(ctx.P.casing, fg(i < lit ? tone(ctx, level) : ctx.P.segOff, '▊'));
  return shell(ctx, bg(ctx.P.casing, ' ') + s, ctx.P.casing, ctx.P.casing);
}

export function batteryLow(ctx, pct, level, w = 14) {
  const lit = Math.round((pct / 100) * w);
  let s = '';
  for (let i = 0; i < w; i++) s += fg(i < lit ? tone(ctx, level) : ctx.P.casing, '▆');
  return s + fg(ctx.P.nub, '■');
}
