import { execFileSync as realExec } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './cache.js';

const BACKOFF_MS = 900000;

// The token lives only in this call's return value; callers must not store or log it.
export function readToken({ platform, p, execFileSync = realExec }) {
  try {
    const raw = platform === 'darwin'
      ? execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { timeout: 3000, encoding: 'utf8' })
      : readFileSync(join(p.config, '.credentials.json'), 'utf8');
    const t = JSON.parse(raw)?.claudeAiOauth?.accessToken;
    return typeof t === 'string' && t ? t : null;
  } catch { return null; }
}

export async function fetchFable(token, fetchImpl, version, timeoutMs = 5000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      signal: ac.signal,
      redirect: 'error', // the token must only ever reach this URL
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        Accept: 'application/json',
        'User-Agent': `juice/${version}`,
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const e = Array.isArray(body?.limits) && body.limits.find((l) => l?.kind === 'weekly_scoped' && l.scope?.model?.display_name === 'Fable');
    const reading = (used, at) => (Number.isFinite(used) && !Number.isNaN(Date.parse(at)) ? { used, resetsAt: at } : null);
    // The same answer carries Session and Weekly, which keep idle and new windows current.
    const fable = e ? reading(e.percent, e.resets_at) : null;
    const session = reading(body?.five_hour?.utilization, body?.five_hour?.resets_at);
    const week = reading(body?.seven_day?.utilization, body?.seven_day?.resets_at);
    if (!fable && !session && !week) return null;
    return { ...fable, ...(session && { session }), ...(week && { week }) };
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function refreshFable({ p, platform, fetchImpl = globalThis.fetch, execFileSync = realExec, now, version }) {
  const t = +now; // accepts a Date or epoch ms
  const file = join(p.cacheDir, 'fable.json');
  try {
    const token = readToken({ platform, p, execFileSync });
    const fresh = token && await fetchFable(token, fetchImpl, version);
    if (fresh) {
      writeJsonAtomic(file, { ...fresh, fetchedAt: t });
      return true;
    }
    const { used, resetsAt, session, week, fetchedAt } = readJson(file) ?? {};
    const keep = fetchedAt === undefined ? {} : { used, resetsAt, session, week, fetchedAt };
    writeJsonAtomic(file, { ...keep, backoffUntil: t + BACKOFF_MS });
  } catch {}
  return false;
}

export function fableCacheState(cache, now) {
  // A timestamp in the future (clock skew) is never trusted.
  const age = Number.isFinite(cache?.fetchedAt) && cache.fetchedAt <= now ? now - cache.fetchedAt : Infinity;
  const backedOff = cache?.backoffUntil > now && cache.backoffUntil - now <= BACKOFF_MS;
  return {
    stale: (!cache || age > 300000) && !backedOff,
    usable: !!cache && age <= 3600000,
  };
}
