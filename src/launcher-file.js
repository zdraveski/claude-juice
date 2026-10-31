// The launcher file setup writes into the Claude folder (juice-statusline.mjs): what it should say, and keeping it
// current. Small on purpose: every refresh loads it.
import { readFileSync, statSync, utimesSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeAtomic } from './cache.js';

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

// The launcher for this copy of juice: installed from Claude Code's plugin store, it follows updates there;
// anywhere else (a checkout), it pins that folder.
export function launcherFor(pluginRoot) {
  const template = readFileSync(TEMPLATE, 'utf8');
  const pin = 'const PINNED = null;', market = 'const MARKET = null;';
  if (!template.includes(pin) || !template.includes(market)) throw new Error("juice's launcher template is damaged. Reinstall the plugin.");
  const root = fwd(pluginRoot).replace(/\/+$/, ''); // one spelling, so the same folder always gives the same launcher
  // A replacer function stops $' and $& in the path being expanded.
  return root.includes('/plugins/cache/')
    ? template.replace(market, () => `const MARKET = ${JSON.stringify(root.split('/plugins/cache/')[1].split('/')[0])};`)
    : template.replace(pin, () => `const PINNED = ${JSON.stringify(root)};`);
}

// The launcher stays as setup wrote it until setup runs again, so a fix to it (or the pre-0.2.1 kind, which ran any
// plugin named juice) would never reach people. Once after each install or update of juice (the launcher is older
// than the running juice's template), a refresh compares it with what this juice would write and replaces it if
// they differ, else marks it checked. A missing one (restore removed it) is left alone. Never throws.
export function upgradeLauncher(p, pluginRoot) {
  try {
    if (statSync(p.launcherFile).mtimeMs >= statSync(TEMPLATE).mtimeMs) return false;
    const want = launcherFor(pluginRoot);
    if (readFileSync(p.launcherFile, 'utf8') !== want) { writeAtomic(p.launcherFile, want, { maxWaitMs: 30 }); return true; }
    const now = new Date();
    utimesSync(p.launcherFile, now, now);
  } catch {}
  return false;
}
