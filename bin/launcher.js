// Template: `juice setup` copies this to <config>/juice-statusline.mjs so the status line survives plugin updates.
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PINNED = null;
const TARGET = ['bin', 'juice-statusline.js'];

const dirs = (d) => { try { return readdirSync(d); } catch { return []; } };
const parts = (v) => v.split(/[.\-+]/).map((s) => parseInt(s, 10) || 0);
const newer = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

export function resolveTarget(configDir, pinned = PINNED) {
  if (pinned) { const f = join(pinned, ...TARGET); return existsSync(f) ? f : null; }
  const cache = join(configDir, 'plugins', 'cache');
  const found = [];
  for (const m of dirs(cache)) for (const v of dirs(join(cache, m, 'juice'))) {
    const f = join(cache, m, 'juice', v, ...TARGET);
    if (existsSync(f)) found.push({ v, f });
  }
  return found.sort((a, b) => newer(b.v, a.v))[0]?.f ?? null;
}

// Compare real paths so a symlink or junction to this file still counts as running it.
const isMain = (() => { try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const target = resolveTarget(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'));
  if (target) await import(pathToFileURL(target).href);
  else console.log('juice is not installed. Reinstall it and type /juice restore to get your old status line back.');
}
