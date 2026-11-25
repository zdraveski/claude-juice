// The per-refresh pipeline: stdin text in, status line text out. Never throws, never waits on a refresher.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, chmodSync, unlinkSync } from 'node:fs';
import { paths, hideHome } from './paths.js';
import { takeLock, writeAtomic, writeJsonAtomic, sweepTemp, HOT_WRITE } from './cache.js';
import { loadSettings } from './settings.js';
import { readFetched, FABLE_REFRESH } from './fetched.js';
import { detectTerminal, readClaudeTheme, columnsOf } from './terminal.js';
import { remember } from './lastseen.js';
import { normalize } from './data.js';
import { render } from './render/index.js';
import { strip, dim, vis, cut } from './render/ansi.js';
import { upgradeLauncher } from './launcher-file.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const parse = (text) => { try { return JSON.parse(text.replace(/^﻿/, '')); } catch { return null; } }; // a BOM: PowerShell 5.1 pipes one in
const quiet = (fn) => { try { fn(); } catch {} };

export async function runStatusLine({ stdinText, env, now, platform, spawnDetached }) {
  const stdin = parse(stdinText);
  let p;
  try {
    p = paths(env);
    const { settings } = loadSettings(p);
    // Saved first, so this refresh already counts what it just saw against what other sessions saw.
    const extras = { lastSeen: remember(stdin, p, now) };

    // fable.js (child_process, crypto) only runs in the background refresher; here its saved reading is enough.
    const fetched = readFetched(p, settings.fable, platform, now);
    if (fetched.reading) extras.fetched = fetched.reading;

    // A badge that fails to load costs the badges, never the line.
    let key = null, badges = null, bd = null;
    try {
      bd = stdin && settings.badges.length > 0 ? await import('./badges.js') : null;
      const mine = bd ? bd.approved(p, settings.badges) : []; // only badges this computer approved ever run
      key = mine.length ? bd.badgeKey(stdin) : null;
      badges = mine.length ? bd.readBadges(p, key, now, mine.map((b) => b.command)) : null;
    } catch { key = badges = null; }
    if (badges) extras.badges = badges.texts;

    const data = normalize(stdin, extras, now);
    const terminal = detectTerminal({ env, settings, claudeTheme: () => readClaudeTheme(p.claudeSettings) });
    // Only the real line moves, and only with motion on: each climb needs a refresh every second.
    const { text } = render(data, settings, { ...terminal, animate: settings.motion === 'on' });

    // Only subscribers have these limits, so nobody else's login is sent to Anthropic for nothing.
    if (data.account === 'subscriber' && fetched.due && takeLock(p, FABLE_REFRESH.lock, now, FABLE_REFRESH.holdMs)) {
      quiet(() => spawnDetached([FABLE_REFRESH.command]));
    }
    if (badges?.stale && takeLock(p, bd.BADGE_REFRESH.lock(key), now, bd.BADGE_REFRESH.holdMs)) {
      quiet(() => {
        writeAtomic(bd.BADGE_REFRESH.stash(p, key), stdinText, HOT_WRITE); // raw text: the refresher pipes it to each command
        spawnDetached([bd.BADGE_REFRESH.command, key]);
      });
    }
    // Keeps the launcher setup wrote up to date with the juice now running. Once per update, the refresh time
    // juice wrote moves to what motion wants (1.3.x people never run setup again). setup.js loads only then.
    // Folders made before 1.4.0 kept the default permissions, so they are made private here too.
    if (upgradeLauncher(p, ROOT)) {
      if (platform !== 'win32') for (const d of [p.cacheDir, join(p.cacheDir, 'badges')]) quiet(() => chmodSync(d, 0o700));
      // Temp files a killed refresh left: the Fable and badge refreshers sweep them too, but not everyone runs those.
      quiet(() => sweepTemp(p));
      try { (await import('./setup.js')).matchRefresh(p, { platform, write: HOT_WRITE }); } catch {}
    }
    if (existsSync(p.lastErrorFile)) quiet(() => unlinkSync(p.lastErrorFile)); // this run worked, so an earlier glitch is no longer news for /juice doctor
    return text;
  } catch (e) {
    // Kept for /juice doctor: the message and juice's own file and line, with every folder taken out of paths
    // (they hold the person's name), so the doctor's report can be pasted into a bug report.
    if (p) quiet(() => writeJsonAtomic(p.lastErrorFile, {
      at: Date.now(),
      message: hideHome(String(e?.message ?? e), env, platform).replace(/(?:file:\/*)?(?:[A-Za-z]:|~)?[\\/](?:[^\\/'"`]+[\\/])+/g, '').slice(0, 300),
      where: /([\w.-]+\.js):(\d+)/.exec(String(e?.stack).split('\n').slice(1).join('\n'))?.slice(1).join(':') ?? null,
    }, HOT_WRITE));
    // A bare model name looks like "no data yet", so say where to look; the next run that works drops it.
    // Plain under NO_COLOR (no-color.org: any non-empty value), as terminal.js reads it.
    // One row inside the window, like the real line: the hint is what matters, so a long name gives way to it.
    const hint = env?.NO_COLOR ? 'juice: /juice doctor' : dim('juice: /juice doctor');
    const cols = columnsOf(env), room = cols - vis(hint) - 1;
    const name = typeof stdin?.model?.display_name === 'string' ? strip(stdin.model.display_name).replace(/\s+/g, ' ').trim() : '';
    if (name && room > 0) return `${strip(cut(name, room))} ${hint}`;
    return vis(hint) > cols ? strip(cut(hint, cols)) : hint;
  }
}
