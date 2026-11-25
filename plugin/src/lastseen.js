import { join } from 'node:path';
import { readJson, writeJsonAtomic, HOT_WRITE } from './cache.js';
import { toSave, toMs } from './readings.js';

const HOUR = 3600e3;
const MAX_SESSIONS = 20;
const file = (p) => join(p.cacheDir, 'lastseen.json');
const isObj = (r) => !!r && typeof r === 'object' && !Array.isArray(r);

function read(p) {
  const r = readJson(file(p));
  return isObj(r) ? r : null;
}

// What callers get instead of the file: per battery, the saved reading and each chat's last-sent one, as Claude Code
// sent them (reset times in seconds). Values pass through unchecked: data.js's limit() vets every reading alike.
function answer(rec) {
  if (!rec) return null;
  const sent = Object.values(isObj(rec.sessions) ? rec.sessions : {})
    .map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Array.isArray);
  const side = (saved, i) => ({ saved, sent: sent.map((s) => s[i]) });
  return { subscriberSeenAt: rec.subscriberSeenAt, session: side(rec.fiveHour, 0), week: side(rec.sevenDay, 1) };
}

export const recall = (p) => answer(read(p));

const limit = (w) => Number.isFinite(w?.used_percentage) && Number.isFinite(w?.resets_at)
  ? { used: w.used_percentage, resetsAt: w.resets_at } : undefined;
const valid = (w) => (Number.isFinite(w?.used) && Number.isFinite(w?.resetsAt) ? w : undefined);

// Saves the best Session and Weekly numbers any session has sent; readings.js toSave() decides which. Claude Code
// re-sends a session's last numbers on every redraw, so only a change from what a session it already knows sent
// before is news: that is what the per-session signatures here are for.
// Runs before drawing and returns the answer, so this refresh already uses what it just saw. Never throws.
export const remember = (stdin, p, now) => answer(update(stdin, p, now));

function update(stdin, p, now) {
  const old = read(p);
  try {
    const seenFive = limit(stdin?.rate_limits?.five_hour);
    const seenSeven = limit(stdin?.rate_limits?.seven_day);
    if (!seenFive && !seenSeven) return old;
    const sid = typeof stdin?.session_id === 'string' ? stdin.session_id : '';
    const sig = JSON.stringify([seenFive ?? null, seenSeven ?? null]);
    const sessions = isObj(old?.sessions) ? { ...old.sessions } : {};
    const known = Object.hasOwn(sessions, sid), news = known && sessions[sid] !== sig;
    // The file keeps reset times as sent; readings.js takes milliseconds. `saved` is the file's own entry.
    const ms = (w) => w && { used: w.used, resetsAt: toMs(w.resetsAt), saved: w };
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
