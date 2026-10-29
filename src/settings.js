import { existsSync } from 'node:fs';
import { sanitize } from './schema.js';
import { readJson, writeJsonAtomic } from './cache.js';

export function loadSettings(p) {
  const raw = readJson(p.settingsFile);
  const r = sanitize(raw, { allowBadges: true });
  if (raw === null && existsSync(p.settingsFile)) r.warnings.push('juice.json is unreadable, using defaults');
  return r;
}

export const saveSettings = (p, settings) => writeJsonAtomic(p.settingsFile, settings);
