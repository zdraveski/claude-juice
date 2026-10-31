import { execFileSync as realExec } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic, removeOld } from './cache.js';
import { BACKOFF_MS } from './readings.js';

// Claude Code's own name for the Keychain entry: with CLAUDE_CONFIG_DIR (or its storage override) set, each
// config folder has its own login, named after a hash of the folder. The plain name would be another account's.
export function keychainService(env = {}) {
  const store = env.CLAUDE_SECURESTORAGE_CONFIG_DIR;
  if (store !== undefined ? !store : !env.CLAUDE_CONFIG_DIR) return 'Claude Code-credentials';
  const dir = (store !== undefined ? store : env.CLAUDE_CONFIG_DIR).normalize('NFC');
  return `Claude Code-credentials-${createHash('sha256').update(dir).digest('hex').slice(0, 8)}`;
}

// The token lives only in this call's return value; callers must not store or log it.
export function readToken({ platform, p, env, execFileSync = realExec }) {
  try {
    const raw = platform === 'darwin'
      ? execFileSync('security', ['find-generic-password', '-s', keychainService(env), '-w'], { timeout: 3000, encoding: 'utf8' })
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
    const e = Array.isArray(body?.limits) && body.limits.find((l) => l?.kind === 'weekly_scoped' && /fable/i.test(l.scope?.model?.display_name)); // same loose match as data.js, so "Fable 5.1" still counts
    const reading = (used, at) => (Number.isFinite(used) && !Number.isNaN(Date.parse(at)) ? { used, resetsAt: at } : null);
    // The same answer carries Session and Weekly, which keep idle and new windows current.
    const fable = e ? reading(e.percent, e.resets_at) : null;
    const session = reading(body?.five_hour?.utilization, body?.five_hour?.resets_at);
    const week = reading(body?.seven_day?.utilization, body?.seven_day?.resets_at);
    if (!fable && !session && !week) return null;
    return { ...fable, ...(session && { session }), ...(week && { week }) };
  } catch { return null; } finally { clearTimeout(timer); }
}

export async function refreshFable({ p, platform, env, fetchImpl = globalThis.fetch, execFileSync = realExec, now, version }) {
  const t = +now; // accepts a Date or epoch ms
  const file = p.fableFile;
  try {
    const token = readToken({ platform, p, env, execFileSync });
    const fresh = token && await fetchFable(token, fetchImpl, version);
    if (fresh) {
      writeJsonAtomic(file, { ...fresh, fetchedAt: t });
      return true;
    }
    const { used, resetsAt, session, week, fetchedAt } = readJson(file) ?? {};
    const keep = fetchedAt === undefined ? {} : { used, resetsAt, session, week, fetchedAt };
    writeJsonAtomic(file, { ...keep, backoffUntil: t + BACKOFF_MS });
  } catch {} finally {
    // Runs about every 5 minutes, so stray temp files go even for people without badges (whose refresher sweeps too).
    // An hour old at least: another window may be writing one right now.
    removeOld(p.cacheDir, (f) => f.endsWith('.tmp'), 3600000);
  }
  return false;
}

