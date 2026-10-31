// The per-refresh pipeline: stdin text in, status line text out. Never throws, never waits on a refresher.
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { paths, hideHome } from './paths.js';
import { readJson, takeLock, writeJsonAtomic, HOT_WRITE } from './cache.js';
import { loadSettings } from './settings.js';
import { fableEnabled } from './schema.js';
import { detectTerminal, readClaudeTheme } from './terminal.js';
import { remember } from './lastseen.js';
import { normalize } from './data.js';
import { fableCacheState } from './readings.js';
import { render } from './render/index.js';
import { strip } from './render/ansi.js';

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
const quiet = (fn) => { try { fn(); } catch {} };

export async function runStatusLine({ stdinText, env, now, platform, spawnDetached }) {
  const stdin = parse(stdinText);
  let p;
  try {
    p = paths(env);
    const { settings } = loadSettings(p);
    // Saved first, so this refresh already counts what it just saw against what other sessions saw.
    const extras = { lastSeen: remember(stdin, p, now) };

    // fable.js (child_process, crypto) only runs in the background refresher; here the cache is enough.
    const fableOn = fableEnabled(settings.fable, platform);
    const fableCache = fableOn ? readJson(join(p.cacheDir, 'fable.json')) : null;
    if (fableOn) extras.fable = fableCache;

    const bd = stdin && settings.badges.length > 0 ? await import('./badges.js') : null;
    const mine = bd ? bd.approved(p, settings.badges) : []; // only badges this computer approved ever run
    const key = mine.length ? bd.badgeKey(stdin) : null;
    const badges = mine.length ? bd.readBadges(p, key, now, mine.map((b) => b.command)) : null;
    if (badges) extras.badges = badges.texts;

    const data = normalize(stdin, extras, now);
    const terminal = detectTerminal({ env, settings, claudeTheme: readClaudeTheme(p.claudeSettings) });
    const { text } = render(data, settings, terminal);

    // Only subscribers have these limits, so nobody else's login is sent to Anthropic for nothing.
    if (fableOn && data.account === 'subscriber' && fableCacheState(fableCache, now).stale && takeLock(p, 'fable', now)) {
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
  } catch (e) {
    // Kept for /juice doctor: the message and juice's own file and line, with every folder taken out of paths
    // (they hold the person's name), so the doctor's report can be pasted into a bug report.
    if (p) quiet(() => writeJsonAtomic(join(p.cacheDir, 'last-error.json'), {
      at: Date.now(),
      message: hideHome(String(e?.message ?? e), env, platform).replace(/(?:file:\/*)?(?:[A-Za-z]:|~)?[\\/](?:[^\\/\s'"`]+[\\/])+/g, '').slice(0, 300),
      where: /([\w.-]+\.js):(\d+)/.exec(String(e?.stack).split('\n').slice(1).join('\n'))?.slice(1).join(':') ?? null,
    }, HOT_WRITE));
    const name = stdin?.model?.display_name;
    return typeof name === 'string' ? strip(name) : '';
  }
}
