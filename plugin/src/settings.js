import { existsSync, realpathSync } from 'node:fs';
import { sanitize, applySet } from './schema.js';
import { readOwnJson, writeJsonAtomic } from './cache.js';

// juice.json as juice uses it, from one read. "locked" is never told to delete the file: that would lose settings and badges.
function fromRead({ state, value }) {
  const r = sanitize(value, { allowBadges: true });
  if (state === 'broken') r.warnings.push('juice.json is unreadable, using defaults');
  if (state === 'locked') r.warnings.push("juice isn't allowed to read juice.json, using defaults");
  // The unreadable file may hold a no to the Fable login read, so never read the login on a guess.
  if (state === 'broken' || state === 'locked') r.settings.fable = 'off';
  return r;
}

export const loadSettings = (p) => fromRead(readOwnJson(p.settingsFile));

// Changes juice.json from one read of it. decide gets { file, settings, warnings }: the file's own values and what juice
// makes of them, and returns { changes, ...anything } with only the settings to write. They go on top of the file as it
// is: a setting or value this version doesn't know (a newer juice's, from another window) is kept, never reset to a
// default. A file we couldn't read is never overwritten: that would replace the person's settings and badges with defaults.
// Returns what decide returned.
export function updateSettings(p, decide) {
  const read = readOwnJson(p.settingsFile);
  const r = decide({ file: read.value ?? {}, ...fromRead(read) });
  if (!Object.keys(r.changes).length) return r;
  if (read.state === 'locked') {
    throw new Error("juice can't read your juice settings file (juice.json in your Claude folder), so juice changed nothing. Make sure it and your Claude folder are yours and you can read them (Claude can help), then try again.");
  }
  if (read.state === 'broken') {
    throw new Error("Your juice settings file (juice.json in your Claude folder) can't be read, so juice changed nothing. Fix or delete it (Claude can do it for you), then try again.");
  }
  // Through a symlink (a dotfiles repo), so the link stays a link.
  writeJsonAtomic(existsSync(p.settingsFile) ? realpathSync(p.settingsFile) : p.settingsFile, { ...read.value, ...r.changes });
  return r;
}

// /juice set key=value...: writes only what was asked for, and only where the file says otherwise (a value juice couldn't
// use reads as its default, so choosing that default still has to be written). Everything else stays as it was.
// changed: what juice uses changed (applySet's list), or a value it couldn't use was replaced. warnings: the file's,
// minus those about values just replaced, then the new values'.
export function setSettings(p, args) {
  return updateSettings(p, ({ file, settings: before, warnings: was }) => {
    const { settings, warnings, chosen, changed: moved } = applySet(before, args);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const write = chosen.filter((k) => !same(file[k], settings[k]));
    return {
      changes: Object.fromEntries(write.map((k) => [k, settings[k]])),
      settings, chosen,
      changed: write.filter((k) => moved.includes(k) || Object.hasOwn(file, k)),
      warnings: [...was.filter((w) => !write.some((k) => w.startsWith(`${k}:`))), ...warnings],
    };
  });
}
