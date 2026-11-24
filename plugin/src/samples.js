// Sample Data for tests and the web preview (numbers from the mockup's STATES).
const NOW = new Date(2026, 9, 28, 14, 20);
const H5 = 5 * 3600, D7 = 7 * 86400;
const lim = (used, secsLeft, windowSec) => ({ used, resetsAt: new Date(NOW.getTime() + secsLeft * 1000), windowSec });
// Fable resets together with the weekly limit, as it does for real accounts.
const sample = (effort, memoryUsed, costUsd, session, week, fableUsed) => ({
  now: NOW, model: { name: 'Opus 5.5', isFable: false }, effort, memoryUsed, costUsd,
  account: 'subscriber', badges: [], limits: { session: lim(...session, H5), week: lim(...week, D7), fable: lim(fableUsed, week[1], D7) },
});

export const SAMPLES = {
  quiet: sample('medium', 18, 0.84, [12, 3 * 3600 + 48 * 60], [35, 3.5 * 86400], 18),
  busy: sample('high', 64, 3.42, [47, 2 * 3600 + 10 * 60], [50, 3 * 86400 + 5 * 3600], 41),
  trouble: sample('max', 91, 11.2, [88, 2 * 3600 + 5 * 60], [95, 86400 + 2 * 3600], 62),
};

export function withAccount(data, plan) {
  const out = { ...data, limits: { ...data.limits } };
  if (plan === 'pro') delete out.limits.fable;
  if (plan === 'payg') { out.account = 'payg'; out.limits = {}; }
  return out;
}
