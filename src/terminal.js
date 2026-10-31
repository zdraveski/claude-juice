import { readJson } from './cache.js';

// Claude Code sets COLUMNS to the whole terminal, then indents the status line, so a line that full gets cut.
// shortcut: a fixed few columns; a notice Claude Code shows on the same row can still cut a long line.
const RESERVE = 4;

export function readClaudeTheme(file) {
  const t = readJson(file)?.theme;
  return typeof t === 'string' ? t : null;
}

// Claude Code's "auto" theme (or none set) follows the terminal; many terminals report their background
// in COLORFGBG as "fg;bg", where 7 and 15 are the light greys and white.
const lightTerminal = (env) => ['7', '15'].includes(String(env.COLORFGBG ?? '').split(';').pop());

function theme(setting, claudeTheme, env) {
  if (setting === 'dark' || setting === 'light') return setting;
  if (typeof claudeTheme === 'string' && claudeTheme.startsWith('light')) return 'light';
  if (claudeTheme === null || claudeTheme === 'auto') return lightTerminal(env) ? 'light' : 'dark';
  return 'dark';
}

export function detectTerminal({ env, settings, claudeTheme }) {
  const cols = parseInt(env.COLUMNS, 10);
  return {
    columns: Math.max(20, (Number.isFinite(cols) && cols > 0 ? cols : 120) - RESERVE),
    theme: theme(settings.terminal, claudeTheme, env),
    ends: ['round', 'plain'].includes(settings.ends) ? settings.ends : env.TERM_PROGRAM === 'vscode' ? 'round' : 'plain',
    // NO_COLOR (no-color.org): any non-empty value means no colour codes at all.
    // Windows Terminal draws full colour but doesn't announce it in COLORTERM.
    colorDepth: env.NO_COLOR ? 'none'
      : env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit' || !!env.WT_SESSION ? 'truecolor' : '256',
  };
}
