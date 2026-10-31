import { strip } from './render/ansi.js';

const DAY = 86400000;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pct = (v) => { const n = num(v); return n === null ? null : Math.round(Math.min(100, Math.max(0, n))); };
const obj = (v) => (v && typeof v === 'object' ? v : {});
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// resetsAt in epoch seconds, or an ISO string for the Fable extra.
function limit(used, resetsAt, windowSec) {
  used = pct(used);
  if (used === null) return undefined;
  const t = typeof resetsAt === 'string' ? Date.parse(resetsAt) : num(resetsAt) === null ? NaN : resetsAt * 1000;
  const d = new Date(t); // out-of-range values (1e20) give an Invalid Date
  return { used, resetsAt: Number.isNaN(d.getTime()) ? null : d, windowSec };
}

// Two readings of one limit: a later window wins; within a window usage only grows, so the higher one is newer.
function newest(a, b) {
  if (!a || !b) return a || b;
  const ta = a.resetsAt?.getTime() ?? 0, tb = b.resetsAt?.getTime() ?? 0;
  if (Math.abs(ta - tb) > 60000) return ta > tb ? a : b;
  return b.used > a.used ? b : a;
}

export function normalize(stdin, extras, now) {
  const input = obj(stdin);
  const { lastSeen, fable, badges } = obj(extras);
  const rl = obj(input.rate_limits);
  const seen = obj(lastSeen);
  const m = obj(input.model);
  const cw = obj(input.context_window);

  const fresh = {
    session: limit(obj(rl.five_hour).used_percentage, obj(rl.five_hour).resets_at, 18000),
    week: limit(obj(rl.seven_day).used_percentage, obj(rl.seven_day).resets_at, 604800),
  };
  const seenAt = num(seen.subscriberSeenAt);
  // Subscribers get rate_limits from the first reply on, so once a reply has cost something without them, the memory is from another account.
  const replied = num(obj(input.cost).total_cost_usd) > 0;
  const recent = !replied && seenAt !== null && now.getTime() - seenAt <= 30 * DAY;
  const spend = obj(rl.spend_limit);
  const budget = limit(spend.used_percentage, spend.resets_at, null);

  const account = fresh.session || fresh.week || recent ? 'subscriber' : rl.spend_limit ? 'gateway' : 'payg';
  const limits = {};
  const f = obj(fable);
  const live = num(f.fetchedAt) !== null && now.getTime() - f.fetchedAt >= 0 && now.getTime() - f.fetchedAt <= 3600000;
  // Live readings only refine a known subscriber, so an API-key user who is also logged in never gets limits.
  const fromApi = (r, sec) => (live ? limit(obj(r).used, obj(r).resetsAt, sec) : undefined);
  if (account === 'subscriber') {
    const session = newest(fresh.session || limit(obj(seen.fiveHour).used, obj(seen.fiveHour).resetsAt, 18000), fromApi(f.session, 18000));
    const week = newest(fresh.week || limit(obj(seen.sevenDay).used, obj(seen.sevenDay).resetsAt, 604800), fromApi(f.week, 604800));
    if (session) limits.session = session;
    if (week) limits.week = week;
  }
  if (budget) limits.budget = budget;
  if (live) {
    const l = limit(f.used, f.resetsAt, 604800);
    if (l) limits.fable = l;
  }

  let memoryUsed = pct(cw.used_percentage);
  const u = obj(cw.current_usage), size = num(cw.context_window_size);
  if (memoryUsed === null && size > 0) {
    const parts = [u.input_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens].map(num);
    if (parts.every((p) => p !== null)) memoryUsed = pct((parts[0] + parts[1] + parts[2]) / size * 100);
  }

  const name = typeof m.display_name === 'string' ? strip(m.display_name.replace(/[\r\n\t]+/g, ' ')).trim() : '';
  const level = obj(input.effort).level;
  return {
    now,
    model: name ? { name, isFable: /fable/i.test(typeof m.id === 'string' ? m.id : name) } : null,
    effort: EFFORTS.includes(level) ? level : null,
    memoryUsed,
    costUsd: num(obj(input.cost).total_cost_usd),
    account,
    limits,
    badges: Array.isArray(badges) ? badges.filter((b) => typeof b === 'string') : [],
  };
}
