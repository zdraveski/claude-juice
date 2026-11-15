import { statSync } from 'node:fs';
import { sanitize } from './schema.js';
import { readJson, writeJsonAtomic } from './cache.js';

// Not existsSync: it is false for a file in a folder juice can't enter, too, and that one isn't missing.
const missing = (f) => { try { statSync(f); return false; } catch (e) { return e.code === 'ENOENT' || e.code === 'ENOTDIR'; } };

export function loadSettings(p) {
  const raw = readJson(p.settingsFile);
  const r = sanitize(raw, { allowBadges: true });
  if (raw === null && !missing(p.settingsFile)) r.warnings.push('juice.json is unreadable, using defaults');
  return r;
}

// Writes only the settings that changed, on top of the file as it is: a setting or value this version doesn't know
// (a newer juice's, from another window) is kept, never reset to a default. A file we couldn't read is never
// overwritten: that would replace the person's settings and badges with defaults.
export function saveSettings(p, changes) {
  const raw = readJson(p.settingsFile);
  if (raw === null && !missing(p.settingsFile)) {
    throw new Error("Your juice settings file (juice.json in your Claude folder) can't be read, so juice changed nothing. Fix or delete it (Claude can do it for you), then try again.");
  }
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  writeJsonAtomic(p.settingsFile, { ...base, ...changes });
}
