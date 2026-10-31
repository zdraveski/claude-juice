// /juice doctor: what juice sees on this computer, in plain words, so "it's blank" turns into something to fix.
// Each line starts with ✓ (fine), ! (needs attention, with what to do) or · (for information).
// Never prints a command (another status line's, or a badge's): they can hold keys.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readJson } from './cache.js';
import { loadSettings } from './settings.js';
import { fableEnabled } from './schema.js';
import { detectTerminal, readClaudeTheme } from './terminal.js';
import { render } from './render/index.js';
import { SAMPLES } from './samples.js';
import { listBadges, unapprovedBadges } from './badges.js';
import { isJuice, runsLauncher, overrides, readClaudeSettings } from './setup.js';
import { resolveTarget, turnedOff } from '../bin/launcher.js';

const ok = (s) => `✓ ${s}`, bad = (s) => `! ${s}`, info = (s) => `· ${s}`;
const OS = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
const COLOURS = { truecolor: 'full colour', 256: '256 colours', none: 'no colour' };

export function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (!(m >= 1)) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

// The launcher setup wrote records which juice it runs: a pinned folder, or the plugin store it came from.
const constant = (text, name) => {
  const m = new RegExp(`const ${name} = ("(?:[^"\\\\]|\\\\.)*");`).exec(text);
  return m ? JSON.parse(m[1]) : null;
};
const versionIn = (folder) => readJson(join(folder, 'package.json'))?.version ?? '?';

export function doctor(p, { env, platform, now, cwd, version }) {
  const out = [];
  const t = now.getTime();
  const node = process.versions.node;
  out.push(Number(node.split('.')[0]) >= 18 ? ok(`juice ${version}, Node ${node}, ${OS[platform] ?? platform}`)
    : bad(`Node ${node} is too old: juice needs Node 18 or newer. Install it from nodejs.org.`));

  // 1. Is juice the status line, and can that line find juice?
  let settings = null;
  try { settings = readClaudeSettings(p); } catch { out.push(bad("Claude Code's settings file isn't valid JSON, so Claude Code can't read it. Fix or remove it, then run /juice setup.")); }
  const line = settings?.statusLine;
  if (settings && !line) out.push(bad('No status line is set. Run /juice setup.'));
  else if (line && !isJuice(line)) out.push(bad("Another status line is set, so juice isn't showing. Run /juice setup to switch to juice."));
  else if (line && !runsLauncher(p, line.command, platform)) out.push(bad("juice is your status line but points at a folder that isn't this one (settings copied from another computer?). Run /juice setup."));
  else if (line) out.push(line.refreshInterval ? ok('juice is your status line, refreshing once a minute')
    : bad("juice is your status line but doesn't refresh on its own, so countdowns stop while Claude Code is idle. Run /juice setup."));

  if (isJuice(line)) {
    const launcher = existsSync(p.launcherFile) ? readFileSync(p.launcherFile, 'utf8') : null;
    const pinned = launcher && constant(launcher, 'PINNED'), market = launcher && constant(launcher, 'MARKET');
    const target = launcher && !turnedOff(p.config, market) ? resolveTarget(p.config, pinned, market) : null;
    if (launcher === null) out.push(bad("juice's launcher file is missing, so the status line draws nothing. Run /juice setup."));
    else if (turnedOff(p.config, market)) out.push(bad('juice is turned off in /plugin, so the status line only says so. Turn it back on in /plugin.'));
    else if (!target) out.push(bad("The status line can't find juice any more. Install it again, then run /juice setup."));
    else {
      const runs = pinned ? versionIn(pinned) : basename(dirname(dirname(target)));
      out.push(ok(`The status line runs juice ${runs}${pinned ? ' from a folder on this computer' : ''}`));
      if (runs !== version) out.push(bad(`These /juice commands are juice ${version} but the status line runs ${runs}. Restarting Claude Code usually lines them up.`));
    }
  }
  if (settings) out.push(...overrides(p, settings, cwd, platform).map(bad));

  // 2. juice's own settings, and whether drawing works with them.
  const { settings: mine, warnings } = loadSettings(p);
  warnings.forEach((w) => out.push(bad(`juice settings: ${w}`)));
  if (!mine.show.length) out.push(bad('Your juice settings choose nothing to show, so the line stays empty. Type /juice show everything to bring it back.'));
  const term = detectTerminal({ env, settings: mine, claudeTheme: readClaudeTheme(p.claudeSettings) });
  try {
    render(SAMPLES.busy, mine, term);
    out.push(ok(`Drawing works with your settings (${mine.layout} layout, showing ${mine.show.join(', ') || 'nothing'})`));
  } catch (e) {
    out.push(bad(`Drawing with your settings failed: ${e?.message}. Type /juice reset the look to start over.`));
  }
  out.push(info(`Terminal, as seen from here: ${term.theme} background, ${COLOURS[term.colorDepth] ?? term.colorDepth}, ${term.ends} ends`));
  const err = readJson(join(p.cacheDir, 'last-error.json'));
  if (Number.isFinite(err?.at) && typeof err.message === 'string') {
    out.push(bad(`The status line last hit a problem ${ago(t - err.at)}: ${err.message}${err.where ? ` (${err.where})` : ''}`));
  }

  // 3. Where the numbers come from.
  const seen = readJson(join(p.cacheDir, 'lastseen.json'));
  out.push(info(Number.isFinite(seen?.subscriberSeenAt) ? `Last saw your plan's limits ${ago(t - seen.subscriberSeenAt)} (checked at most hourly while nothing changes)`
    : "Hasn't seen plan limits yet: they show after Claude's first reply. With an API key there are none."));
  if (!fableEnabled(mine.fable, platform)) {
    out.push(info(mine.fable === 'off' ? 'Fable limit: turned off.' : 'Fable limit: off on macOS unless you turn it on (fable=on), because macOS asks permission to read your sign-in.'));
  } else {
    const f = readJson(join(p.cacheDir, 'fable.json'));
    if (f?.backoffUntil > t) {
      out.push(bad(`Fable limit: the last check failed; juice tries again in ${Math.ceil((f.backoffUntil - t) / 60000)} min. That's normal with an API key; on a Claude plan, signing in again (/login) usually fixes it.`));
    } else out.push(info(Number.isFinite(f?.fetchedAt) ? `Fable limit: last checked ${ago(t - f.fetchedAt)}` : 'Fable limit: not checked yet. juice asks in the background for plan subscribers.'));
  }

  // 4. Badges, counted, never shown.
  const badges = listBadges(p).length, off = unapprovedBadges(p).length;
  if (badges) out.push(info(`${badges} badge${badges === 1 ? '' : 's'}`));
  if (off) out.push(bad(`${off} badge${off === 1 ? " isn't" : "s aren't"} approved on this computer, so ${off === 1 ? 'it never runs' : 'they never run'}. See /juice badges list.`));

  if (out.some((l) => l.startsWith('!'))) out.push('Lines starting with ! need attention; each says what to do.');
  else out.push('Everything looks fine.');
  return out;
}
