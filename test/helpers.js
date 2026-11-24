process.env.TZ = 'Europe/London'; // GMT for every date the tests use (Oct 28 - Nov 5), and not called UTC, so times carry no ' UTC'
import { readFileSync } from 'node:fs';
import { strip } from '../plugin/src/render/ansi.js';

export { strip };
export const NOW = new Date(2026, 9, 28, 14, 20);
export const at = (seconds) => new Date(NOW.getTime() + seconds * 1000);

// The environment for a spawned status line: a short allowlist, a throwaway home, and the terminal settings pinned,
// so a developer's COLUMNS, NO_COLOR or FORCE_COLOR can't change what a test sees (and nothing reaches a real login).
export function cleanEnv(configDir, extra = {}) {
  const env = { COLUMNS: '200', NO_COLOR: '', FORCE_COLOR: '0', HOME: configDir, USERPROFILE: configDir, CLAUDE_CONFIG_DIR: configDir };
  for (const k of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'TZ', 'APPDATA', 'LOCALAPPDATA']) if (process.env[k] !== undefined) env[k] = process.env[k];
  return { ...env, ...extra };
}

// Reads test/fixtures/<name>.json, turning every "now+<n>" string into epoch seconds.
export function fixture(name) {
  const text = readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8');
  return JSON.parse(text, (_, v) => {
    const m = typeof v === 'string' && /^now\+(-?\d+)$/.exec(v);
    return m ? Math.floor(NOW / 1000) + Number(m[1]) : v;
  });
}
