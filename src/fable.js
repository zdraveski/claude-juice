import { execFileSync as realExec } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic, removeOld, holdLock } from './cache.js';
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
// false: the login has expired (given now), so sending it would only earn a refusal.
export function readToken({ platform, p, env, now, execFileSync = realExec }) {
  const file = () => tokenIn(() => readFileSync(join(p.config, '.credentials.json'), 'utf8'), now);
  if (platform !== 'darwin') return file();
  // macOS may first ask in a dialog: 25 s leaves time to answer it, and ends before the 30 s fable lock does,
  // so no second refresher (and second dialog) starts meanwhile. This runs only in the detached refresher.
  // security prints an item holding bytes it can't show as text in hex. With no Keychain login, Claude Code keeps it
  // in the file, as elsewhere.
  return tokenIn(() => {
    const out = execFileSync('security', ['find-generic-password', '-s', keychainService(env), '-w'], { timeout: 25000, encoding: 'utf8' }).trim();
    return /^(?:[0-9a-f]{2})+$/i.test(out) ? Buffer.from(out, 'hex').toString('utf8') : out;
  }, now) ?? file();
}

function tokenIn(read, now) {
  try {
    const { accessToken: t, expiresAt } = JSON.parse(read())?.claudeAiOauth ?? {};
    if (!(typeof t === 'string' && t)) return null;
    return now !== undefined && Number.isFinite(expiresAt) && expiresAt <= +now ? false : t;
  } catch { return null; }
}

// Why a check failed, so the doctor can give the advice that fits (only 'login' needs /login).
const failure = (status) => (status === 401 || status === 403 ? 'login' : status === 429 || status >= 500 ? 'busy' : 'changed');

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
    if (!res.ok) return failure(res.status);
    const body = await res.json();
    const e = Array.isArray(body?.limits) && body.limits.find((l) => l?.kind === 'weekly_scoped' && /fable/i.test(l.scope?.model?.display_name)); // same loose match as data.js, so "Fable 5.1" still counts
    // Stored as the date juice understood, not as sent: the cache is read on every draw, so it must stay small.
    const reading = (used, at) => (Number.isFinite(used) && typeof at === 'string' && at.length <= 40 && !Number.isNaN(Date.parse(at)) ? { used, resetsAt: new Date(at).toISOString() } : null);
    // The same answer carries Session and Weekly, which keep idle and new windows current.
    const fable = e ? reading(e.percent, e.resets_at) : null;
    const session = reading(body?.five_hour?.utilization, body?.five_hour?.resets_at);
    const week = reading(body?.seven_day?.utilization, body?.seven_day?.resets_at);
    if (!fable && !session && !week) return 'changed';
    return { ...fable, ...(session && { session }), ...(week && { week }) };
  } catch { return 'offline'; } finally { clearTimeout(timer); } // no answer, or a page (a proxy's, a hotel's) instead of one
}

// Claude Code renews an expired login on its next request, so look again soon rather than in 15 minutes. Not sooner
// than a working login is asked (5 minutes): an idle window's login stays expired, and each look starts a process.
const EXPIRED_MS = 300000;

export async function refreshFable({ p, platform, env, fetchImpl = globalThis.fetch, execFileSync = realExec, now, version }) {
  const t = +now; // accepts a Date or epoch ms
  const file = p.fableFile;
  try {
    const token = readToken({ platform, p, env, now: t, execFileSync });
    const fresh = token === false ? 'expired' : token ? await fetchFable(token, fetchImpl, version) : 'login';
    if (typeof fresh === 'object') {
      writeJsonAtomic(file, { ...fresh, fetchedAt: t });
      return true;
    }
    const { used, resetsAt, session, week, fetchedAt } = readJson(file) ?? {};
    const keep = fetchedAt === undefined ? {} : { used, resetsAt, session, week, fetchedAt };
    writeJsonAtomic(file, { ...keep, backoffUntil: t + (fresh === 'expired' ? EXPIRED_MS : BACKOFF_MS), why: fresh });
  } catch {
    holdLock(p, 'fable', now, BACKOFF_MS); // the backoff could not be saved, so the lock carries it
  } finally {
    // Runs about every 5 minutes, so stray temp files go even for people without badges (whose refresher sweeps too).
    // An hour old at least: another window may be writing one right now.
    removeOld(p.cacheDir, (f) => f.endsWith('.tmp'), 3600000);
  }
  return false;
}

