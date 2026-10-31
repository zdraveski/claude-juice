// Plain-language wording: when limits reset, and warnings.

// Time until t: "31m", "1h 31m" or "2d 5h". Rounded, because resets arrive a few ms either side of the minute.
export function countdown(t, now) {
  const m = Math.max(1, Math.round((t.getTime() - now.getTime()) / 60000));
  if (m >= 1440) { // past a day the minutes are dropped, so the hours are rounded, not cut
    const hours = Math.round(m / 60), d = Math.floor(hours / 24), h = hours % 24;
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  const h = Math.floor(m / 60), min = m % 60;
  return h ? (min ? `${h}h ${min}m` : `${h}h`) : `${min}m`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMinute = (t) => new Date(Math.round(t.getTime() / 60000) * 60000);
// A server, container or SSH session often runs on UTC rather than the person's own clock, so say so there:
// zero hours from UTC in both January and July. (Asking for the zone's name costs ~25 ms on every refresh.)
const zone = () => {
  const y = new Date().getFullYear();
  return new Date(y, 0, 1).getTimezoneOffset() === 0 && new Date(y, 6, 1).getTimezoneOffset() === 0 ? ' UTC' : '';
};
const timeOfDay = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}${zone()}`;
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "2:44 PM" today, "Sat 7:20 PM" later this week, "next Wed 2:19 PM" a week from today, "Nov 10, 6:23 PM" further
// (or earlier). Days count on the calendar, not in 24-hour steps, so a daylight-saving night never shifts the day.
export function clock(t, now) {
  const d = toMinute(t), days = Math.round((midnight(d) - midnight(now)) / 86400000);
  if (days === 0) return timeOfDay(d);
  if (days > 0 && days < 7) return `${DAYS[d.getDay()]} ${timeOfDay(d)}`;
  if (days === 7) return `next ${DAYS[d.getDay()]} ${timeOfDay(d)}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${timeOfDay(d)}`;
}

// When a limit resets: under a day, how long ("in 2h 10m"); otherwise when, as clock() says it ("Sat 7:20 PM").
// Squeezed into a narrow window it is always the countdown ("3d 5h"): the day and time are longer.
export function resetWhen(t, now, squeezed = false) {
  if (squeezed || Math.round((t.getTime() - now.getTime()) / 60000) < 1440) return `${squeezed ? '' : 'in '}${countdown(t, now)}`;
  return clock(t, now);
}

const TONE = { ok: 'mute', warn: 'watch', crit: 'bad' };

// The countdown is always shown and its colour does the warning; red also says when it runs out at this pace.
// noReset: another battery on screen already counts down to the same reset, so only the run-out time is said.
export function limitNote(a, now, { squeezed = false, noReset = false } = {}) {
  if (a.resetsAt) {
    const left = `resets ${resetWhen(a.resetsAt, now, squeezed)}`;
    const out = a.outAt ? `${squeezed ? 'out' : 'runs out'} ~${clock(a.outAt, now)}` : '';
    // Squeezed, only one half fits, and when it runs out before the reset that is the half that matters.
    const text = noReset ? out : squeezed ? out || left : out ? `${out} · ${left}` : left;
    return { text, tone: TONE[a.level] };
  }
  if (a.level === 'crit') return { text: squeezed ? 'low' : 'almost empty', tone: 'bad' };
  if (a.level === 'warn') return { text: squeezed ? 'fast' : 'a bit fast', tone: 'watch' };
  return { text: '', tone: 'mute' };
}

// In a tight window the ! mark carries the warning, so the words go.
export function memoryNote(level, squeezed) {
  if (squeezed) return '';
  if (level === 'crit') return 'summary soon';
  if (level === 'warn') return 'filling up';
  return '';
}

// [one-line layouts, panel, optional shorter one for a tight window]
export const LABELS = {
  memory: ['Memory', 'Memory'], session: ['Session', 'Session'], week: ['Weekly', 'Weekly', 'Week'],
  fable: ['Fable', 'Fable weekly'], budget: ['Budget', 'Budget'],
};
export const EFFORT = {
  low: [1, 'low'], medium: [2, 'medium'], high: [3, 'high'], xhigh: [4, 'extra high'], max: [5, 'max'],
};
