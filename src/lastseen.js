import { join } from 'node:path';
import { readJson, writeJsonAtomic, HOT_WRITE } from './cache.js';

const HOUR = 3600e3;
const MAX_SESSIONS = 20;
const file = (p) => join(p.cacheDir, 'lastseen.json');
const isObj = (r) => !!r && typeof r === 'object' && !Array.isArray(r);

export function recall(p) {
  const r = readJson(file(p));
  return isObj(r) ? r : null;
}

const limit = (w) => Number.isFinite(w?.used_percentage) && Number.isFinite(w?.resets_at)
  ? { used: w.used_percentage, resetsAt: w.resets_at } : undefined;
const valid = (w) => (Number.isFinite(w?.used) && Number.isFinite(w?.resetsAt) ? w : undefined);

// Claude Code re-sends a session's last numbers on every redraw, so only a change from what a session it already
// knows sent before is news. News replaces the saved reading even when it is lower (a new plan, another account).
// Anything else (an idle window repeating itself, or a session seen for the first time, which may carry old
// numbers after /clear or an upgrade) only fills a gap, raises the same window, or brings a later window once
// the saved one has ended. A reading from a window that has already ended never replaces anything.
// Runs before drawing and returns the record, so this refresh already uses what it just saw. Never throws.
export function remember(stdin, p, now) {
  const old = recall(p);
  try {
    const seenFive = limit(stdin?.rate_limits?.five_hour);
    const seenSeven = limit(stdin?.rate_limits?.seven_day);
    if (!seenFive && !seenSeven) return old;
    const sid = typeof stdin?.session_id === 'string' ? stdin.session_id : '';
    const sig = JSON.stringify([seenFive ?? null, seenSeven ?? null]);
    const sessions = isObj(old?.sessions) ? { ...old.sessions } : {};
    const known = Object.hasOwn(sessions, sid), news = known && sessions[sid] !== sig;
    const ended = (r) => r.resetsAt * 1000 <= now.getTime();
    const keep = (kept, seen) => {
      if (!seen) return kept;
      if (!kept) return seen;
      if (ended(seen)) return kept;
      if (news) return seen;
      if (Math.abs(seen.resetsAt - kept.resetsAt) <= 60) return known || seen.used <= kept.used ? kept : seen;
      return seen.resetsAt > kept.resetsAt && ended(kept) ? seen : kept;
    };
    const fiveHour = keep(valid(old?.fiveHour), seenFive);
    const sevenDay = keep(valid(old?.sevenDay), seenSeven);
    const age = now.getTime() - old?.subscriberSeenAt;
    const same = JSON.stringify([old?.fiveHour, old?.sevenDay]) === JSON.stringify([fiveHour, sevenDay]);
    // A session seen for the first time is always recorded, even when it changes nothing: else it stays a stranger
    // and its real news never counts. A stamp from the future (clock was ahead) is rewritten too.
    if (known && !news && same && age >= 0 && age < HOUR) return old;

    delete sessions[sid];
    sessions[sid] = sig; // newest last, so the oldest go first
    for (const id of Object.keys(sessions).slice(0, -MAX_SESSIONS)) delete sessions[id];
    const rec = { subscriberSeenAt: now.getTime(), sessions };
    if (fiveHour) rec.fiveHour = fiveHour;
    if (sevenDay) rec.sevenDay = sevenDay;
    try { writeJsonAtomic(file(p), rec, HOT_WRITE); } catch {} // unsaved this time; still right for this refresh
    return rec;
  } catch { return old; }
}
