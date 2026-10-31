import { makeCtx } from './palette.js';
import { LAYOUTS } from './layouts.js';
import { fit } from './fit.js';
import { to256, strip } from './ansi.js';

// colorDepth 'none' (NO_COLOR, or the plain-text previews of /juice looks) gives text with no escape codes at all.
export function render(data, settings, terminal) {
  const ctx = makeCtx(data, settings, terminal);
  const { text, dropped } = fit(LAYOUTS[settings.layout] || LAYOUTS.bar, data, ctx, Number.isFinite(terminal.columns) && terminal.columns > 0 ? terminal.columns : 120);
  const out = terminal.colorDepth === 'none' ? strip(text) : terminal.colorDepth === '256' ? to256(text) : text;
  return { text: out, dropped };
}
