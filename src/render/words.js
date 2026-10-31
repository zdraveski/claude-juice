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

// "2:44 PM" today, "Nov 1, 3:20 PM" on another day. A real date, never "tomorrow" or a weekday.
export function clock(t, now) {
  const d = new Date(Math.round(t.getTime() / 60000) * 60000), h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return d.toDateString() === now.toDateString() ? time : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`;
}

const TONE = { ok: 'mute', warn: 'watch', crit: 'bad' };

// The countdown is always shown and its colour does the warning; red also says when it runs out at this pace.
// noReset: another battery on screen already counts down to the same reset, so only the run-out time is said.
export function limitNote(a, now, { squeezed = false, noReset = false } = {}) {
  if (a.resetsAt) {
    const left = `resets ${squeezed ? '' : 'in '}${countdown(a.resetsAt, now)}`;
    const out = a.outAt && !squeezed ? `runs out ~${clock(a.outAt, now)}` : '';
    return { text: noReset ? out : out ? `${out} · ${left}` : left, tone: TONE[a.level] };
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
