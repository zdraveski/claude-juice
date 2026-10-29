// The per-refresh pipeline: stdin text in, status line text out. Never throws, never waits on a refresher.
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { paths } from './paths.js';
import { readJson, takeLock } from './cache.js';
import { loadSettings } from './settings.js';
import { detectTerminal, readClaudeTheme } from './terminal.js';
import { remember, recall } from './lastseen.js';
import { normalize } from './data.js';
import { render } from './render/index.js';
import { strip } from './render/ansi.js';

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const quiet = (fn) => { try { fn(); } catch {} };

export async function runStatusLine({ stdinText, env, now, platform, spawnDetached }) {
  const stdin = parse(stdinText);
  try {
    const p = paths(env);
    const { settings } = loadSettings(p);
    const extras = { lastSeen: recall(p) };

    // Loaded on demand: these pull in child_process and crypto, which most refreshes never need.
    const fableOn = settings.fable === 'on' || (settings.fable === 'auto' && platform !== 'darwin');
    const fable = fableOn ? await import('./fable.js') : null;
    const fableCache = fableOn ? readJson(join(p.cacheDir, 'fable.json')) : null;
    if (fableOn) extras.fable = fableCache;

    const bd = stdin && settings.badges.length > 0 ? await import('./badges.js') : null;
    const key = bd ? bd.badgeKey(stdin) : null;
    const badges = bd ? bd.readBadges(p, key, now) : null;
    if (badges) extras.badges = badges.texts;

    const data = normalize(stdin, extras, now);
    const terminal = detectTerminal({ env, settings, claudeTheme: readClaudeTheme(p.claudeSettings) });
    const { text } = render(data, settings, terminal);

    remember(stdin, p, now);
    if (fable && fable.fableCacheState(fableCache, now).stale && takeLock(p, 'fable', now)) {
      quiet(() => spawnDetached(['refresh-fable']));
    }
    if (badges?.stale && takeLock(p, `badges-${key}`, now, 2500)) {
      quiet(() => {
        mkdirSync(join(p.cacheDir, 'badges'), { recursive: true });
        writeFileSync(join(p.cacheDir, 'badges', `${key}.stdin.json`), stdinText); // raw text: the refresher pipes it to each command
        spawnDetached(['refresh-badges', key]);
      });
    }
    return text;
  } catch {
    const name = stdin?.model?.display_name;
    return typeof name === 'string' ? strip(name) : '';
  }
}
