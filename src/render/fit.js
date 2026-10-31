import { vis, cut, strip } from './ansi.js';

// [ctx.fit flag, label shown to the user], least important first. The batteries are what juice is for,
// so hiding the ones that are fine is the very last step, after every word and space has given way.
export const FIT_STEPS = [['badges', 'badges'], ['noRefills', 'reset times'], ['noEffortWord', 'the effort word'], ['noCost', 'cost'],
  ['noEffort', 'the effort level'], ['noModel', 'the model name'], ['tight', 'spacing'], ['small', 'battery size'],
  ['shortWords', 'warning words'], ['bare', 'battery pictures'], ['onlyTrouble', 'batteries that are fine'],
  ['onlyRed', 'batteries going a bit fast']];
// After hiding the fine batteries, the amber ones go before a red one is lost.

// Claude Code sets COLUMNS to the whole terminal, then indents the status line, so a line that full gets cut.
// shortcut: a fixed few columns; a notice Claude Code shows on the same row can still cut a long line.
export const RESERVE = 4;
// 'bare' draws each battery as words ("Session 88%!! out ~2:44 PM"): every battery as words beats hiding some,
// and a red one keeps its warning and time in any window wide enough for the words. Like every squeeze it is
// undone if hiding the fine batteries freed enough room for the pictures.

// Steps that make things smaller without hiding any of them.
const SQUEEZES = ['tight', 'small', 'shortWords', 'bare'];

const widest = (t) => Math.max(...t.split('\n').map(vis));

// The last resort cuts between items, never through a number or a time. Items are two or more spaces apart, or
// " │ " and " · " in the spotlight layout. The last item keeps as much as is whole: its name, number and mark
// ("Week 95%!!") if they fit, else it goes. Only a single item too long for the window is cut mid-way.
const GAP = / {2,}| [│·] /g;
function wholeItems(ln, columns) {
  const plain = strip(ln);
  const gap = Math.max(0, ...[...plain.matchAll(GAP)].map((m) => m.index).filter((i) => i > 0 && i <= columns - 2));
  if (!gap) return columns - 1;
  const head = /^(?: [│·] | +)\S+ \d+%(?:!!|!)?/.exec(plain.slice(gap))?.[0];
  const end = head && vis(plain.slice(0, gap + head.length)) <= columns - 2 ? gap + head.length : gap;
  return vis(plain.slice(0, end)) + 1; // keeps the space after it, before the '…'
}

const without = (flags, flag) => { const rest = { ...flags }; delete rest[flag]; return rest; };

export function fit(layoutFn, data, ctx, columns) {
  const draw = (flags) => layoutFn(data, { ...ctx, fit: flags });
  let flags = {}, text = draw(flags);
  for (const [flag] of FIT_STEPS) {
    if (widest(text) <= columns) break;
    flags = { ...flags, [flag]: true };
    text = draw(flags);
  }
  // Hiding follows the order strictly and is never undone: nothing less important comes back while something
  // more important is hidden. Squeezing hides nothing, so once a later step has freed room, each squeeze that
  // still fits is undone, most important first.
  if (widest(text) <= columns) {
    for (const [flag] of [...FIT_STEPS].reverse()) {
      if (!flags[flag] || !SQUEEZES.includes(flag)) continue;
      const next = draw(without(flags, flag));
      if (widest(next) <= columns) { flags = without(flags, flag); text = next; }
    }
  }
  const dropped = FIT_STEPS.filter(([flag]) => flags[flag] && draw(without(flags, flag)) !== text).map(([, label]) => label);
  if (widest(text) > columns) {
    text = text.split('\n').map((ln) => (vis(ln) > columns ? cut(ln, wholeItems(ln, columns)) + '…' : ln)).join('\n');
    dropped.push('the end of the line');
  }
  return { text, dropped };
}
