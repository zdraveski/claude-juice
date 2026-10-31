import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJsonAtomic } from './cache.js';

export const fwd = (s) => s.replaceAll(String.fromCharCode(92), '/');
const LAUNCHER_TEMPLATE = fileURLToPath(new URL('../bin/launcher.js', import.meta.url));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// Claude Code only redraws on events, so without a timer the countdowns freeze while it is idle.
const REFRESH_SECONDS = 60;

// A symlinked settings.json must stay a symlink, so write to what it points at.
const writeSettings = (p, v) => writeJsonAtomic(existsSync(p.claudeSettings) ? realpathSync(p.claudeSettings) : p.claudeSettings, v);

export class NeedsConfirm extends Error {}

// Missing file counts as {}; anything unparseable or not an object aborts before we write anything.
// PowerShell 5.1 writes a BOM, so strip one.
function readClaudeSettings(p) {
  if (!existsSync(p.claudeSettings)) return {};
  let v;
  try { v = JSON.parse(readFileSync(p.claudeSettings, 'utf8').replace(/^﻿/, '')); } catch { v = null; }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`Your Claude Code settings file (${p.claudeSettings}) isn't valid JSON, so juice left everything alone. Fix or remove that file and try again.`);
  }
  return v;
}

export function install(p, { pluginRoot, inPluginCache, yes = false }) {
  const settings = readClaudeSettings(p);
  const command = `node "${fwd(p.launcherFile)}"`;
  const ours = settings.statusLine?.command === command;
  const lines = [];

  const old = ours ? null : readJson(p.backupFile);
  const stale = !!old && 'statusLine' in old && !same(settings.statusLine, old.statusLine);
  if (stale && !yes) throw new NeedsConfirm('Your status line has changed since juice saved a copy of the old one, so juice changed nothing. Run setup again with --yes to save your current status line too (the earlier copy is kept under a new name) and switch to juice.');

  const template = readFileSync(LAUNCHER_TEMPLATE, 'utf8');
  const literal = 'const PINNED = null;';
  if (!inPluginCache && !template.includes(literal)) throw new Error("juice's launcher template is damaged. Reinstall the plugin.");
  // A replacer function stops $' and $& in the path being expanded.
  const launcher = inPluginCache ? template : template.replace(literal, () => `const PINNED = ${JSON.stringify(fwd(pluginRoot))};`);
  mkdirSync(dirname(p.launcherFile), { recursive: true });
  writeFileSync(p.launcherFile, launcher);

  if (stale) {
    renameSync(p.backupFile, p.backupFile.replace(/\.json$/, `-${Date.now()}.json`));
    lines.push('Kept the earlier saved copy next to it under a new name.');
  }
  if (!ours && (stale || !existsSync(p.backupFile))) {
    writeJsonAtomic(p.backupFile, { statusLine: settings.statusLine ?? null, savedAt: new Date().toISOString() });
    lines.push(settings.statusLine ? 'Saved your current status line so you can get it back.' : 'You had no status line, so there is nothing to save.');
  }
  if (ours && settings.statusLine.refreshInterval) lines.push('juice is already your status line. Nothing changed.');
  else if (ours) {
    writeSettings(p, { ...settings, statusLine: { ...settings.statusLine, refreshInterval: REFRESH_SECONDS } });
    lines.push('juice now refreshes once a minute, so the reset countdowns stay current.');
  } else {
    writeSettings(p, { ...settings, statusLine: { type: 'command', command, padding: 0, refreshInterval: REFRESH_SECONDS } });
    lines.push('juice is now your status line. It shows up the next time Claude Code redraws it.');
  }
  lines.push('To go back to your old status line, run /juice restore.');
  return lines;
}

export function restore(p) {
  const backup = readJson(p.backupFile);
  if (!backup || !('statusLine' in backup)) return ['There is no saved status line, so there is nothing to restore. Nothing changed.'];
  const { statusLine, ...rest } = readClaudeSettings(p);
  if (statusLine && statusLine.command !== `node "${fwd(p.launcherFile)}"`) return ["juice isn't your status line right now, so there is nothing to undo. Nothing changed."];
  writeSettings(p, backup.statusLine === null ? rest : { ...rest, statusLine: backup.statusLine });
  unlinkSync(p.backupFile);
  return [backup.statusLine === null
    ? 'Removed juice. You had no status line before, so none is set now.'
    : 'Your old status line is back.',
  'To use juice again, run /juice setup.'];
}
