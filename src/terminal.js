import { readJson } from './cache.js';

export function readClaudeTheme(file) {
  const t = readJson(file)?.theme;
  return typeof t === 'string' ? t : null;
}

export function detectTerminal({ env, settings, claudeTheme }) {
  const cols = parseInt(env.COLUMNS, 10);
  const pick = (v, ok) => (ok.includes(v) ? v : null);
  return {
    columns: Number.isFinite(cols) && cols > 0 ? cols : 120,
    theme: pick(settings.terminal, ['dark', 'light'])
      ?? (typeof claudeTheme === 'string' && claudeTheme.startsWith('light') ? 'light' : 'dark'),
    ends: pick(settings.ends, ['round', 'plain']) ?? (env.TERM_PROGRAM === 'vscode' ? 'round' : 'plain'),
    // Windows Terminal draws full colour but doesn't announce it in COLORTERM.
    colorDepth: env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit' || !!env.WT_SESSION ? 'truecolor' : '256',
  };
}
