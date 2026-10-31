import { vis, cut } from './ansi.js';

// [ctx.fit flag, label shown to the user], least important first.
export const FIT_STEPS = [['badges', 'badges'], ['noRefills', 'reset times'], ['noEffortWord', 'the effort word'], ['noCost', 'cost'],
  ['onlyTrouble', 'batteries that are fine'], ['noModel', 'the model name'], ['noEffort', 'the effort level'], ['tight', 'spacing'],
  ['small', 'battery size'], ['shortWords', 'warning words']];

const widest = (t) => Math.max(...t.split('\n').map(vis));

const without = (flags, flag) => { const rest = { ...flags }; delete rest[flag]; return rest; };

export function fit(layoutFn, data, ctx, columns) {
  const draw = (flags) => layoutFn(data, { ...ctx, fit: flags });
  let flags = {}, text = draw(flags);
  for (const [flag] of FIT_STEPS) {
    if (widest(text) <= columns) break;
    flags = { ...flags, [flag]: true };
    text = draw(flags);
  }
  // A later step can free more room than the earlier ones needed, so give back what still fits, most important first.
  if (widest(text) <= columns) {
    for (const [flag] of [...FIT_STEPS].reverse()) {
      if (!flags[flag]) continue;
      const next = draw(without(flags, flag));
      if (widest(next) <= columns) { flags = without(flags, flag); text = next; }
    }
  }
  const dropped = FIT_STEPS.filter(([flag]) => flags[flag] && draw(without(flags, flag)) !== text).map(([, label]) => label);
  if (widest(text) > columns) {
    text = text.split('\n').map((ln) => (vis(ln) > columns ? cut(ln, columns - 1) + '…' : ln)).join('\n');
    dropped.push('the end of the line');
  }
  return { text, dropped };
}
