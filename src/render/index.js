import { makeCtx } from './palette.js';
import { LAYOUTS } from './layouts.js';
import { fit } from './fit.js';
import { to256 } from './ansi.js';

export function render(data, settings, terminal) {
  const ctx = makeCtx(data, settings, terminal);
  const { text, dropped } = fit(LAYOUTS[settings.layout] || LAYOUTS.bar, data, ctx, Number.isFinite(terminal.columns) && terminal.columns > 0 ? terminal.columns : 120);
  return { text: terminal.colorDepth === '256' ? to256(text) : text, dropped };
}
