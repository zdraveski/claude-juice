// The fetched reading: the usage juice asks Anthropic for itself (fable.js writes it in the background).
// The only reader of that file, so its field names and its freshness rules live here and in fable.js alone.
// On the drawing path: no child_process, no crypto.
import { existsSync } from 'node:fs';
import { readJson } from './cache.js';
import { BACKOFF_MS, DENIED_MS } from './readings.js';

// A working login is asked again after this long (fable.js waits the same after an expired one).
export const FRESH_MS = 300000;
// A reading older than this no longer shows: a battery an hour stale would mislead.
const COUNTS_MS = 3600000;

const OFF = Object.freeze({ on: false, reading: null, checkedAt: null, due: false, failed: null });

// auto reads the login only for someone who already has a reading (the file exists, even damaged): 1.3.x turned it on
// without asking, and taking the battery away on update would look broken. Everyone else is asked first by /juice setup.
const enabled = (setting, platform, hasReading) => setting === 'on' || (setting === 'auto' && platform !== 'darwin' && hasReading);

// setting is juice.json's fable value; now is a Date.
// reading: { fable, session, week } as fetched, only while it counts (an hour, never stamped in the future).
// due: time to ask again (over 5 minutes old, and no wait after a failure is running).
// failed: { why, retryAt } while juice waits after a failed check.
export function readFetched(p, setting, platform, now) {
  if (!enabled(setting, platform, existsSync(p.fableFile))) return OFF;
  const raw = readJson(p.fableFile);
  const c = raw && typeof raw === 'object' ? raw : null;
  const t = now.getTime();
  const fetchedAt = Number.isFinite(c?.fetchedAt) ? c.fetchedAt : null;
  // A fetch time in the future (clock skew) is never trusted.
  const age = fetchedAt !== null && fetchedAt <= t ? t - fetchedAt : Infinity;
  // A wait longer than BACKOFF_MS (DENIED_MS after a refusal) can only come from a clock that was ahead, so it is ignored.
  const backedOff = c?.backoffUntil > t && c.backoffUntil - t <= (c.why === 'denied' ? DENIED_MS : BACKOFF_MS);
  return {
    on: true,
    reading: age <= COUNTS_MS ? { fable: { used: c.used, resetsAt: c.resetsAt }, session: c.session, week: c.week } : null,
    checkedAt: fetchedAt !== null && fetchedAt > 0 ? new Date(fetchedAt) : null,
    due: (!c || age > FRESH_MS) && !backedOff,
    failed: backedOff ? { why: c.why, retryAt: new Date(c.backoffUntil) } : null,
  };
}
