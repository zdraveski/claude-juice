// Pace rules: is a limit fine, going fast, or about to run out (spec 6.2).
export function assess(limit, now) {
  const used = Math.min(100, Math.max(0, limit.used));
  const out = { ...limit, used };
  const secsLeft = limit.resetsAt ? (limit.resetsAt - now) / 1000 : null;
  if (secsLeft !== null && secsLeft <= 0) {
    return { ...out, used: 0, resetsAt: null, level: 'ok' };
  }
  const win = limit.windowSec;
  let projected = used, elapsed = 0;
  if (win && secsLeft !== null) {
    elapsed = win - secsLeft;
    out.elapsed = Math.min(1, Math.max(0, elapsed / win)); // where an even pace would have the fill by now
    if (elapsed >= win * 0.1) projected = (used / elapsed) * win;
  }
  // Early pace is noisy (one busy day projects past 100%), so pace alone only reaches red once half is gone.
  out.level = used >= 90 || (used >= 50 && projected >= 100) ? 'crit' : projected >= 85 ? 'warn' : 'ok';
  // Red is the one level that says when it runs out; it is before the reset whenever projected >= 100.
  if (out.level === 'crit' && projected >= 100 && used < 100) out.outAt = new Date(now.getTime() + ((100 - used) / used) * elapsed * 1000);
  return out;
}

export const memLevel = (used) => (used >= 85 ? 'crit' : used >= 70 ? 'warn' : 'ok');
