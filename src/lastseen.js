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

// Runs on every refresh: never throws, and skips the write unless something changed or the stamp is an hour old.
export function remember(stdin, p, now) {
  try {
    const fiveHour = limit(stdin?.rate_limits?.five_hour);
    const sevenDay = limit(stdin?.rate_limits?.seven_day);
    if (!fiveHour && !sevenDay) return;
    const old = recall(p);
    const same = JSON.stringify([old?.fiveHour, old?.sevenDay]) === JSON.stringify([fiveHour, sevenDay]);
    if (same && now.getTime() - old.subscriberSeenAt < HOUR) return;
    const rec = { subscriberSeenAt: now.getTime() };
    if (fiveHour) rec.fiveHour = fiveHour;
    if (sevenDay) rec.sevenDay = sevenDay;
    writeJsonAtomic(file(p), rec, HOT_WRITE);
  } catch {}
}
