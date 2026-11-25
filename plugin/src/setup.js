import { existsSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readJson, writeJsonAtomic, writeAtomic } from './cache.js';
import { NOTHING_SHOWN } from './schema.js';
import { loadSettings } from './settings.js';
import { fwd, launcherTarget, launcherFor } from './launcher-file.js';
import { inspectInstall, isJuice, samePath } from './install.js';

// Keys in another order (a hand edit, another tool) are the same status line.
const sorted = (_, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v);
const same = (a, b) => JSON.stringify(a ?? null, sorted) === JSON.stringify(b ?? null, sorted);
// What setup acts on: the Install as it is now, or the reason settings.json can't be read.
const look = (p, opts) => { const s = inspectInstall(p, opts); if (s.error) throw s.error; return s; };
// Claude Code only redraws on events, so without a timer the countdowns freeze while it is idle.
// With motion on, every second moves the climb: two redraws per step (CLIMB_MS in render/pieces.js), so a step is never skipped.
// Every time juice itself writes or wrote (60 up to 1.2.2 and from 1.4.0, 30 in 1.3.0, 1 in 1.3.1), so juice may move it;
// any other time was chosen by hand and stays.
export const JUICE_REFRESH = [1, 30, 60];
// A refresh time Claude Code uses: at least one second (a hand-typed "60", -5 or 0.5 is ignored by it).
export const refreshes = (statusLine) => Number.isFinite(statusLine?.refreshInterval) && statusLine.refreshInterval >= 1;
const keepsRefresh = (statusLine) => refreshes(statusLine) && !JUICE_REFRESH.includes(statusLine.refreshInterval);
export const refreshFor = (statusLine, motion) => (keepsRefresh(statusLine) ? statusLine.refreshInterval : motion === 'on' ? 1 : 60);
export const refreshWords = (seconds) => (seconds === 1 ? 'every second' : seconds === 60 ? 'once a minute' : `every ${seconds} seconds`);

// A symlinked settings.json must stay a symlink, so write to what it points at.
const writeSettings = (p, v, opts) => writeJsonAtomic(existsSync(p.claudeSettings) ? realpathSync(p.claudeSettings) : p.claudeSettings, v, opts);

// The shell Claude Code runs the status line in (Git Bash on Windows, sh elsewhere) would change a $ or a
// backtick inside the quoted path, cmd a %, and a " would end the quotes, so such a path can't be set up safely.
// (On Windows backslashes never reach the shell: the command is written with forward slashes. On Linux and macOS a
// backslash is part of the name, and inside double quotes the shell keeps a single one (shortcut: a doubled one would be halved).)
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

// Sets the refresh of this folder's juice line to what motion wants, unless it was chosen by hand. Run by set motion, and
// once after each update (1.3.x wrote every second, which costs CPU while the line stands still).
// Throws on a broken settings.json. Returns { seconds, kept: false } when it wrote the time, { seconds, kept: true } when
// the person's own time stays, or null when there was nothing to change.
// write: HOT_WRITE from a refresh, which must not wait on a file another program holds open.
export function matchRefresh(p, { platform = process.platform, write } = {}) {
  const { settings, line, owner } = look(p, { platform });
  if (owner !== 'here') return null;
  const want = refreshFor(line, loadSettings(p).settings.motion);
  // A time the person chose stays, and set motion says so: else motion=on looks broken with no word.
  if (line.refreshInterval === want) return keepsRefresh(line) ? { seconds: want, kept: true } : null;
  writeSettings(p, { ...settings, statusLine: { ...line, refreshInterval: want } }, write);
  return { seconds: want, kept: false };
}

