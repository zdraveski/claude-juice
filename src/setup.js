import { existsSync, readFileSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readJson, writeJsonAtomic, writeAtomic } from './cache.js';
import { NOTHING_SHOWN } from './schema.js';
import { fwd, constant, launcherTarget, launcherFor } from './launcher-file.js';

export { fwd, constant };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// A saved copy of the old status line is usable when it is an object with a statusLine (valid JSON may still be "x" or 5).
const usableBackup = (b) => !!b && typeof b === 'object' && 'statusLine' in b;
const readText = (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } };
// Claude Code only redraws on events, so without a timer the countdowns freeze while it is idle.
const REFRESH_SECONDS = 60;
// A refresh time Claude Code uses: at least one second (a hand-typed "60", -5 or 0.5 is ignored by it).
export const refreshes = (statusLine) => Number.isFinite(statusLine?.refreshInterval) && statusLine.refreshInterval >= 1;

// A symlinked settings.json must stay a symlink, so write to what it points at.
const writeSettings = (p, v) => writeJsonAtomic(existsSync(p.claudeSettings) ? realpathSync(p.claudeSettings) : p.claudeSettings, v);

// juice's own line is Node (node, nodejs or node.exe, bare or by path, optionally after the PATH="…:$PATH"
// that setup writes on macOS and Linux) running a juice-statusline.mjs, and nothing else, so a wrapper script
// that merely mentions the file is never taken for juice. Any folder counts: the same one can be spelled
// C:\ or c:\, and settings can be copied from another machine.
const NODE = String.raw`(?:node|"(?:[^"]*[\\/])?node(?:js)?(?:\.exe)?"|\S*[\\/]node(?:js)?(?:\.exe)?)`;
const JUICE_COMMAND = new RegExp(String.raw`^\s*(?:PATH="[^"]*"\s+)?${NODE}\s+"[^"]*[\\/]juice-statusline\.mjs"\s*$`, 'i');
export const isJuice = (statusLine) => typeof statusLine?.command === 'string' && JUICE_COMMAND.test(statusLine.command);
// Windows paths ignore case and slash direction.
const samePath = (a, b, platform) => (platform === 'win32' ? fwd(a).toLowerCase() === fwd(b).toLowerCase() : a === b);
// Whether a juice line runs this config folder's launcher, whatever way it finds Node.
export const runsLauncher = (p, command, platform) => samePath(command.replace(/^.*\s(?="[^"]*"\s*$)/, '').trim(), `"${fwd(p.launcherFile)}"`, platform);

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

// The shell Claude Code runs the status line in (Git Bash on Windows, sh elsewhere) would change a $ or a
// backtick inside the quoted path, cmd a %, and a " would end the quotes, so such a path can't be set up safely.
// (Backslashes never reach the shell: the command is written with forward slashes.)
const SHELL_UNSAFE = /[$`%"]/;

// Settings that beat the person's own: a project's .claude/settings(.local).json in this folder or any folder
// above it, and disableAllHooks, which turns status lines off too. juice can't change those, but it can say so
// instead of claiming success.
export function overrides(p, settings, cwd, platform) {
  const out = [];
  if (settings.disableAllHooks === true) out.push("Your Claude Code settings turn hooks off (disableAllHooks), which hides status lines too, so juice won't show until that is turned back on.");
  // The person's own settings folders are not a project's: the config folder, and the home folder's .claude.
  const own = [resolve(p.config), resolve(homedir(), '.claude')];
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const project = join(dir, '.claude');
    if (!own.some((o) => samePath(project, o, platform))) {
      for (const f of ['settings.json', 'settings.local.json']) {
        const s = readJson(join(project, f)), where = fwd(relative(resolve(cwd), join(project, f))); // from here, so no folder names above it are shown
        if (s?.statusLine && !isJuice(s.statusLine)) out.push(`${where} sets its own status line, so juice won't show in that project.`);
        if (s?.disableAllHooks === true) out.push(`${where} turns hooks off (disableAllHooks), which hides status lines too, so juice won't show in that project.`);
      }
    }
    if (dirname(dir) === dir) return out;
  }
}

export class NeedsConfirm extends Error {}

// A missing or empty file counts as {}; anything unreadable, unparseable or not an object aborts before we write anything.
// readJson strips the BOM PowerShell 5.1 writes.
export function readClaudeSettings(p) {
  const text = readText(p.claudeSettings);
  if (text === null ? !existsSync(p.claudeSettings) : !text.replace(/^﻿/, '').trim()) return {};
  const v = readJson(p.claudeSettings);
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error("Your Claude Code settings file (settings.json in your Claude folder) has a mistake in it, so juice changed nothing. Ask Claude to fix it, then run /juice setup again.");
  }
  return v;
}

