import { fg, bold } from './ansi.js';
import { assess, memLevel } from './limits.js';
import { limitNote, memoryNote, LABELS, EFFORT } from './words.js';
import { tone } from './palette.js';
import { ramp, battery, batteryPct, batterySeg, batteryLow } from './pieces.js';

const lbl = (ctx, t) => fg(ctx.P.mute, t);
const num = (ctx, t, level) => fg(level === 'ok' ? ctx.P.text : tone(ctx, level), t);
const join = (parts, gap = '   ') => parts.filter(Boolean).join(gap);
const money = (n) => `$${n.toFixed(2)}`;

const badges = (data, ctx) => (ctx.fit.badges ? '' : data.badges.filter(Boolean).map((b) => fg(ctx.P.sub, b)).join(' '));

export function head(data, ctx, word = true) {
  const { P, settings, fit } = ctx, show = settings.show;
  const model = show.includes('model') && !fit.noModel && data.model
    ? fg(P.accent, '◆') + ' ' + fg(P.text, data.model.name) : '';
  const effort = show.includes('effort') && !fit.noEffort && data.effort
    ? ramp(ctx, data.effort) + (word && !fit.noEffortWord ? ' ' + fg(P.sub, EFFORT[data.effort][1]) : '') : '';
  return join([model, effort], '  ');
}

export const costShown = (data, ctx) => !ctx.fit.noCost && data.costUsd !== null
  && (ctx.settings.cost === 'on' || (ctx.settings.cost === 'auto' && data.account === 'payg'));

// On an API key the cost is real money; on Pro/Max it is only what the chat would have cost.
export const cost = (data, ctx) => (!costShown(data, ctx) ? ''
  : data.account === 'payg' ? lbl(ctx, 'spent ') + fg(ctx.P.text, money(data.costUsd)) : lbl(ctx, `${money(data.costUsd)} value`));

export function items(data, ctx) {
  const { settings, fit } = ctx, squeezed = !!fit.shortWords;
  const make = {
    memory: () => {
      if (data.memoryUsed === null) return null;
      const level = memLevel(data.memoryUsed), text = memoryNote(level, squeezed);
      return { id: 'memory', short: LABELS.memory[0], long: LABELS.memory[1], used: data.memoryUsed, level, note: text ? { text, tone: level === 'crit' ? 'bad' : 'watch' } : null, hot: false };
    },
  };
  for (const id of ['session', 'week', 'fable', 'budget']) {
    make[id] = () => {
      const limit = data.limits[id];
      if (!limit || (id === 'budget' && data.account !== 'gateway')) return null;
      const assessed = assess(limit, data.now);
      return { id, short: (squeezed && LABELS[id][2]) || LABELS[id][0], long: LABELS[id][1], used: assessed.used, level: assessed.level, assessed, hot: id === 'fable' && !!data.model?.isFable };
    };
  }
  let out = settings.show.map((id) => make[id]?.()).filter(Boolean);
  if (fit.onlyTrouble && out.length) {
    const bad = out.filter((i) => i.level !== 'ok');
    out = bad.length ? bad : [out.slice().sort((a, b) => b.used - a.used)[0]];
  }
  // Fable resets with the weekly limit; while Weekly is on screen, one countdown is enough.
  const week = out.find((i) => i.id === 'week')?.assessed.resetsAt;
  for (const i of out) if (i.id === 'fable' && week && i.assessed.resetsAt && Math.abs(i.assessed.resetsAt - week) < 60000) i.sameReset = true;
  return out;
}

// The limit for the model in use stands out.
const name = (ctx, i, long) => (i.hot ? fg(ctx.P.accent, long ? i.long : i.short) : lbl(ctx, long ? i.long : i.short));
const wants = (ctx, i) => !i.sameReset && (i.level !== 'ok' || ((ctx.fit.noRefills ? 'warnings' : ctx.settings.refills) === 'always' && !!i.assessed));
function say(ctx, i) {
  const n = i.assessed
    ? limitNote(i.assessed, ctx.now, { squeezed: !!ctx.fit.shortWords }) : i.note;
  return n && n.text ? fg(ctx.P[n.tone], n.text) : '';
}
const withSay = (ctx, i, sep) => (wants(ctx, i) && say(ctx, i) ? sep + say(ctx, i) : '');
// Amber and red also get a mark, so the warning never depends on colour alone.
const MARK = { ok: '', warn: '!', crit: '!!' };
const mark = (ctx, i) => (MARK[i.level] ? fg(tone(ctx, i.level), MARK[i.level]) : '');
// Fable is the frontier model: its bar has its own colour while fine, and warns like the rest.
const paint = (i) => (i.id === 'fable' && i.level === 'ok' ? 'fable' : i.level);
const spaced = (ctx, i) => (MARK[i.level] ? (ctx.fit.shortWords ? '' : ' ') + mark(ctx, i) : '');

export const LAYOUTS = {
  bar: (data, ctx) => join([badges(data, ctx), head(data, ctx),
    ...items(data, ctx).map((i) => name(ctx, i) + ' ' + batteryPct(ctx, i.used, paint(i), ctx.fit.small ? 5 : 7, i.assessed?.elapsed) + spaced(ctx, i) + withSay(ctx, i, ' ')),
    cost(data, ctx)], ctx.fit.tight ? '  ' : '    '),

  segments: (data, ctx) => join([badges(data, ctx), head(data, ctx),
    ...items(data, ctx).map((i) => name(ctx, i) + ' ' + batterySeg(ctx, i.used, paint(i), ctx.fit.small ? 3 : 5) + ' ' + num(ctx, `${i.used}%`, i.level) + mark(ctx, i) + withSay(ctx, i, lbl(ctx, ' · '))),
    cost(data, ctx)], ctx.fit.tight ? '  ' : '   '),

  focus: (data, ctx) => {
    const rank = { crit: 2, warn: 1, ok: 0 }, it = items(data, ctx).sort((a, b) => rank[b.level] - rank[a.level] || b.used - a.used);
    if (!it.length) return join([badges(data, ctx), head(data, ctx), cost(data, ctx)]);
    const [big, ...rest] = it, bigNote = say(ctx, big), t = ctx.fit.tight;
    return join([badges(data, ctx), head(data, ctx, false),
      name(ctx, big, true) + ' ' + battery(ctx, big.used, paint(big), ctx.fit.small ? 6 : 12, big.assessed?.elapsed) + ' ' + num(ctx, bold(`${big.used}% used`), big.level) + spaced(ctx, big) + (bigNote ? lbl(ctx, ' · ') + bigNote : ''),
      rest.map((i) => name(ctx, i) + ' ' + num(ctx, `${i.used}%`, i.level) + mark(ctx, i)).join(lbl(ctx, t ? ' · ' : '  ·  ')), cost(data, ctx)],
    lbl(ctx, t ? ' │ ' : '   │   '));
  },

  panel: (data, ctx) => {
    const row = (i) => name(ctx, i, true) + ' '.repeat(Math.max(1, 13 - i.long.length)) + batteryLow(ctx, i.used, paint(i), 14, i.assessed?.elapsed) + '  ' + num(ctx, `${i.used}%`.padStart(4), i.level) + lbl(ctx, ' used ') + mark(ctx, i) + ' '.repeat(3 - MARK[i.level].length)
      + (wants(ctx, i) ? say(ctx, i) : i.id === 'memory' ? lbl(ctx, 'in this chat') : '');
    return [join([badges(data, ctx), head(data, ctx), cost(data, ctx)], lbl(ctx, '     ·     ')), ...items(data, ctx).map(row)].filter(Boolean).join('\n');
  },
};
