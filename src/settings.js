import { existsSync } from 'node:fs';
import { sanitize } from './schema.js';
import { readJson, writeJsonAtomic } from './cache.js';

export function loadSettings(p) {
  const raw = readJson(p.settingsFile);
  const r = sanitize(raw, { allowBadges: true });
  if (raw === null && existsSync(p.settingsFile)) r.warnings.push('juice.json is unreadable, using defaults');
  return r;
}

// Saving over a file we couldn't read would replace the person's settings and badges with defaults.
export function saveSettings(p, settings) {
  if (existsSync(p.settingsFile) && readJson(p.settingsFile) === null) {
    throw new Error(`Your juice settings file (${p.settingsFile}) can't be read, so juice changed nothing. Fix or delete that file and try again.`);
  }
  writeJsonAtomic(p.settingsFile, settings);
}