export function install(p, { pluginRoot, yes = false, platform = process.platform, env = process.env, cwd = process.cwd() }) {
  const settings = readClaudeSettings(p);
  if (SHELL_UNSAFE.test(p.launcherFile)) {
    throw new Error(`Your Claude Code folder (${fwd(p.config)}) has a $, \`, % or " in its path, which would break the status line, so juice changed nothing. Point CLAUDE_CONFIG_DIR at a folder without them and run setup again.`);
  }
  const command = `${nodeCommand(platform, env)} "${fwd(p.launcherFile)}"`;
  const ours = isJuice(settings.statusLine);
  const lines = [];

  // A backup that exists but can't be read is set aside like a stale one, so the current line is still saved.
  const backupThere = existsSync(p.backupFile);
  const old = ours ? null : readJson(p.backupFile);
  const usable = usableBackup(old);
  const damaged = !ours && backupThere && !usable;
  const stale = usable && !same(settings.statusLine, old.statusLine);
  if (stale && !yes) throw new NeedsConfirm('Your status line has changed since juice saved a copy of the old one, so juice changed nothing. Run setup again with --yes to save your current status line too (the earlier copy is kept under a new name) and switch to juice.');

  const launcher = launcherFor(pluginRoot);
  // Said in every case below: what the launcher runs really changed, or it was missing or from an older juice.
  const before = readText(p.launcherFile);
  const fix = before === null || !launcherTarget(before) ? 'Its launcher file was missing or from an older juice, so juice put it back.'
    : launcherTarget(before) !== launcherTarget(launcher) ? 'It now uses the juice you just ran setup from.' : '';
  writeAtomic(p.launcherFile, launcher);

  if (stale || damaged) {
    renameSync(p.backupFile, p.backupFile.replace(/\.json$/, `-${Date.now()}.json`));
    lines.push(damaged ? "juice's saved copy of your old status line was damaged, so juice set it aside under a new name." : 'Kept the earlier saved copy next to it under a new name.');
  }
  if (!ours && (stale || damaged || !backupThere)) {
    // As private as settings.json itself: the old status line command can hold a key.
    writeJsonAtomic(p.backupFile, { statusLine: settings.statusLine ?? null, savedAt: new Date().toISOString() }, { modeFrom: p.claudeSettings });
    lines.push(settings.statusLine ? 'Saved your current status line so you can get it back.' : 'You had no status line, so there is nothing to save.');
  }
  const current = ours && samePath(settings.statusLine.command, command, platform);
  if (current && refreshes(settings.statusLine)) lines.push(fix ? 'juice is already your status line.' : 'juice is already your status line. Nothing changed.');
  else if (current) {
    writeSettings(p, { ...settings, statusLine: { ...settings.statusLine, refreshInterval: REFRESH_SECONDS } });
    lines.push('juice now refreshes once a minute, so its numbers and reset times stay current.');
  } else if (ours) {
    // A juice line pointing elsewhere (settings copied from another machine, a renamed user folder) draws nothing;
    // one with the right launcher but an older way of finding Node just gets the current one.
    const sameLauncher = runsLauncher(p, settings.statusLine.command, platform);
    writeSettings(p, { ...settings, statusLine: { ...settings.statusLine, command, refreshInterval: refreshes(settings.statusLine) ? settings.statusLine.refreshInterval : REFRESH_SECONDS } });
    lines.push(sameLauncher ? 'juice is your status line, now set up to find Node even when Claude Code starts from an app.'
      : 'juice was your status line but pointed somewhere else, so it now points at this copy of juice.');
  } else {
    writeSettings(p, { ...settings, statusLine: { type: 'command', command, padding: 0, refreshInterval: REFRESH_SECONDS } });
    lines.push("juice is now your status line. It shows up the next time Claude Code redraws it, and the batteries fill in after Claude's first reply.");
  }
  if (fix && ours) lines.push(fix); // a first setup has no launcher yet: nothing to say about putting it back
  // Setup is where people go when the line looks empty, so it says why when juice was told to show nothing.
  const show = readJson(p.settingsFile)?.show;
  if (Array.isArray(show) && show.length === 0) lines.push(NOTHING_SHOWN);
  lines.push(...overrides(p, settings, cwd, platform));
  lines.push('To undo this, run /juice restore.');
  // The doctor sends people here for a status line problem, so it stops reporting it unless it happens again.
  try { unlinkSync(p.lastErrorFile); } catch {}
  return lines;
}

// Always leaves a way out: with no saved copy, juice is simply removed.
export function restore(p) {
  const { statusLine, ...rest } = readClaudeSettings(p);
  if (statusLine && !isJuice(statusLine)) return ["juice isn't your status line right now, so there is nothing to undo. Nothing changed."];
  const backup = readJson(p.backupFile);
  const saved = usableBackup(backup);
  const damaged = !saved && existsSync(p.backupFile); // kept, never deleted: it may still be read by hand
  if (!saved && !statusLine) {
    return [damaged ? "juice's saved copy of your old status line is damaged, so it can't be put back, and juice isn't your status line. Nothing changed."
      : 'There is no saved status line, so there is nothing to restore. Nothing changed.'];
  }
  // An older juice could save its own line as "the old one"; putting that back would undo nothing.
  const old = saved && !isJuice(backup.statusLine) ? backup.statusLine ?? null : null;
  writeSettings(p, old === null ? rest : { ...rest, statusLine: old });
  if (saved) unlinkSync(p.backupFile);
  try { unlinkSync(p.launcherFile); } catch {} // nothing runs it now; /juice setup writes it again
  return [old !== null ? 'Your old status line is back.'
    : saved && backup.statusLine === null ? 'Removed juice. You had no status line before, so none is set now.'
    : damaged ? `Removed juice. Its saved copy of your old status line is damaged, so it couldn't be put back; it is still in ${fwd(p.backupFile)}.`
    : 'Removed juice. No earlier status line was saved, so none is set now.',
  'To use juice again, run /juice setup.'];
}
