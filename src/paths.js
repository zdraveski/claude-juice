import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// The home folder written as ~ (with either slash), so text juice shows or saves never carries the person's name.
// Windows ignores case in paths, and an app may start Claude Code in c:\users\… while home reads C:\Users\….
export function hideHome(text, env = process.env, platform = process.platform) {
  const homes = [homedir(), env?.HOME, env?.USERPROFILE].filter((h) => typeof h === 'string' && h.length > 1)
    .flatMap((h) => [h, h.replaceAll('\\', '/')]).sort((a, b) => b.length - a.length);
  const flags = platform === 'win32' ? 'gi' : 'g';
  return homes.reduce((s, h) => s.replace(new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags), '~'), text);
}

export function paths(env = process.env) {
  // Full path: a relative CLAUDE_CONFIG_DIR would write a launcher command that only works from one folder.
  const config = env.CLAUDE_CONFIG_DIR ? resolve(env.CLAUDE_CONFIG_DIR) : join(homedir(), '.claude');
  return {
    config,
    settingsFile: join(config, 'juice.json'),
    cacheDir: join(config, 'juice-cache'),
    fableFile: join(config, 'juice-cache', 'fable.json'),
    lastErrorFile: join(config, 'juice-cache', 'last-error.json'),
    backupFile: join(config, 'juice-backup.json'),
    launcherFile: join(config, 'juice-statusline.mjs'),
    claudeSettings: join(config, 'settings.json'),
  };
}
