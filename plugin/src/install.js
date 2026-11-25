// The Install (GLOSSARY.md): how juice is wired into Claude Code on this computer. inspectInstall looks at it once,
// setup acts on what it saw and the doctor puts it into words, so "is this juice's line, and does it work" is decided
// here only. Never throws: a settings.json juice can't read comes back as `error`.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readJson, readOwnJson } from './cache.js';
import { fwd, constant, marketOf } from './launcher-file.js';
import { resolveTarget } from '../bin/launcher.js';

// Valid or not, juice can't tell: a settings.json left owned by root by "sudo claude", say. Not a file with a mistake.
export class Unreadable extends Error {}

// A missing or empty file counts as {}; anything unreadable, unparseable or not an object aborts before we write anything.
// Read once, since Claude Code may save it in between. "Try again", not "run setup": restore shows these too.
function readClaudeSettings(p) {
  const { state, value } = readOwnJson(p.claudeSettings);
  if (state === 'locked') throw new Unreadable("juice can't read your Claude Code settings file (settings.json in your Claude folder), so it changed nothing. Make sure it is yours and you can read it (Claude can help), then try again.");
  if (state === 'broken') throw new Error("Your Claude Code settings file (settings.json in your Claude folder) has a mistake in it, so juice changed nothing. Ask Claude to fix it, then try again.");
  return value ?? {};
}

const readText = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };

// juice's own line is Node (node, nodejs or node.exe, bare or by path, optionally after the PATH="…:$PATH"
// that juiceCommand writes on macOS and Linux) running a juice-statusline.mjs, and nothing else, so a wrapper script
// that merely mentions the file is never taken for juice. Any folder counts: the same one can be spelled
// C:\ or c:\, and settings can be copied from another machine.
const NODE = String.raw`(?:node|"(?:[^"]*[\\/])?node(?:js)?(?:\.exe)?"|\S*[\\/]node(?:js)?(?:\.exe)?)`;
const JUICE_COMMAND = new RegExp(String.raw`^\s*(?:PATH="[^"]*"\s+)?${NODE}\s+"[^"]*[\\/]juice-statusline\.mjs"\s*$`, 'i');
export const isJuice = (statusLine) => typeof statusLine?.command === 'string' && JUICE_COMMAND.test(statusLine.command);
// Windows paths ignore case and slash direction.
export const samePath = (a, b, platform) => (platform === 'win32' ? fwd(a, 'win32').toLowerCase() === fwd(b, 'win32').toLowerCase() : a === b);
// Whether a juice line runs this config folder's launcher, whatever way it finds Node.
const runsLauncher = (p, command, platform) => samePath(command.replace(/^.*\s(?="[^"]*"\s*$)/, '').trim(), `"${fwd(p.launcherFile)}"`, platform);

// Claude Code started from a desktop app on macOS or Linux runs the status line without the shell's PATH,
// where Homebrew's or nvm's node is missing. So the folder of the first node on PATH goes in front of PATH:
// PATH="/opt/homebrew/bin:$PATH" node "…". If that folder later goes (nvm uninstall), node is still looked up
// on the rest of PATH instead of failing. Only absolute folders count (node_modules/.bin breaks elsewhere);
// fnm's per-shell folder vanishes with the shell; a folder with characters the shell would change is skipped.
function nodeCommand(platform, env) {
  if (platform === 'win32') return 'node';
  for (const dir of String(env.PATH ?? '').split(':').filter((d) => d.startsWith('/'))) {
    if (!existsSync(`${dir.replace(/\/+$/, '')}/node`)) continue;
    return /fnm_multishells/.test(dir) || /["$`\\]/.test(dir) ? 'node' : `PATH="${dir.replace(/\/+$/, '')}:$PATH" node`;
  }
  return 'node';
}
// The status line command setup writes for this launcher.
export const juiceCommand = (launcherFile, { platform = process.platform, env = process.env } = {}) => `${nodeCommand(platform, env)} "${fwd(launcherFile)}"`;
// The folder nodeCommand put in front of PATH, if any.
const pinOf = (command) => /^\s*PATH="([^"]*?):\$PATH"\s/.exec(command)?.[1] ?? null;

// statusLine is null (no line before) or an object: a string or number written back would break settings.json.
const restorable = (statusLine) => statusLine === null || (typeof statusLine === 'object' && !Array.isArray(statusLine));
// A saved copy of the old status line is usable when it is an object with a restorable statusLine (valid JSON may still be "x" or 5).
const usableBackup = (b) => !!b && typeof b === 'object' && 'statusLine' in b && restorable(b.statusLine);

// The plugin store keeps a copy at <config>/plugins/cache/<market>/juice/<version>/bin/juice-statusline.js.
const versionOf = (target) => basename(dirname(dirname(target)));
const marketOfTarget = (target) => basename(dirname(dirname(dirname(dirname(target)))));

// owner: 'none' (no status line), 'other' (someone else's), 'elsewhere' (juice's, but another folder's launcher),
// 'here' (this folder's juice), or null when settings.json can't be read. current: 'here' and already the command
// setup would write now.
export function inspectInstall(p, { platform = process.platform, env = process.env } = {}) {
  let settings = null, error = null;
  try { settings = readClaudeSettings(p); } catch (e) { error = e; }
  const line = settings?.statusLine;
  const owner = !settings ? null : !line ? 'none' : !isJuice(line) ? 'other' : runsLauncher(p, line.command, platform) ? 'here' : 'elsewhere';
  const command = juiceCommand(p.launcherFile, { platform, env });
  const pin = owner === 'here' ? pinOf(line.command) : null;

  const text = readText(p.launcherFile);
  const pinned = text && constant(text, 'PINNED'), market = text && constant(text, 'MARKET');
  // Turned off in /plugin: read from the settings already read, so settings.json is read once.
  const off = !!market && settings?.enabledPlugins?.[`juice@${market}`] === false;
  const target = pinned || market ? resolveTarget(p.config, pinned, market) : null;
  // Only the marketplace name differs: setup rewrites the launcher, so no reinstall is needed.
  const other = !target && market && resolveTarget(p.config, null, null);

  const value = readJson(p.backupFile);
  return {
    settings, error, line, owner, command,
    current: owner === 'here' && samePath(line.command, command, platform),
    restorable: restorable(line ?? null),
    pinGone: !!pin && !existsSync(join(pin, 'node')),
    launcher: {
      text, pinned, market, off, found: !!target,
      runs: !target ? null : pinned ? readJson(join(pinned, 'package.json'))?.version ?? null : versionOf(target),
      movedTo: other ? marketOfTarget(other) : null,
      stuck: !!pinned && !!marketOf(fwd(pinned)), // pinned to one plugin-store folder, so it won't follow updates
    },
    backup: { there: existsSync(p.backupFile), value, usable: usableBackup(value) },
  };
}
