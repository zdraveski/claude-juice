// Every rule about which Session and Weekly numbers juice saves and shows, and which account it is looking at.
// A number can come from three places:
// - this window: what Claude Code sent with this refresh. It re-sends a window's last numbers on every redraw,
//   so an idle window's numbers can be hours old.
// - saved: the best number any session has sent, kept in lastseen.json (lastseen.js reads and writes it).
// - fetched: Anthropic's usage service (fable.js), counted for up to an hour.
// A reading is { used, resetsAt } with resetsAt a Date, epoch milliseconds, or null when unknown.

const DAY = 86400000;
const TOLERANCE = 60000; // sources disagree on a reset time by a few seconds
const time = (r) => (typeof r.resetsAt === 'number' ? r.resetsAt : r.resetsAt?.getTime() ?? 0);
const sameWindow = (a, b) => Math.abs(time(a) - time(b)) <= TOLERANCE;
const ended = (r, now) => time(r) <= now.getTime();

// What to save after a session sends `seen`. `news`: a session juice knows sent something different from last
// time, so it is really new and wins even when lower (a new plan, another account). Anything else (an idle window
// repeating itself, or a session seen for the first time, which may carry old numbers after /clear or an upgrade)
// only fills a gap, raises the same window, or brings a later window once the saved one has ended. A reading from
// a window that has already ended never replaces anything.
export function toSave(kept, seen, { known, news }, now) {
  if (!seen) return kept;
  if (!kept) return seen;
  if (ended(seen, now)) return kept;
  if (news) return seen;
  if (sameWindow(seen, kept)) return known || seen.used <= kept.used ? kept : seen;
  return time(seen) > time(kept) && ended(kept, now) ? seen : kept;
}

// What to show. The saved number already counts this window's own, so it wins unless this window's is from a
// window more than a minute later (the saved one is then another account's, kept until it ends).
// A fetched number then refines it: within one window usage only grows, so the higher wins. A later window
// replaces ours only once ours has ended; while both are current they disagree, as when the fetch used another
// account's login.
export function toShow({ own, saved, fetched }, now) {
  const ours = !saved ? own : !own ? saved : time(saved) >= time(own) - TOLERANCE ? saved : own;
  if (!ours || !fetched) return ours || fetched;
  if (sameWindow(ours, fetched)) return fetched.used > ours.used ? fetched : ours;
  const [early, late] = time(ours) < time(fetched) ? [ours, fetched] : [fetched, ours];
  return ended(early, now) ? late : ours;
}

// A fetched reading counts for an hour. One stamped in the future (the clock was ahead) never does.
export const fetchedCounts = (fetchedAt, now) => Number.isFinite(fetchedAt) && now.getTime() - fetchedAt >= 0 && now.getTime() - fetchedAt <= 3600000;

// prompt_cache arrived in Claude Code 2.1.251. A missing or odd version counts as new: current versions send it.
export function sendsPromptCache(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(typeof version === 'string' ? version : '');
  if (!m) return true;
  const [a, b, c] = m.slice(1).map(Number);
  return a > 2 || (a === 2 && (b > 1 || (b === 1 && c >= 251)));
}

// 'subscriber' (has Session/Weekly limits), 'gateway' (a spend limit) or 'payg' (an API key).
// Claude Code sends prompt_cache only after this run's first reply, and subscribers have rate_limits by then,
// so a reply without them means the saved readings are another account's. (Cost can't tell: --resume restores it.)
// Versions before 2.1.251 never send prompt_cache, and there a cost can't tell either: a resumed chat has one
// before any reply. So there the saved readings count: a subscriber resuming a chat is far more common than
// someone who switched to an API key, and old batteries are less alarming than a "spent $" they never paid.
export function accountOf({ input, hasLimits, subscriberSeenAt, spendLimit }, now) {
  const replied = sendsPromptCache(input.version) && Object.hasOwn(input, 'prompt_cache');
  const recent = !replied && subscriberSeenAt !== null && now.getTime() - subscriberSeenAt <= 30 * DAY;
  return hasLimits || recent ? 'subscriber' : spendLimit ? 'gateway' : 'payg';
}
