import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { sanitize } from './schema.js';
import { readJson, writeJsonAtomic } from './cache.js';

// Why juice.json gave nothing. Not existsSync: it is false for a file in a folder juice can't enter, too, and that
// one may be there. "locked" is never told to delete the file: that would lose settings and badges.
const CODES = { ENOENT: 'missing', ENOTDIR: 'missing', EACCES: 'locked', EPERM: 'locked' };
// A file with nothing in it (a crash, a full disk) is as good as missing, as it is for settings.json.
const why = (f) => { try { return readFileSync(f, 'utf8').replace(/^\uFEFF/, '').trim() ? 'broken' : 'missing'; } catch (e) { return CODES[e.code] ?? 'broken'; } };
// JSON that is no settings object ([] or 42) is broken too: else set would replace it without a word.
const state = (raw, f) => (raw === null ? why(f) : (typeof raw !== 'object' || Array.isArray(raw)) && 'broken');

export function loadSettings(p) {
  const raw = readJson(p.settingsFile);
  const r = sanitize(raw, { allowBadges: true });
  const w = state(raw, p.settingsFile);
  if (w === 'broken') r.warnings.push('juice.json is unreadable, using defaults');
  if (w === 'locked') r.warnings.push("juice isn't allowed to read juice.json, using defaults");
  // The unreadable file may hold a no to the Fable login read, so never read the login on a guess.
  if (w === 'broken' || w === 'locked') r.settings.fable = 'off';
  return r;
}

// Writes only the settings that changed, on top of the file as it is: a setting or value this version doesn't know
// (a newer juice's, from another window) is kept, never reset to a default. A file we couldn't read is never
// overwritten: that would replace the person's settings and badges with defaults.
export function saveSettings(p, changes) {
  const raw = readJson(p.settingsFile), w = state(raw, p.settingsFile);
  if (w === 'locked') {
    throw new Error("juice can't read your juice settings file (juice.json in your Claude folder), so juice changed nothing. Make sure it and your Claude folder are yours and you can read them (Claude can help), then try again.");
  }
  if (w === 'broken') {
    throw new Error("Your juice settings file (juice.json in your Claude folder) can't be read, so juice changed nothing. Fix or delete it (Claude can do it for you), then try again.");
  }
  // Through a symlink (a dotfiles repo), so the link stays a link.
  writeJsonAtomic(existsSync(p.settingsFile) ? realpathSync(p.settingsFile) : p.settingsFile, { ...raw, ...changes });
}
