// The fetched reading: the usage juice asks Anthropic for itself (fable.js writes it in the background).
// The only reader of that file, so its field names and its freshness rules live here and in fable.js alone.
// On the drawing path: no child_process, no crypto.
import { existsSync } from 'node:fs';
import { readJson } from './cache.js';

// A working login is asked again after this long.
export const FRESH_MS = 300000;
// A reading older than this no longer shows: a battery an hour stale would mislead.
const COUNTS_MS = 3600000;

// How long juice waits after each way a check can fail (fable.js says which). The doctor has advice for each.
// expired: Claude Code renews the login on its next request, so look again soon, but no sooner than a working login
//   is asked: an idle window's login stays expired, and each look starts a process.
// denied: macOS refused the Keychain read; asking again would show its dialog again.
export const WAIT_MS = Object.freeze({ expired: FRESH_MS, denied: 12 * 3600000, login: 900000, busy: 900000, changed: 900000, offline: 900000 });
// A reason this juice doesn't know (a file from another version) waits like a failed fetch.
export const waitAfter = (why) => (Object.hasOwn(WAIT_MS, why) ? WAIT_MS[why] : WAIT_MS.offline);

// The Fable refresher a draw starts: the lock that stops a second one starting, how long that lock holds, and the
// juice.js command it runs. The refresher may wait on a macOS Keychain dialog, then fetch: the lock outlasts both.
export const KEYCHAIN_TIMEOUT_MS = 25000, FETCH_TIMEOUT_MS = 5000;
export const FABLE_REFRESH = Object.freeze({ lock: 'fable', holdMs: 60000, command: 'refresh-fable' });

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
  // A wait longer than its reason's can only come from a clock that was ahead, so it is ignored.
  const backedOff = c?.backoffUntil > t && c.backoffUntil - t <= waitAfter(c.why);
  return {
    on: true,
    reading: age <= COUNTS_MS ? { fable: { used: c.used, resetsAt: c.resetsAt }, session: c.session, week: c.week } : null,
    checkedAt: fetchedAt !== null && fetchedAt > 0 ? new Date(fetchedAt) : null,
    due: (!c || age > FRESH_MS) && !backedOff,
    failed: backedOff ? { why: c.why, retryAt: new Date(c.backoffUntil) } : null,
  };
}
