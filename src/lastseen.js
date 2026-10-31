import { join } from 'node:path';
import { readJson, writeJsonAtomic, HOT_WRITE } from './cache.js';
import { toSave } from './readings.js';

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

// Saves the best Session and Weekly numbers any session has sent; readings.js toSave() decides which. Claude Code
// re-sends a session's last numbers on every redraw, so only a change from what a session it already knows sent
// before is news: that is what the per-session signatures here are for.
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
    // The file keeps reset times in seconds; readings.js takes milliseconds. `saved` is the file's own entry.
    const ms = (w) => w && { used: w.used, resetsAt: w.resetsAt * 1000, saved: w };
    const keep = (kept, seen) => toSave(ms(kept), ms(seen), { known, news }, now)?.saved;
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
