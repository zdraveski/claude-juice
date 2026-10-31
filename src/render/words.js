// Plain-language wording: reset countdowns and warnings.

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
const timeOfDay = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;

// "2:44 PM" today, "Nov 1, 3:20 PM" on another day. A real date, never "tomorrow" or a weekday.
export function clock(t, now) {
  const d = toMinute(t);
  return d.toDateString() === now.toDateString() ? timeOfDay(d) : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${timeOfDay(d)}`;
}

// When a limit resets: under a day, how long ("in 2h 10m"); a day or more, which day and when ("Sat 7:20 PM").
// A reset a whole week away falls on today's weekday, so it says "next Wed" rather than read as today.
// Squeezed into a narrow window it is always the countdown ("3d 5h"): the day and time are longer.
export function resetWhen(t, now, squeezed = false) {
  if (squeezed) return countdown(t, now);
  if (t.getTime() - now.getTime() < 86400000) return `in ${countdown(t, now)}`;
  const d = toMinute(t), day = DAYS[d.getDay()];
  return `${d.getDay() === now.getDay() ? `next ${day}` : day} ${timeOfDay(d)}`;
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
