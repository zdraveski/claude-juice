// /juice doctor: what juice sees on this computer, in plain words, so "it's blank" turns into something to fix.
// Each line starts with ✓ (fine), ! (needs attention, with what to do) or · (for information).
// Never prints a command (another status line's, or a badge's): they can hold keys. The home folder shows as ~,
// so the report can be pasted into a bug report.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readJson } from './cache.js';
import { loadSettings } from './settings.js';
import { fableEnabled } from './schema.js';
import { detectTerminal, readClaudeTheme } from './terminal.js';
import { render } from './render/index.js';
import { LABELS } from './render/words.js';
import { SAMPLES } from './samples.js';
import { listBadges, unapprovedBadges } from './badges.js';
import { fableCacheState } from './fable.js';
import { fetchedCounts } from './readings.js';
import { isJuice, runsLauncher, overrides, readClaudeSettings } from './setup.js';
import { hideHome } from './paths.js';
import { resolveTarget, turnedOff } from '../bin/launcher.js';

const ok = (s) => `✓ ${s}`, bad = (s) => `! ${s}`, info = (s) => `· ${s}`;
const OS = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
const COLOURS = { truecolor: 'full colour', 256: '256 colours', none: 'no colour' };
const NAMES = { model: 'Model', effort: 'Effort', ...Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, v[0]])) };
const DAY = 86400000;

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
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
};
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };

