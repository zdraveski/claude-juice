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

function head(data, ctx, word = true) {
  const { P, settings, fit } = ctx, show = settings.show;
  const model = show.includes('model') && !fit.noModel && data.model
    ? fg(P.accent, '◆') + ' ' + fg(P.text, data.model.name) : '';
  const effort = show.includes('effort') && !fit.noEffort && data.effort
    ? ramp(ctx, data.effort) + (word && !fit.noEffortWord ? ' ' + fg(P.sub, EFFORT[data.effort][1]) : '') : '';
  return join([model, effort], '  ');
}

const costShown = (data, ctx) => !ctx.fit.noCost && data.costUsd > 0
  && (ctx.settings.cost === 'on' || (ctx.settings.cost === 'auto' && data.account === 'payg'));

// On an API key the cost is real money; on Pro/Max it is only what the chat would have cost.
const cost = (data, ctx) => (!costShown(data, ctx) ? ''
  : data.account === 'payg' ? lbl(ctx, 'spent ') + fg(ctx.P.text, money(data.costUsd)) : lbl(ctx, `${money(data.costUsd)} value`));

function items(data, ctx) {
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
  // A limit that is used up blocks the person, so it shows even in a look that leaves it out
  // (Fable's only while Fable is in use: otherwise it blocks nothing).
  for (const id of ['session', 'week', 'fable', 'budget']) {
    if (settings.show.includes(id) || (id === 'fable' && !data.model?.isFable)) continue;
    const i = make[id]();
    if (i && i.used >= 100) out.push(i);
  }
  if (fit.onlyTrouble && out.length) {
    const bad = out.filter((i) => i.level !== 'ok');
    out = bad.length ? bad : [out.slice().sort((a, b) => b.used - a.used)[0]];
  }
  if (fit.onlyRed && out.some((i) => i.level === 'crit')) out = out.filter((i) => i.level === 'crit');
  // Fable resets with the weekly limit; while Weekly shows that countdown, one is enough. Only while it
  // really shows it: a fine Weekly with reset times off, or squeezed to its run-out time, shows none.
  const weekItem = out.find((i) => i.id === 'week');
  const weekSaysReset = weekItem && wants(ctx, weekItem) && !(fit.shortWords && weekItem.assessed.outAt);
  const week = weekSaysReset ? weekItem.assessed.resetsAt : null;
  for (const i of out) if (i.id === 'fable' && week && i.assessed.resetsAt && Math.abs(i.assessed.resetsAt - week) < 60000) i.sameReset = true;
  return out;
}

// The limit for the model in use stands out.
const name = (ctx, i, long) => (i.hot ? fg(ctx.P.accent, long ? i.long : i.short) : lbl(ctx, long ? i.long : i.short));
// A battery that shares its reset with one on screen still says when it runs out, just not the repeated countdown.
const wants = (ctx, i) => (!i.sameReset || !!i.assessed?.outAt)
  && (i.level !== 'ok' || ((ctx.fit.noRefills ? 'warnings' : ctx.settings.refills) === 'always' && !!i.assessed));
function say(ctx, i) {
  const n = i.assessed
    ? limitNote(i.assessed, ctx.now, { squeezed: !!ctx.fit.shortWords, noReset: !!i.sameReset }) : i.note;
  return n && n.text ? fg(ctx.P[n.tone], n.text) : '';
}
const withSay = (ctx, i, sep) => (wants(ctx, i) && say(ctx, i) ? sep + say(ctx, i) : '');
// Amber and red also get a mark, so the warning never depends on colour alone.
const MARK = { ok: '', warn: '!', crit: '!!' };
const mark = (ctx, i) => (MARK[i.level] ? fg(tone(ctx, i.level), MARK[i.level]) : '');
// Fable is the frontier model: its bar has its own colour while fine, and warns like the rest.
const paint = (i) => (i.id === 'fable' && i.level === 'ok' ? 'fable' : i.level);
const spaced = (ctx, i) => (MARK[i.level] ? (ctx.fit.shortWords ? '' : ' ') + mark(ctx, i) : '');

