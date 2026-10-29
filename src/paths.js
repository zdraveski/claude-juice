import { homedir } from 'node:os';
import { join } from 'node:path';

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
