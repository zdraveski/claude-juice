// /juice doctor: what juice sees on this computer, in plain words, so "it's blank" turns into something to fix.
// Each line starts with ✓ (fine), ! (needs attention, with what to do) or · (for information).
// Never prints a command (another status line's, or a badge's): they can hold keys. The home folder shows as ~,
// so the report can be pasted into a bug report.
import { readJson } from './cache.js';
import { loadSettings } from './settings.js';
import { NOTHING_SHOWN } from './schema.js';
import { detectTerminal, readClaudeTheme } from './terminal.js';
import { render } from './render/index.js';
import { strip } from './render/ansi.js';
import { LABELS } from './render/words.js';
import { SAMPLES } from './samples.js';
import { badgeList } from './badges.js';
import { readFetched } from './fetched.js';
import { recall } from './lastseen.js';
import { overrides, refreshes, refreshFor, refreshWords } from './setup.js';
import { inspectInstall, Unreadable } from './install.js';
import { hideHome } from './paths.js';

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


export function doctor(p, { env, platform, now, cwd, version, node = process.versions.node }) {
  const out = [];
  const t = now.getTime();
  const { settings: mine, warnings } = loadSettings(p);
  // Older Node still draws the line; juice just isn't tested there, so say so instead of refusing.
  out.push(Number(node.split('.')[0]) >= 24 ? ok(`juice ${version}, Node ${node}, ${OS[platform] ?? platform}`)
    : bad(`Node ${node} isn't supported: juice needs Node 24 or newer. Update it from nodejs.org.`));

  // 1. Is juice the status line, and can that line find Node and juice?
  const s = inspectInstall(p, { platform, env }), { settings, line, owner } = s;
  if (s.error) {
    out.push(bad(s.error instanceof Unreadable ? "juice can't read your Claude Code settings file (settings.json in your Claude folder). Make sure it is yours and you can read it (Claude can help), then run /juice setup."
      : "juice can't read your Claude Code settings file (settings.json in your Claude folder). It has a mistake, or comments or a comma after the last item: Claude Code may read it fine, but juice can't. Ask Claude to fix it, then run /juice setup."));
  }
  if (owner === 'none') out.push(bad('No status line is set. Run /juice setup.'));
  else if (owner === 'other') out.push(bad("Another status line is set, so juice isn't showing. Run /juice setup to switch to juice."));
  else if (owner === 'elsewhere') out.push(bad("juice is your status line but points at a folder that isn't this one (settings copied from another computer?). Run /juice setup."));
  else if (owner === 'here') {
    const every = line.refreshInterval, want = refreshFor(line, mine.motion);
    out.push(refreshes(line) ? ok(`juice is your status line, refreshing ${refreshWords(every)}`)
      // Only juice's own times differ from what motion wants: one chosen by hand is what it wants.
      + (want === every ? '' : '\n' + info(want === 1 ? 'Run /juice setup to refresh every second, so the effort level and batteries climb.'
        : 'Run /juice setup to refresh once a minute: the pictures stand still, so every second only costs CPU.'))
      : bad("juice is your status line but doesn't refresh on its own, so its numbers and reset times go stale while Claude Code is idle. Run /juice setup."));
  }

  if (owner === 'here') {
    // On macOS and Linux setup puts Node's folder in front of PATH; if that Node was uninstalled, a Claude Code
    // started from an app may find no Node at all.
    if (s.pinGone) out.push(bad('The Node juice was set up with is gone (uninstalled or moved), so the line may stay empty. Run /juice setup.'));
    const { text, pinned, market, off, found, runs, movedTo, stuck } = s.launcher;
    if (text === null) out.push(bad("juice's launcher file is missing, so the status line draws nothing. Run /juice setup."));
    else if (!pinned && !market) out.push(bad("juice's launcher file is damaged or from an older juice, so the status line may draw nothing. Run /juice setup."));
    else if (off) out.push(bad('juice is turned off in /plugin, so the status line only says so. Turn it back on in /plugin.'));
    else {
      if (stuck) out.push(bad(`The status line is stuck on one juice folder (${pinned}) and won't follow updates. Run /juice setup.`));
      if (movedTo) out.push(bad(`The status line looks for juice under "${market}", but it is installed under "${movedTo}". Run /juice setup.`));
      else if (!found) out.push(bad("The status line can't find juice any more. Install it again, then run /juice setup."));
      else out.push(ok(`The status line runs juice${runs ? ` ${runs}` : ''}${pinned ? ' from a folder on this computer' : ''}`));
      if (runs && runs !== version) out.push(bad(`These /juice commands are juice ${version} but the status line runs ${runs}. Restarting Claude Code usually lines them up.`));
    }
  }
  if (settings) out.push(...overrides(p, settings, cwd, platform).map((o) => bad(/in that project\.$/.test(o) ? `${o} To use juice there, take that setting out of that file (Claude can do it for you).` : o)));

  // 2. juice's own settings (read once, above), and whether drawing works with them.
  // An unreadable juice.json is never overwritten (it may hold badges), so only a bad value is fixed by changing a setting.
  // Matched from the start: a warning about a bad value quotes it, and the value could hold the same words.
  warnings.forEach((w) => out.push(bad(`juice settings: ${w.replace(/\.$/, '')}. ${/^juice isn't allowed/.test(w)
    ? 'Make sure it and your Claude folder are yours and you can read them (Claude can help).'
    : /^juice\.json is unreadable/.test(w) ? 'Fix or delete juice.json in your Claude folder (Claude can do it for you).'
    : 'Choosing that setting again with /juice replaces it (a newer juice may know it: then updating juice fixes it too).'}`)));
  if (!mine.show.length) out.push(bad(NOTHING_SHOWN));
  const term = detectTerminal({ env, settings: mine, claudeTheme: () => readClaudeTheme(p.claudeSettings) });
  try {
    render(SAMPLES.busy, mine, term);
    out.push(ok(`Drawing works with your settings (${mine.layout} layout, showing ${mine.show.map((id) => NAMES[id] ?? id).join(', ') || 'nothing'})`));
  } catch (e) {
    out.push(bad(`Drawing with your settings failed: ${e?.message}. Type /juice reset the look to start over.`));
  }
  out.push(info(`Terminal, as seen from here: ${term.theme} background, ${COLOURS[term.colorDepth] ?? term.colorDepth}, ${term.ends} ends`));
  // COLORTERM, which says a terminal draws full colour, is lost over ssh and sudo (and may be missing here only).
  // Terminal.app before macOS 26 really draws 256, so the hint is an if, with the way back.
  if (term.colorDepth === '256' && mine.truecolor === 'auto') out.push(info('Only if your terminal draws full colour (iTerm2, Windows Terminal, VS Code, kitty and most others; not the macOS Terminal app before macOS 26): /juice set truecolor=on makes the colours exact. Undo it with truecolor=off.'));
  // A problem from more than a day ago has passed; one this recent is worth a look.
  const err = readJson(p.lastErrorFile);
  if (Number.isFinite(err?.at) && typeof err.message === 'string' && t - err.at >= 0 && t - err.at < DAY) {
    out.push(bad(`The status line hit a problem ${ago(t - err.at)}: ${strip(err.message)}${err.where ? ` (${err.where})` : ''}. Run /juice setup; if it keeps happening, tell us what /juice doctor says.`));
  }

  // 3. Where the numbers come from.
  const seen = recall(p)?.subscriberSeenAt;
  out.push(info(!Number.isFinite(seen) ? "Hasn't seen plan limits yet: they show after Claude's first reply. With an API key there are none."
    : t - seen < 3600000 ? "Saw your plan's limits within the last hour" : `Last saw your plan's limits ${ago(t - seen)}`));
  const fetched = readFetched(p, mine.fable, platform, now);
  if (!fetched.on) {
    out.push(info(mine.fable === 'off' ? 'Fable battery: turned off.'
      : platform === 'darwin' ? 'Fable battery: off on a Mac until you type /juice set fable=on, because macOS asks permission to read your sign-in.'
      : 'Fable battery: off until you turn it on with /juice set fable=on, which lets juice read your Claude login.'));
  } else {
    const { failed, checkedAt } = fetched;
    if (failed) {
      // Behind a company proxy (HTTPS_PROXY), Node's fetch reaches Anthropic only from Node 24 on.
      const proxyBlocks = (env.HTTPS_PROXY || env.https_proxy) && Number(node.split('.')[0]) < 24 && [undefined, 'offline'].includes(failed.why);
      const advice = proxyBlocks ? `You're behind a company proxy, which juice can only get through with Node 24 or newer (this is ${node}): install the newest from nodejs.org.`
        : failed.why === 'expired' ? 'Your Claude sign-in was due for renewal; Claude Code renews it on your next message, and juice picks it up after that.'
        : failed.why === 'busy' ? "Anthropic's server was busy; nothing to do."
        : failed.why === 'denied' ? 'macOS Keychain access was denied; run /juice set fable=off or allow it. juice asks again after about 12 hours; to retry at once, delete fable.json in the juice-cache folder.'
        : failed.why === 'changed' ? "Anthropic's answer wasn't what juice expects. If it lasts a day, tell us at https://github.com/zdraveski/claude-juice/issues."
        : failed.why === 'offline' ? "juice couldn't reach Anthropic: check you're online. Behind a company proxy, set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS if it checks secure connections)."
        : 'If it keeps failing, type /login to sign in to Claude Code again.';
      out.push(bad(`Fable battery: the last check failed; juice tries again in ${Math.ceil((failed.retryAt.getTime() - t) / 60000)} min. ${advice}`));
    } else out.push(info(fetched.reading ? `Fable battery: last checked ${ago(t - checkedAt.getTime())}`
      : checkedAt ? 'Fable battery: not checked in the last hour; juice asks again soon.'
      : 'Fable battery: not checked yet. juice asks in the background for plan subscribers.'));
  }

  // 4. Badges, counted, never shown.
  const list = badgeList(p, mine), badges = list.length, off = list.filter((b) => !b.approved).length;
  if (badges) out.push(info(`${badges} badge${badges === 1 ? '' : 's'}`));
  if (off) out.push(bad(`${off} badge${off === 1 ? " isn't" : "s aren't"} approved on this computer, so ${off === 1 ? 'it never runs' : 'they never run'}. See /juice badges list.`));

  out.push(out.some((l) => l.startsWith('!')) ? 'Lines starting with ! need attention; each says what to do.' : 'Everything looks fine.');
  return out.map((l) => hideHome(l, env, platform));
}
