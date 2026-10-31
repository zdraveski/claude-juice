import { existsSync } from 'node:fs';
import { sanitize } from './schema.js';
import { readJson, writeJsonAtomic } from './cache.js';

export function loadSettings(p) {
  const raw = readJson(p.settingsFile);
  const r = sanitize(raw, { allowBadges: true });
  if (raw === null && existsSync(p.settingsFile)) r.warnings.push('juice.json is unreadable, using defaults');
  return r;
}

// Writes only the settings that changed, on top of the file as it is: a setting or value this version doesn't know
// (a newer juice's, from another window) is kept, never reset to a default. A file we couldn't read is never
// overwritten: that would replace the person's settings and badges with defaults.
export function saveSettings(p, changes) {
  const raw = readJson(p.settingsFile);
  if (existsSync(p.settingsFile) && raw === null) {
    throw new Error("Your juice settings file (juice.json in your Claude folder) can't be read, so juice changed nothing. Fix or delete it (Claude can do it for you), then try again.");
  }
  const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  writeJsonAtomic(p.settingsFile, { ...base, ...changes });
}
