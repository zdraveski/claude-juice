import { readFileSync } from 'node:fs';
import { sanitize } from './schema.js';
import { readJson, writeJsonAtomic } from './cache.js';

// Why juice.json gave nothing. Not existsSync: it is false for a file in a folder juice can't enter, too, and that
// one may be there. "locked" is never told to delete the file: that would lose settings and badges.
const CODES = { ENOENT: 'missing', ENOTDIR: 'missing', EACCES: 'locked', EPERM: 'locked' };
const why = (f) => { try { readFileSync(f); return 'broken'; } catch (e) { return CODES[e.code] ?? 'broken'; } };

export function loadSettings(p) {
  const raw = readJson(p.settingsFile);
  const r = sanitize(raw, { allowBadges: true });
  const w = raw === null && why(p.settingsFile);
  if (w === 'broken') r.warnings.push('juice.json is unreadable, using defaults');
  if (w === 'locked') r.warnings.push("juice isn't allowed to read juice.json, using defaults");
  return r;
}

// Writes only the settings that changed, on top of the file as it is: a setting or value this version doesn't know
// (a newer juice's, from another window) is kept, never reset to a default. A file we couldn't read is never
// overwritten: that would replace the person's settings and badges with defaults.
export function saveSettings(p, changes) {
  const raw = readJson(p.settingsFile), w = raw === null && why(p.settingsFile);
  if (w === 'locked') {
    throw new Error("juice can't read your juice settings file (juice.json in your Claude folder), so juice changed nothing. Make sure it and your Claude folder are yours and you can read them (Claude can help), then try again.");
  }
  if (w === 'broken') {
    throw new Error("Your juice settings file (juice.json in your Claude folder) can't be read, so juice changed nothing. Fix or delete it (Claude can do it for you), then try again.");
  }
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  writeJsonAtomic(p.settingsFile, { ...base, ...changes });
}
