// Plain-language wording: reset countdowns and warnings.

// Time until t: "31m", "1h 31m" or "2d 5h". Rounded, because resets arrive a few ms either side of the minute.
export function countdown(t, now) {
  const m = Math.max(1, Math.round((t.getTime() - now.getTime()) / 60000));
  const d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24, min = m % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  return h ? (min ? `${h}h ${min}m` : `${h}h`) : `${min}m`;
}

const TONE = { ok: 'mute', warn: 'watch', crit: 'bad' };

// The countdown is always shown and its colour does the warning; words only when there is no reset time.
export function limitNote(a, now, { squeezed = false } = {}) {
  if (a.resetsAt) return { text: `resets ${squeezed ? '' : 'in '}${countdown(a.resetsAt, now)}`, tone: TONE[a.level] };
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
