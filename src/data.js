import { strip } from './render/ansi.js';
import { toShow, fetchedCounts, accountOf } from './readings.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Whole percents, but 100 only when really used up: 99.6% rounds to 99, not to a "used up" that would block nothing.
const pct = (v) => { const n = num(v); return n === null ? null : n >= 100 ? 100 : Math.min(99, Math.round(Math.max(0, n))); };
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
  const spend = obj(rl.spend_limit);
  const budget = limit(spend.used_percentage, spend.resets_at, null);
  const account = accountOf({ input, hasLimits: !!(fresh.session || fresh.week), subscriberSeenAt: num(seen.subscriberSeenAt), spendLimit: rl.spend_limit }, now);

  const limits = {};
  const f = obj(fable);
  const live = fetchedCounts(f.fetchedAt, now);
  // Fetched readings only refine a known subscriber, so an API-key user who is also logged in never gets limits.
  const reading = (r, sec) => limit(obj(r).used, obj(r).resetsAt, sec);
  if (account === 'subscriber') {
    const session = toShow({ own: fresh.session, saved: reading(seen.fiveHour, 18000), fetched: live ? reading(f.session, 18000) : undefined }, now);
    const week = toShow({ own: fresh.week, saved: reading(seen.sevenDay, 604800), fetched: live ? reading(f.week, 604800) : undefined }, now);
    if (session) limits.session = session;
    if (week) limits.week = week;
    const fableLimit = live ? limit(f.used, f.resetsAt, 604800) : undefined;
    if (fableLimit) limits.fable = fableLimit;
  }
  if (budget) limits.budget = budget;

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
