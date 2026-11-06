import { makeCtx } from './palette.js';
import { LAYOUTS } from './layouts.js';
import { fit } from './fit.js';
import { fg, to256, strip, vis } from './ansi.js';

const WAIT = "batteries appear after Claude's first reply";

// colorDepth 'none' (NO_COLOR, or the plain-text previews of /juice looks) gives text with no escape codes at all.
export function render(data, settings, terminal) {
  const ctx = makeCtx(data, settings, terminal);
  const cols = Number.isFinite(terminal.columns) && terminal.columns > 0 ? terminal.columns : 120;
  let { text, dropped } = fit(LAYOUTS[settings.layout] || LAYOUTS.bar, data, ctx, cols);
  // A new chat has no numbers until Claude's first reply (memory comes with it, for every kind of account),
  // so the line says why it is short instead of looking broken. Only after something shown (empty or bad input
  // stays empty) and only when it fits: it is the least important part.
  const [first, ...rest] = text.split('\n'), add = '    ' + WAIT;
  if (data.memoryUsed === null && !Object.keys(data.limits).length && vis(first) && vis(first) + vis(add) <= cols) {
    text = [first + fg(ctx.P.sub, add), ...rest].join('\n');
  }
  const out = terminal.colorDepth === 'none' ? strip(text) : terminal.colorDepth === '256' ? to256(text) : text;
  return { text: out, dropped };
}
