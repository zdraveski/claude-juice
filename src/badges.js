// Badges: user-added shell commands whose first output line is shown before the batteries.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { cut } from './render/ansi.js';
import { readJson, writeJsonAtomic } from './cache.js';
import { loadSettings, saveSettings } from './settings.js';
import { sanitize } from './schema.js';

const TIMEOUT_MS = 2000;
const WIDTH = 40;
const MAX_OUT = 4096;
const KEEP_MS = 7 * 86400000;
// Keep SGR colour codes; drop other CSI, OSC, stray ESC and control characters.
const NOISE = /\x1b\[[0-?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\|$)|\x1b[^[\]]?|[\x00-\x1f\x7f]/g;

export function cleanBadge(raw) {
  const line = String(raw).split(/\r?\n/)[0];
  const clean = line.replace(NOISE, (m) => (/^\x1b\[[0-9;]*m$/.test(m) ? m : ''));
  const out = cut(clean, WIDTH);
  return clean.includes('\x1b') ? out : out.slice(0, -4); // cut's reset is only needed after colour
}

export function badgeKey(stdin) {
  const text = `${stdin?.session_id}\0${stdin?.workspace?.current_dir}`;
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

const file = (p, key) => join(p.cacheDir, 'badges', `${key}.json`);

export function readBadges(p, key, now) {
  const c = readJson(file(p, key));
  if (!c || !Array.isArray(c.texts)) return { texts: [], stale: true };
  return { texts: c.texts, stale: !(now.getTime() - c.at >= 0 && now.getTime() - c.at <= TIMEOUT_MS) };
}

// Kills the shell and anything it started, and frees the pipe so it can't keep us alive.
function killTree(child) {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
    else process.kill(-child.pid, 'SIGKILL');
  } catch { try { child.kill(); } catch {} }
  try { child.stdout.destroy(); } catch {}
}

export function run(command, { input, timeoutMs }) {
  return new Promise((resolve) => {
    let out = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    let child;
    try { child = spawn(command, { shell: true, windowsHide: true, detached: process.platform !== 'win32' }); } catch { return resolve({ ok: false, stdout: '' }); }
    const timer = setTimeout(() => { killTree(child); finish({ ok: false, stdout: '' }); }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => { if (out.length < MAX_OUT) out = (out + d).slice(0, MAX_OUT); });
    child.stdin.on('error', () => {});
    child.on('error', () => finish({ ok: false, stdout: '' }));
    child.on('close', (code) => finish({ ok: code === 0, stdout: out }));
    child.stdin.end(input);
  });
}

export async function refreshBadges({ p, settings, key, stdinText, runImpl = run }) {
  try {
    const prev = readJson(file(p, key))?.texts ?? [];
    const texts = await Promise.all(settings.badges.map(async (b, i) => {
      try {
        const r = await runImpl(b.command, { input: stdinText, timeoutMs: TIMEOUT_MS });
        return r.ok ? cleanBadge(r.stdout) : (prev[i] ?? '');
      } catch { return prev[i] ?? ''; }
    }));
    writeJsonAtomic(file(p, key), { texts, at: Date.now() });
  } catch {}
  sweep(p);
}

// Deletes only badge caches, badge locks and leftover temp files that nobody has touched for a week.
function sweep(p) {
  const old = (dir, ok) => {
    try {
      for (const f of readdirSync(dir)) {
        if (!ok(f)) continue;
        try { if (Date.now() - statSync(join(dir, f)).mtimeMs > KEEP_MS) unlinkSync(join(dir, f)); } catch {}
      }
    } catch {}
  };
  old(join(p.cacheDir, 'badges'), (f) => f.endsWith('.json'));
  old(p.cacheDir, (f) => /^badges-.*\.lock$|\.tmp$/.test(f));
}

export function addBadge(p, command) {
  const { settings } = loadSettings(p);
  const next = sanitize({ ...settings, badges: [...settings.badges, { command }] }, { allowBadges: true }).settings;
  if (next.badges.length !== settings.badges.length + 1) throw new Error('A badge command must be 1 to 500 characters.');
  saveSettings(p, next);
}

export const listBadges = (p) => loadSettings(p).settings.badges.map((b) => b.command);

export function removeBadge(p, n) {
  const { settings } = loadSettings(p);
  if (!Number.isInteger(n) || n < 1 || n > settings.badges.length) return false;
  saveSettings(p, { ...settings, badges: settings.badges.filter((_, i) => i !== n - 1) });
  return true;
}