// The last fit step: the battery as words only, so its number, warning and time survive a narrow window.
const bare = (ctx, i, sep) => name(ctx, i) + ' ' + num(ctx, `${i.used}%`, i.level) + mark(ctx, i) + withSay(ctx, i, sep);

export const LAYOUTS = {
  bar: (data, ctx) => join([badges(data, ctx), head(data, ctx),
    ...items(data, ctx).map((i) => (ctx.fit.bare ? bare(ctx, i, ' ')
      : name(ctx, i) + ' ' + batteryPct(ctx, i.used, paint(i), ctx.fit.small ? 5 : 7, i.assessed?.elapsed) + spaced(ctx, i) + withSay(ctx, i, ' '))),
    cost(data, ctx)], ctx.fit.tight ? '  ' : '    '),

  segments: (data, ctx) => join([badges(data, ctx), head(data, ctx),
    ...items(data, ctx).map((i) => (ctx.fit.bare ? bare(ctx, i, ' ')
      : name(ctx, i) + ' ' + batterySeg(ctx, i.used, paint(i), ctx.fit.small ? 3 : 5) + ' ' + num(ctx, `${i.used}%`, i.level) + mark(ctx, i) + withSay(ctx, i, lbl(ctx, ' · ')))),
    cost(data, ctx)], ctx.fit.tight ? '  ' : '   '),

  focus: (data, ctx) => {
    // The one that needs you most: red before amber before fine, then whichever blocks you first: a limit
    // already used up, then the earliest run-out time (or the reset, for one that lasts until then), then the fullest.
    // Memory never blocks you, it only gets summarised.
    const rank = { crit: 2, warn: 1, ok: 0 };
    const out = (i) => (!i.assessed ? Infinity : i.used >= 100 ? -Infinity : (i.assessed.outAt ?? i.assessed.resetsAt)?.getTime() ?? Infinity);
    const it = items(data, ctx).sort((a, b) => rank[b.level] - rank[a.level] || (a.level === 'crit' ? out(a) - out(b) : 0) || b.used - a.used);
    if (!it.length) return join([badges(data, ctx), head(data, ctx), cost(data, ctx)]);
    // Focus shows the others without countdowns, so the big one keeps its own even when it shares a reset.
    const [shown, ...rest] = it, big = { ...shown, sameReset: false }, bigNote = wants(ctx, big) ? say(ctx, big) : '', t = ctx.fit.tight;
    const picture = ctx.fit.bare ? '' : battery(ctx, big.used, paint(big), ctx.fit.small ? 6 : 12, big.assessed?.elapsed) + ' ';
    return join([badges(data, ctx), head(data, ctx),
      name(ctx, big, true) + ' ' + picture + num(ctx, bold(`${big.used}% used`), big.level) + spaced(ctx, big) + (bigNote ? lbl(ctx, ' · ') + bigNote : ''),
      rest.map((i) => name(ctx, i) + ' ' + num(ctx, `${i.used}%`, i.level) + mark(ctx, i)).join(lbl(ctx, t ? ' · ' : '  ·  ')), cost(data, ctx)],
    lbl(ctx, t ? ' │ ' : '   │   '));
  },

  panel: (data, ctx) => {
    const picture = (i) => (ctx.fit.bare ? '' : batteryLow(ctx, i.used, paint(i), ctx.fit.small ? 8 : 14, i.assessed?.elapsed) + '  ');
    const row = (i) => name(ctx, i, true) + ' '.repeat(Math.max(1, 13 - i.long.length)) + picture(i) + num(ctx, `${i.used}%`.padStart(4), i.level) + lbl(ctx, ' used ') + mark(ctx, i) + ' '.repeat(3 - MARK[i.level].length)
      + (wants(ctx, i) ? say(ctx, i) : i.id === 'memory' ? lbl(ctx, 'in this chat') : '');
    return [join([badges(data, ctx), head(data, ctx), cost(data, ctx)], lbl(ctx, '     ·     ')), ...items(data, ctx).map(row)].filter(Boolean).join('\n');
  },
};
