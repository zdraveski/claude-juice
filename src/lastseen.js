import { join } from 'node:path';
import { readJson, writeJsonAtomic, HOT_WRITE } from './cache.js';

const HOUR = 3600e3;
const file = (p) => join(p.cacheDir, 'lastseen.json');

export function recall(p) {
  const r = readJson(file(p));
  return r && typeof r === 'object' && !Array.isArray(r) ? r : null;
}

const limit = (w) => Number.isFinite(w?.used_percentage) && Number.isFinite(w?.resets_at)
  ? { used: w.used_percentage, resetsAt: w.resets_at } : undefined;
const valid = (w) => (Number.isFinite(w?.used) && Number.isFinite(w?.resetsAt) ? w : undefined);

// Several sessions write here, and an idle one keeps sending old numbers, so keep the newer reading
// (the same rule as newest() in data.js): a later window wins; within one window usage only grows.
function newer(saved, seen) {
  if (!saved || !seen) return saved || seen;
  if (Math.abs(saved.resetsAt - seen.resetsAt) > 60) return seen.resetsAt > saved.resetsAt ? seen : saved;
  return seen.used > saved.used ? seen : saved;
}

// Runs on every refresh: never throws, and skips the write unless something changed or the stamp is an hour old.
export function remember(stdin, p, now) {
  try {
    const seenFive = limit(stdin?.rate_limits?.five_hour);
    const seenSeven = limit(stdin?.rate_limits?.seven_day);
    if (!seenFive && !seenSeven) return;
    const old = recall(p);
    const fiveHour = newer(valid(old?.fiveHour), seenFive);
    const sevenDay = newer(valid(old?.sevenDay), seenSeven);
    const same = JSON.stringify([old?.fiveHour, old?.sevenDay]) === JSON.stringify([fiveHour, sevenDay]);
    const age = now.getTime() - old?.subscriberSeenAt;
    if (same && age >= 0 && age < HOUR) return; // a stamp from the future (clock was ahead) is rewritten
    const rec = { subscriberSeenAt: now.getTime() };
    if (fiveHour) rec.fiveHour = fiveHour;
    if (sevenDay) rec.sevenDay = sevenDay;
    writeJsonAtomic(file(p), rec, HOT_WRITE);
  } catch {}
}
