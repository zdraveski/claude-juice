import { vis, cut } from './ansi.js';

// [ctx.fit flag, label shown to the user], least important first.
export const FIT_STEPS = [['badges', 'badges'], ['noRefills', 'reset times'], ['noEffortWord', 'the effort word'], ['noCost', 'cost'],
  ['onlyTrouble', 'batteries that are fine'], ['noModel', 'the model name'], ['noEffort', 'the effort level'], ['tight', 'spacing'],
  ['small', 'battery size'], ['shortWords', 'warning words']];

const widest = (t) => Math.max(...t.split('\n').map(vis));

export function fit(layoutFn, data, ctx, columns) {
  let flags = {}, text = layoutFn(data, { ...ctx, fit: flags });
  const dropped = [];
  for (const [flag, label] of FIT_STEPS) {
    if (widest(text) <= columns) break;
    flags = { ...flags, [flag]: true };
    const next = layoutFn(data, { ...ctx, fit: flags });
    if (next !== text) dropped.push(label);
    text = next;
  }
  if (widest(text) > columns) {
    text = text.split('\n').map((ln) => (vis(ln) > columns ? cut(ln, columns - 1) + '…' : ln)).join('\n');
    dropped.push('the end of the line');
  }
  return { text, dropped };
}
