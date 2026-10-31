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

const ms = (r) => r.resetsAt?.getTime() ?? 0;

// prompt_cache arrived in Claude Code 2.1.251. A missing or odd version counts as new: current versions send it.
export function sendsPromptCache(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(typeof version === 'string' ? version : '');
  if (!m) return true;
  const [a, b, c] = m.slice(1).map(Number);
  return a > 2 || (a === 2 && (b > 1 || (b === 1 && c >= 251)));
}

// juice's saved reading holds the newest real reading across sessions (lastseen.js), so it beats this
// window's own numbers, which may be an idle window's old ones, unless it is from an older window.
const saved = (own, kept) => (!kept ? own : !own ? kept : ms(kept) >= ms(own) - 60000 ? kept : own);

// A reading from Anthropic's usage service (up to an hour old) refines ours: within one window usage only grows.
// A later window replaces ours only once ours has ended; while both are current they disagree, as when the
// fetch used another account's login.
function refine(ours, api, now) {
  if (!ours || !api) return ours || api;
  if (Math.abs(ms(ours) - ms(api)) <= 60000) return api.used > ours.used ? api : ours;
  const [early, late] = ms(ours) < ms(api) ? [ours, api] : [api, ours];
  return ms(early) <= now.getTime() ? late : ours;
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
  // Claude Code sends prompt_cache only after this run's first reply, and subscribers have rate_limits by then,
  // so a reply without them means the saved readings are another account's. (Cost can't tell: --resume restores it.)
  // Versions before 2.1.251 never send prompt_cache, so there a cost is the only sign of a reply.
  const replied = sendsPromptCache(input.version) ? Object.hasOwn(input, 'prompt_cache') : num(obj(input.cost).total_cost_usd) > 0;
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
    const session = refine(saved(fresh.session, limit(obj(seen.fiveHour).used, obj(seen.fiveHour).resetsAt, 18000)), fromApi(f.session, 18000), now);
    const week = refine(saved(fresh.week, limit(obj(seen.sevenDay).used, obj(seen.sevenDay).resetsAt, 604800)), fromApi(f.week, 604800), now);
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
