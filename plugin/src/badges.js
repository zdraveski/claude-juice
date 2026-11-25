// Badges: user-added shell commands whose first output line is shown before the batteries.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { cut, strip, ESCAPES } from './render/ansi.js';
import { readJson, writeJsonAtomic, removeOld, holdLock } from './cache.js';
import { loadSettings, updateSettings } from './settings.js';
import { sanitize, ENV_NAME, MAX_ENV } from './schema.js';

const TIMEOUT_MS = 2000;
// How long a badge's output counts as current; Claude Code redraws on every tool call, so this caps how often commands run.
const FRESH_MS = 30000;
// How long a failing command's old text stays, and how long an unsaveable cache holds the refresher back: ten missed refreshes.
const GRACE_MS = 10 * FRESH_MS;
const WIDTH = 40;
const MAX_OUT = 4096;
const KEEP_MS = 7 * 86400000;
// What a shell and everyday tools (git, node, cmd, ccusage) need to run; keys and tokens stay out unless a badge names
// them. Certificate paths are in, so HTTPS works on networks that inspect it; proxy URLs can hold a password, so they
// are opt-in. Case-blind: Windows spells them Path, SystemRoot and so on.
const BASIC_ENV = /^(PATH|PATHEXT|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|ALLUSERSPROFILE|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|COMMONPROGRAMFILES|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|OS|COMPUTERNAME|USERDOMAIN|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS|TEMP|TMP|TMPDIR|USER|USERNAME|LOGNAME|SHELL|LANG|LANGUAGE|LC_[A-Z]+|TZ|TERM|COLORTERM|NO_COLOR|COLUMNS|XDG_[A-Z_]+|CLAUDE_CONFIG_DIR|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|NO_PROXY)$/i;
export function badgeEnv(env, extra = [], platform = process.platform) {
  const more = new Set(extra.map((n) => n.toUpperCase()));
  const kept = Object.fromEntries(Object.entries(env).filter(([k]) => BASIC_ENV.test(k) || more.has(k.toUpperCase())));
  // cmd.exe looks in the current folder before PATH, and a badge runs in the project folder: without this, a git.bat
  // planted in a cloned repo would run in place of git.
  return platform === 'win32' ? { ...kept, NoDefaultCurrentDirectoryInExePath: '1' } : kept;
}
export function cleanBadge(raw) {
  const line = String(raw).split(/\r?\n/)[0];
  // Keep SGR colour codes; drop every other escape and control character.
  const clean = line.replace(ESCAPES, (m) => (/^\x1b\[[0-9;]*m$/.test(m) ? m : ''));
  const out = cut(clean, WIDTH);
  return clean.includes('\x1b') ? out : out.slice(0, -4); // cut's reset is only needed after colour
}

export function badgeKey(stdin) {
  const text = `${stdin?.session_id}\0${stdin?.workspace?.current_dir}`;
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const file = (p, key) => join(p.cacheDir, 'badges', `${key}.json`);

// Texts are matched by command, not position, so removing a badge never shows its text in another's place.
const textFor = (c, command) => (Array.isArray(c?.commands) && Array.isArray(c.texts) ? c.texts[c.commands.indexOf(command)] : undefined);

export function readBadges(p, key, now, commands) {
  const c = readJson(file(p, key));
  const age = now.getTime() - c?.at;
  // Cleaned again: the cache is a file anyone could have edited, and the terminal obeys what it is sent.
  return { texts: commands.map((cmd) => { const t = textFor(c, cmd); return typeof t === 'string' ? cleanBadge(t) : ''; }), stale: !(age >= 0 && age <= FRESH_MS) };
}

// child_process is loaded only when a command runs: the status line reads badges far more often than it runs them.
// getBuiltinModule came in Node 22.3 and 20.16; an older Node, which still draws the line, loads it the old way.
const spawn = (...a) => (process.getBuiltinModule?.('node:child_process') ?? createRequire(import.meta.url)('node:child_process')).spawn(...a);

// Kills the shell and anything it started, and frees the pipe so it can't keep us alive.
function killTree(child) {
  try {
    if (process.platform === 'win32') spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
    else process.kill(-child.pid, 'SIGKILL');
  } catch { try { child.kill(); } catch {} }
  try { child.stdout.destroy(); } catch {}
}

export function run(command, { input, timeoutMs, cwd, env }) {
  return new Promise((resolve) => {
    let out = '', done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    let child;
    // stderr is never read, so it is not opened: a helper the command starts could otherwise hold it, and us, open.
    try { child = spawn(command, { shell: true, cwd, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'ignore'] }); } catch { return resolve({ ok: false, stdout: '' }); }
    const timer = setTimeout(() => { killTree(child); finish({ ok: false, stdout: '' }); }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => { if (out.length < MAX_OUT) out = (out + d).slice(0, MAX_OUT); });
    child.stdin.on('error', () => {});
    child.on('error', () => finish({ ok: false, stdout: '' }));
    child.on('close', (code) => finish({ ok: code === 0, stdout: out }));
    // 'close' waits for stdout to end, which never happens while a helper it started still holds it.
    // So once the command itself has exited, take what arrived and stop waiting.
    // A helper it left behind would pile up, one per refresh, so its process group goes too. Windows has no
    // groups, and taskkill /T can't find the children of a process that has already exited.
    child.on('exit', (code) => setTimeout(() => {
      if (process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
      try { child.stdout.destroy(); } catch {}
      finish({ ok: code === 0, stdout: out });
    }, 100));
    child.stdin.end(input);
  });
}

// A badge runs only if this computer approved it: `badges add --yes` signs the command with a secret that never
// leaves this machine's juice-cache. A juice.json copied from elsewhere, or edited by hand, carries no valid
// signature, so its commands never run.
const secretFile = (p) => join(p.cacheDir, 'badge-secret');
const SECRET = /^[0-9a-f]{64}$/;
function readSecret(p) {
  try { const s = readFileSync(secretFile(p), 'utf8').trim(); return SECRET.test(s) ? s : null; } catch { return null; }
}
// An empty or half-written secret (a crash, a full disk) counts as none and is replaced; it is written whole,
// by rename, so another process never reads half of it. If two make one at once, the one left on disk is used.
function secret(p, create) {
  const s = readSecret(p);
  if (s || !create) return s;
  mkdirSync(p.cacheDir, { recursive: true, mode: 0o700 });
  const tmp = `${secretFile(p)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, randomBytes(32).toString('hex'), { mode: 0o600 });
  renameSync(tmp, secretFile(p));
  return readSecret(p);
}
const sign = (key, command) => createHmac('sha256', key).update(command).digest('hex');

// The command, approved on this computer.
export const approve = (p, command) => ({ command, sig: sign(secret(p, true), command) });

export function approved(p, badges) {
  const key = badges.some((b) => b.sig) ? secret(p, false) : null;
  return key ? badges.filter((b) => b.sig === sign(key, b.command)) : [];
}

export async function refreshBadges({ p, settings, key, stdinText, runImpl = run, now = Date.now(), env = process.env }) {
  try {
    const prev = readJson(file(p, key));
    const ok = approved(p, settings.badges), commands = ok.map((b) => b.command);
    // The old text of a failing command is kept only briefly after its last success: an old branch name is not current.
    const okAtFor = (c) => prev?.okAt?.[prev.commands?.indexOf(c)];
    const keep = (c) => (now - okAtFor(c) <= GRACE_MS ? [textFor(prev, c) ?? '', okAtFor(c)] : ['', undefined]);
    // Claude's current folder, which the cache key already uses: a command like git branch must see that repo.
    let cwd;
    try { const d = JSON.parse(stdinText)?.workspace?.current_dir; if (typeof d === 'string' && statSync(d).isDirectory()) cwd = d; } catch {}
    const results = await Promise.all(ok.map(async ({ command, env: extra }) => {
      try {
        const r = await runImpl(command, { input: stdinText, timeoutMs: TIMEOUT_MS, cwd, env: badgeEnv(env, extra) });
        return r.ok ? [cleanBadge(r.stdout), now] : keep(command);
      } catch { return keep(command); }
    }));
    try { writeJsonAtomic(file(p, key), { texts: results.map((r) => r[0]), commands, okAt: results.map((r) => r[1] ?? null), at: now }); } catch {
      holdLock(p, `badges-${key}`, now, GRACE_MS); // not saved, so every draw would run the commands again
    }
  } catch {}
  sweep(p);
}

// Deletes only badge caches, badge locks, their stale-lock markers and leftover temp files nobody has touched for a week.
// takeLock clears a session's old markers only while that session runs, so an ended session's last one is cleared here.
function sweep(p) {
  removeOld(join(p.cacheDir, 'badges'), (f) => /\.json$|\.tmp$/.test(f), KEEP_MS);
  removeOld(p.cacheDir, (f) => /^badges-.*\.(lock|steal)$|\.tmp$/.test(f), KEEP_MS);
}

// env: names of extra environment variables the command may see. They aren't signed: someone who can write juice.json
// can add names, which the approved command then sees, but cannot make a new command run.
// Throws with a message for the person when the names can't be used.
export function checkEnv(env) {
  const bad = env.find((n) => !ENV_NAME.test(n));
  if (bad !== undefined) throw new Error(`${strip(bad)} isn't a variable name: use letters, digits and _.`);
  if (env.length > MAX_ENV) throw new Error(`A badge can see at most ${MAX_ENV} extra variables.`);
}

// The badges as juice.json holds them, and where each one this version can read sits: add and remove edit these, so an
// entry it can't read (a newer juice's, or one gone wrong) and any field it doesn't know stay as they are.
function rawBadges(file) {
  const all = Array.isArray(file.badges) ? file.badges : [];
  return { all, valid: all.flatMap((b, i) => (sanitize({ badges: [b] }, { allowBadges: true }).settings.badges.length ? [i] : [])) };
}

export function addBadge(p, command, env = []) {
  updateSettings(p, ({ file, settings }) => {
    if (typeof command !== 'string' || command.length < 1 || command.length > 500) throw new Error('A badge command must be 1 to 500 characters.');
    checkEnv(env);
    const badge = { ...approve(p, command), ...(env.length ? { env } : {}) };
    // The same command again takes its new variables in place. A copy this computer never approved (from a copied
    // juice.json) is approved where it stands, so it keeps its place.
    const ok = new Set(approved(p, settings.badges)), same = (b) => b.command === command;
    const i = [settings.badges.findIndex((b) => same(b) && ok.has(b)), settings.badges.findIndex(same)].find((n) => n >= 0) ?? -1;
    const { all, valid } = rawBadges(file);
    const badges = [...all];
    if (i < 0) badges.push(badge);
    else { badges[valid[i]] = { ...all[valid[i]], ...badge }; if (!env.length) delete badges[valid[i]].env; }
    return { changes: { badges } };
  });
}

export const listBadges = (p) => loadSettings(p).settings.badges.map((b) => b.command);

// Each badge, whether this computer approved it, and the first approved badge running the same command
// (from 1, 0 if none): 1.4.0 could leave a second copy of one.
export function badgeList(p) {
  const { badges } = loadSettings(p).settings, ok = new Set(approved(p, badges));
  const first = (c) => badges.findIndex((b) => b.command === c && ok.has(b)) + 1;
  return badges.map((b) => ({ command: b.command, env: b.env ?? [], approved: ok.has(b), first: first(b.command) }));
}

// Positions (from 1) of badges this computer has not approved, so the list can say why they don't run.
export function unapprovedBadges(p) {
  const { badges } = loadSettings(p).settings, ok = new Set(approved(p, badges));
  return badges.flatMap((b, i) => (ok.has(b) ? [] : [i + 1]));
}

export function removeBadge(p, n) {
  updateSettings(p, ({ file }) => {
    const { all, valid } = rawBadges(file);
    return { changes: { badges: all.filter((_, i) => i !== valid[n - 1]) } };
  });
  // Only approved badges refresh, and only a refresh runs the sweep: the saved outputs hold the command text (a key
  // typed into it too) and session details, so they go at once, not when the last badge goes. The next refresh makes them anew.
  // Best effort: the badge is already removed, and a file a refresher still holds open on Windows must not fail that.
  try { rmSync(join(p.cacheDir, 'badges'), { recursive: true, force: true }); } catch {}
}
