// Pace rules: is a limit fine, going fast, or about to run out (spec 6.2).
export function assess(limit, now) {
  const used = Math.min(100, Math.max(0, limit.used));
  const out = { ...limit, used };
  const secsLeft = limit.resetsAt ? (limit.resetsAt - now) / 1000 : null;
  if (secsLeft !== null && secsLeft <= 0) {
    return { ...out, used: 0, resetsAt: null, level: 'ok' };
  }
  const win = limit.windowSec;
  let projected = used;
  if (win && secsLeft !== null) {
    const elapsed = win - secsLeft;
    if (elapsed >= win * 0.1) projected = (used / elapsed) * win;
  }
  out.level = used >= 90 || projected >= 100 ? 'crit' : projected >= 85 ? 'warn' : 'ok';
  return out;
}

export const memLevel = (used) => (used >= 85 ? 'crit' : used >= 70 ? 'warn' : 'ok');
