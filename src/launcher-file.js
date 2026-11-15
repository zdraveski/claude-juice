// The launcher file setup writes into the Claude folder (juice-statusline.mjs): what it should say, and keeping it
// current. Small on purpose: every refresh loads it.
import { readFileSync, statSync, utimesSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeAtomic, HOT_WRITE } from './cache.js';

const TEMPLATE = fileURLToPath(new URL('../bin/launcher.js', import.meta.url));
export const fwd = (s) => s.replaceAll(String.fromCharCode(92), '/');

// A launcher records which juice it runs: a pinned folder (a checkout) or the plugin store it came from.
export const constant = (text, name) => {
  const m = new RegExp(`const ${name} = ("(?:[^"\\\\]|\\\\.)*");`).exec(text);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};
// What a launcher runs ("pinned:<folder>" or "market:<name>"), or null for a damaged one or one from before 0.2.1,
// which had neither and would run any plugin named juice, even after juice was turned off.
export const launcherTarget = (text) => {
  const pinned = constant(text, 'PINNED'), market = constant(text, 'MARKET');
  return pinned ? `pinned:${pinned}` : market ? `market:${market}` : null;
};

// The marketplace of a plugin-store copy (<market>/juice/<version>), or null for a checkout. Read from the path's own
// segments, because a symlinked or junctioned plugins folder shows the real place, with no /plugins/cache/ in it.
export const marketOf = (root) => /\/plugins\/cache\/([^/]+)\//.exec(root)?.[1] ?? /([^/]+)\/juice\/(?:\d+\.\d+[^/]*|[0-9a-f]{12})$/.exec(root)?.[1] ?? null;

// The launcher for this copy of juice: installed from Claude Code's plugin store, it follows updates there;
// anywhere else (a checkout), it pins that folder.
export function launcherFor(pluginRoot) {
  const template = readFileSync(TEMPLATE, 'utf8');
  const pin = 'const PINNED = null;', market = 'const MARKET = null;';
  if (!template.includes(pin) || !template.includes(market)) throw new Error("juice's launcher template is damaged. Reinstall the plugin.");
  const root = fwd(pluginRoot).replace(/\/+$/, ''); // one spelling, so the same folder always gives the same launcher
  // A replacer function stops $' and $& in the path being expanded.
  const name = marketOf(root);
  return name
    ? template.replace(market, () => `const MARKET = ${JSON.stringify(name)};`)
    : template.replace(pin, () => `const PINNED = ${JSON.stringify(root)};`);
}

// The launcher stays as setup wrote it until setup runs again, so a fix to it (or the pre-0.2.1 kind, which ran any
// plugin named juice) would never reach people. Once after each install or update of juice (the launcher is older
// than the running juice's template), a refresh compares it with what this juice would write and replaces it if
// they differ, else marks it checked. A missing one (restore removed it) is left alone. Never throws.
// True when this refresh was that once-per-update check, so the caller can do its own once-per-update work.
export function upgradeLauncher(p, pluginRoot) {
  try {
    const t = statSync(p.launcherFile).mtimeMs, tpl = statSync(TEMPLATE).mtimeMs;
    // A clock set ahead can date either file ahead. Marked checked at the later of the two dates, so the check runs once
    // instead of waiting years for the clock, or running on every refresh. Rounded up to an even second: some disks
    // keep no less (FAT 2 s, WSL's /mnt/c 1 s), and a date rounded down would fall before juice's own.
    // shortcut: a clock that was slow at an update and put right before the next refresh dates juice before the
    // launcher, so that update's check is skipped; marking the launcher with juice's date instead would flip-flop
    // between two copies of juice sharing a folder.
    const at = Math.ceil(Math.max(tpl, Date.now()) / 2000) * 2000;
    if (t >= tpl && t < at + 60000) return false;
    const want = launcherFor(pluginRoot), have = readFileSync(p.launcherFile, 'utf8'), target = launcherTarget(have);
    // A launcher setup pointed at another copy of juice stays pointed there: running a checkout to test it must
    // not take the place of the installed juice.
    const text = target && target !== launcherTarget(want) ? have : want;
    if (have !== text) writeAtomic(p.launcherFile, text, HOT_WRITE);
    // Marked after a rewrite too, whose date is the clock's. Only a file's owner may set its times: a launcher another
    // user owns (setup run with sudo) is replaced by one of ours first. Only then: one /juice restore just deleted
    // must stay deleted.
    const mark = () => utimesSync(p.launcherFile, new Date(at), new Date(at));
    try { mark(); } catch (e) {
      if (e.code !== 'EPERM' && e.code !== 'EACCES') throw e;
      writeAtomic(p.launcherFile, text, HOT_WRITE); mark();
    }
    return true;
  } catch { return false; }
}