export function install(p, { pluginRoot, yes = false, platform = process.platform, env = process.env, cwd = process.cwd() }) {
  const s = look(p, { platform, env }), { settings, command } = s;
  if (SHELL_UNSAFE.test(p.launcherFile)) {
    throw new Error(`Your Claude Code folder (${fwd(p.config)}) has a $, \`, % or " in its path, which would break the status line, so juice changed nothing. Point CLAUDE_CONFIG_DIR at a folder without them and run setup again.`);
  }
  const ours = s.owner === 'here' || s.owner === 'elsewhere';
  const lines = [];

  // A backup that exists but can't be read is set aside like a stale one, so the current line is still saved.
  const backupThere = s.backup.there;
  const old = s.backup.value;
  const usable = !ours && s.backup.usable;
  const damaged = !ours && backupThere && !usable;
  const stale = usable && !same(settings.statusLine, old.statusLine);
  if (stale && !yes) throw new NeedsConfirm('Your status line has changed since juice saved a copy of the old one, so juice changed nothing. Run setup again with --yes to save your current status line too (the earlier copy is kept under a new name) and switch to juice.');

  const launcher = launcherFor(pluginRoot);
  // Said in every case below: what the launcher runs really changed, or it was missing or from an older juice.
  const before = s.launcher.text;
  const fix = before === null || !launcherTarget(before) ? 'Its launcher file was missing or from an older juice, so juice put it back.'
    : launcherTarget(before) !== launcherTarget(launcher) ? 'It now uses the juice you just ran setup from.' : '';
  if (stale || damaged) {
    const aside = p.backupFile.replace(/\.json$/, `-${Date.now()}.json`);
    renameSync(p.backupFile, aside);
    lines.push(damaged ? `juice's saved copy of your old status line was damaged, so juice set it aside as ${basename(aside)} in your Claude folder.`
      : `Kept the earlier saved copy as ${basename(aside)} in your Claude folder.`);
  }
  if (!ours && (stale || damaged || !backupThere)) {
    // As private as settings.json itself: the old status line command can hold a key.
    writeJsonAtomic(p.backupFile, { statusLine: settings.statusLine ?? null, savedAt: new Date().toISOString() }, { modeFrom: p.claudeSettings });
    lines.push(!settings.statusLine ? 'You had no status line, so there is nothing to save.'
      : s.restorable ? 'Saved your current status line so you can get it back.'
      // Kept all the same: restore never writes such a line back, so it can't be promised.
      : "Your status line wasn't valid for Claude Code, so /juice restore won't put it back. It is kept in juice-backup.json in your Claude folder.");
  }
  // Written only once the old line is saved. A settings.json juice can't save must not leave the launcher pointing
  // at this copy of juice either.
  writeAtomic(p.launcherFile, launcher);
  const save = (s) => {
    try { writeSettings(p, s); } catch (e) {
      try { if (before === null) unlinkSync(p.launcherFile); else writeAtomic(p.launcherFile, before); } catch {}
      throw e;
    }
  };
  const current = s.current;
  // Another tool's refresh time was chosen for that tool, so a first setup starts from juice's own.
  const want = refreshFor(ours ? settings.statusLine : null, loadSettings(p).settings.motion);
  if (current && settings.statusLine.refreshInterval === want) lines.push(fix ? 'juice is already your status line.' : 'juice is already your status line. Nothing changed.');
  else if (current) {
    save({ ...settings, statusLine: { ...settings.statusLine, refreshInterval: want } });
    lines.push(want === 1 ? 'juice now refreshes every second, so its pictures climb and its numbers stay current.'
      : 'juice now refreshes once a minute, so its numbers and reset times stay current while Claude Code is idle.');
  } else if (ours) {
    // A juice line pointing elsewhere (settings copied from another machine, a renamed user folder) draws nothing;
    // one with the right launcher but an older way of finding Node just gets the current one.
    const sameLauncher = s.owner === 'here';
    save({ ...settings, statusLine: { ...settings.statusLine, command, refreshInterval: want } });
    lines.push(sameLauncher ? 'juice is your status line, now set up to find Node even when Claude Code starts from an app.'
      : 'juice was your status line but pointed somewhere else, so it now points at this copy of juice.');
  } else {
    save({ ...settings, statusLine: { type: 'command', command, padding: 0, refreshInterval: want } });
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
  const s = look(p), { statusLine, ...rest } = s.settings;
  if (s.owner === 'other') return ["juice isn't your status line right now, so there is nothing to undo. Nothing changed."];
  const backup = s.backup.value;
  const saved = s.backup.usable;
  const damaged = !saved && s.backup.there; // kept, never deleted: it may still be read by hand
  if (!saved && !statusLine) {
    return [damaged ? "juice's saved copy of your old status line is damaged, so it can't be put back, and juice isn't your status line. Nothing changed."
      : 'There is no saved status line, so there is nothing to restore. Nothing changed.'];
  }
  // An older juice could save its own line as "the old one"; putting that back would undo nothing.
  const old = saved && !isJuice(backup.statusLine) ? backup.statusLine ?? null : null;
  writeSettings(p, old === null ? rest : { ...rest, statusLine: old });
  if (saved) try { unlinkSync(p.backupFile); } catch {} // the old line is back already: a stuck copy must not stop the rest
  try { unlinkSync(p.launcherFile); } catch {} // nothing runs it now; /juice setup writes it again
  return [old !== null ? 'Your old status line is back.'
    : saved && backup.statusLine === null ? 'Removed juice. You had no status line before, so none is set now.'
    : damaged ? `Removed juice. Its saved copy of your old status line is damaged, so it couldn't be put back; it is still in ${fwd(p.backupFile)}.`
    : 'Removed juice. No earlier status line was saved, so none is set now.',
  'To use juice again, run /juice setup.'];
}
