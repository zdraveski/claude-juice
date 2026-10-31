import { homedir } from 'node:os';
import { join } from 'node:path';

// The home folder written as ~ (with either slash), so text juice shows or saves never carries the person's name.
export function hideHome(text, env = process.env) {
  const homes = [homedir(), env?.HOME, env?.USERPROFILE].filter((h) => typeof h === 'string' && h.length > 1)
    .flatMap((h) => [h, h.replaceAll('\\', '/')]).sort((a, b) => b.length - a.length);
  return homes.reduce((s, h) => s.replaceAll(h, '~'), text);
}

export function paths(env = process.env) {
  const config = env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return {
    config,
    settingsFile: join(config, 'juice.json'),
    cacheDir: join(config, 'juice-cache'),
    backupFile: join(config, 'juice-backup.json'),
    launcherFile: join(config, 'juice-statusline.mjs'),
    claudeSettings: join(config, 'settings.json'),
  };
}
