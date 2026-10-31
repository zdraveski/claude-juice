// Template: `juice setup` copies this to <config>/juice-statusline.mjs so the status line survives plugin updates.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PINNED = null;
const MARKET = null; // the marketplace setup ran from, so another plugin also named juice is never run
const TARGET = ['bin', 'juice-statusline.js'];

const dirs = (d) => { try { return readdirSync(d); } catch { return []; } };
const parts = (v) => v.split(/[.\-+]/).map((s) => parseInt(s, 10) || 0);
const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

export function resolveTarget(configDir, pinned = PINNED, market = MARKET) {
  if (pinned) { const f = join(pinned, ...TARGET); return existsSync(f) ? f : null; }
  const cache = join(configDir, 'plugins', 'cache');
  const found = [];
  for (const m of market ? [market] : dirs(cache)) for (const v of dirs(join(cache, m, 'juice'))) {
    const f = join(cache, m, 'juice', v, ...TARGET);
    // Claude Code keeps replaced and uninstalled versions for a while and marks them, so they must not run.
    if (existsSync(f) && !existsSync(join(cache, m, 'juice', v, '.orphaned_at'))) found.push({ v, f });
  }
  // Claude Code names a folder by its code version (41f619d61b99) when a plugin has no version number; that name
  // is no release number ("41" would beat 1.0.1), so real version numbers come first.
  const isVersion = (v) => /^\d+\.\d+/.test(v);
  return found.sort((a, b) => (isVersion(b.v) - isVersion(a.v)) || newer(b.v, a.v))[0]?.f ?? null;
}

// Turned off in /plugin, juice keeps its folder (no .orphaned_at) but loses its /juice command, so it must not
// keep drawing as if nothing happened; it says how to get back instead.
export function turnedOff(configDir, market = MARKET) {
  if (!market) return false;
  try {
    const settings = JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf8').replace(/^﻿/, ''));
    return settings?.enabledPlugins?.[`juice@${market}`] === false;
  } catch { return false; }
}

// Compare real paths so a symlink or junction to this file still counts as running it.
const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const config = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const target = turnedOff(config) ? null : resolveTarget(config);
  if (target) await import(pathToFileURL(target).href);
  else if (turnedOff(config)) console.log('juice is turned off. Turn it back on in /plugin to see your batteries again (once it is on, /juice restore gives you your old status line instead).');
  else console.log('juice is not installed. Install it again, then type /juice setup to use it or /juice restore to get your old status line back.');
}