export function doctor(p, { env, platform, now, cwd, version }) {
  const out = [];
  const t = now.getTime();
  const node = process.versions.node;
  out.push(Number(node.split('.')[0]) >= 18 ? ok(`juice ${version}, Node ${node}, ${OS[platform] ?? platform}`)
    : bad(`Node ${node} is too old: juice needs Node 18 or newer. Install it from nodejs.org.`));

  // 1. Is juice the status line, and can that line find Node and juice?
  let settings = null;
  try { settings = readClaudeSettings(p); } catch {
    out.push(bad("Claude Code's settings file (settings.json in your Claude folder) has a mistake in it, so Claude Code can't read it. Ask Claude to fix it, then run /juice setup."));
  }
  const line = settings?.statusLine;
  const here = isJuice(line) && runsLauncher(p, line.command, platform);
  if (settings && !line) out.push(bad('No status line is set. Run /juice setup.'));
  else if (line && !isJuice(line)) out.push(bad("Another status line is set, so juice isn't showing. Run /juice setup to switch to juice."));
  else if (line && !here) out.push(bad("juice is your status line but points at a folder that isn't this one (settings copied from another computer?). Run /juice setup."));
  else if (line) {
    const every = line.refreshInterval;
    out.push(Number.isFinite(every) && every > 0 ? ok(`juice is your status line, refreshing ${every === 60 ? 'once a minute' : `every ${every} seconds`}`)
      : bad("juice is your status line but doesn't refresh on its own, so its numbers and reset times go stale while Claude Code is idle. Run /juice setup."));
  }

  if (here) {
    // On macOS and Linux setup puts Node's folder in front of PATH; if that Node was uninstalled, a Claude Code
    // started from an app may find no Node at all.
    const pin = /^\s*PATH="([^"]*?):\$PATH"\s/.exec(line.command)?.[1];
    if (pin && !existsSync(join(pin, 'node'))) out.push(bad('The Node juice was set up with is gone (uninstalled or moved), so the line may stay empty. Run /juice setup.'));
    const launcher = existsSync(p.launcherFile) ? read(p.launcherFile) : null;
    const pinned = launcher && constant(launcher, 'PINNED'), market = launcher && constant(launcher, 'MARKET');
    if (launcher === null) out.push(bad("juice's launcher file is missing, so the status line draws nothing. Run /juice setup."));
    else if (!pinned && !market) out.push(bad("juice's launcher file is damaged, so the status line may draw nothing. Run /juice setup."));
    else if (turnedOff(p.config, market)) out.push(bad('juice is turned off in /plugin, so the status line only says so. Turn it back on in /plugin.'));
    else {
      const target = resolveTarget(p.config, pinned, market);
      const runs = !target ? null : pinned ? readJson(join(pinned, 'package.json'))?.version : basename(dirname(dirname(target)));
      if (!target) out.push(bad("The status line can't find juice any more. Install it again, then run /juice setup."));
      else out.push(ok(`The status line runs juice${runs ? ` ${runs}` : ''}${pinned ? ' from a folder on this computer' : ''}`));
      if (runs && runs !== version) out.push(bad(`These /juice commands are juice ${version} but the status line runs ${runs}. Restarting Claude Code usually lines them up.`));
    }
  }
  if (settings) out.push(...overrides(p, settings, cwd, platform).map((o) => bad(`${o} To use juice there, take that setting out of that file (Claude can do it for you).`)));

  // 2. juice's own settings, and whether drawing works with them.
  const { settings: mine, warnings } = loadSettings(p);
  warnings.forEach((w) => out.push(bad(`juice settings: ${w}. Changing any setting with /juice saves a clean copy.`)));
  if (!mine.show.length) out.push(bad('Your juice settings choose nothing to show, so the line stays empty. Type /juice show all the batteries to bring them back.'));
  const term = detectTerminal({ env, settings: mine, claudeTheme: readClaudeTheme(p.claudeSettings) });
  try {
    render(SAMPLES.busy, mine, term);
    out.push(ok(`Drawing works with your settings (${mine.layout} layout, showing ${mine.show.map((id) => NAMES[id] ?? id).join(', ') || 'nothing'})`));
  } catch (e) {
    out.push(bad(`Drawing with your settings failed: ${e?.message}. Type /juice reset the look to start over.`));
  }
  out.push(info(`Terminal, as seen from here: ${term.theme} background, ${COLOURS[term.colorDepth] ?? term.colorDepth}, ${term.ends} ends`));
  // A problem from more than a day ago has passed; one this recent is worth a look.
  const err = readJson(join(p.cacheDir, 'last-error.json'));
  if (Number.isFinite(err?.at) && typeof err.message === 'string' && t - err.at >= 0 && t - err.at < DAY) {
    out.push(bad(`The status line hit a problem ${ago(t - err.at)}: ${err.message}${err.where ? ` (${err.where})` : ''}. Run /juice setup; if it keeps happening, tell us what /juice doctor says.`));
  }

  // 3. Where the numbers come from.
  const seen = readJson(join(p.cacheDir, 'lastseen.json'))?.subscriberSeenAt;
  out.push(info(!Number.isFinite(seen) ? "Hasn't seen plan limits yet: they show after Claude's first reply. With an API key there are none."
    : t - seen < 3600000 ? "Saw your plan's limits within the last hour" : `Last saw your plan's limits ${ago(t - seen)}`));
  if (!fableEnabled(mine.fable, platform)) {
    out.push(info(mine.fable === 'off' ? 'Fable battery: turned off.' : 'Fable battery: off on a Mac until you type /juice set fable=on, because macOS asks permission to read your sign-in.'));
  } else {
    const f = readJson(join(p.cacheDir, 'fable.json'));
    if (fableCacheState(f, t).backedOff) {
      out.push(bad(`Fable battery: the last check failed; juice tries again in ${Math.ceil((f.backoffUntil - t) / 60000)} min. If it keeps failing, type /login to sign in to Claude Code again.`));
    } else out.push(info(fetchedCounts(f?.fetchedAt, now) ? `Fable battery: last checked ${ago(t - f.fetchedAt)}`
      : f?.fetchedAt ? 'Fable battery: not checked in the last hour; juice asks again soon.'
      : 'Fable battery: not checked yet. juice asks in the background for plan subscribers.'));
  }

  // 4. Badges, counted, never shown.
  const badges = listBadges(p).length, off = unapprovedBadges(p).length;
  if (badges) out.push(info(`${badges} badge${badges === 1 ? '' : 's'}`));
  if (off) out.push(bad(`${off} badge${off === 1 ? " isn't" : "s aren't"} approved on this computer, so ${off === 1 ? 'it never runs' : 'they never run'}. See /juice badges list.`));

  out.push(out.some((l) => l.startsWith('!')) ? 'Lines starting with ! need attention; each says what to do.' : 'Everything looks fine.');
  return out.map((l) => hideHome(l, env));
}
