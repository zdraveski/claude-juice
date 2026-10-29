// Test card for the release checklist's terminal matrix: run `node scripts/terminal-check.js` in each terminal
// (dark and light theme) and answer the numbered questions. Prints what juice would pick on its own there too.
import { render } from '../src/render/index.js';
import { DEFAULTS, SHOW_IDS } from '../src/schema.js';
import { SAMPLES } from '../src/samples.js';
import { detectTerminal } from '../src/terminal.js';

const env = process.env;
const auto = detectTerminal({ env, settings: DEFAULTS, claudeTheme: null });
const line = (o) => render(SAMPLES.busy, { ...DEFAULTS, show: [...SHOW_IDS] }, { columns: 200, colorDepth: 'truecolor', ...o }).text;
// Clay to violet in 48 steps: smooth only with full (24-bit) colour.
const strip = Array.from({ length: 48 }, (_, i) => {
  const t = i / 47, c = [[226, 167], [136, 139], [95, 250]].map(([a, b]) => Math.round(a + (b - a) * t));
  return `\x1b[48;2;${c.join(';')}m \x1b[49m`;
}).join('');
const name = env.TERM_PROGRAM === 'vscode' ? 'VS Code' : env.WT_SESSION ? 'Windows Terminal' : env.TERM_PROGRAM || 'unknown';

console.log(`Terminal: ${name}  (TERM_PROGRAM=${env.TERM_PROGRAM ?? '-'}, COLORTERM=${env.COLORTERM ?? '-'}, WT_SESSION=${env.WT_SESSION ? 'set' : '-'})`);
console.log(`juice would pick here on its own: ends ${auto.ends}, colours ${auto.colorDepth}`);
const ask = (n, q, text) => console.log(`\n${n}. ${q}\n   ${text}`);
ask(1, 'Is this strip a smooth fade from orange to violet, with no visible steps?', strip);
ask(2, 'Rounded ends: do the batteries have round ends (not boxes or question marks)?', line({ theme: 'dark', ends: 'round' }));
ask(3, 'Plain ends: does this look clean?', line({ theme: 'dark', ends: 'plain' }));
ask(4, 'Light-theme colours: with a light terminal background, is this easy to read?', line({ theme: 'light', ends: 'round' }));
ask(5, '256 colours (used when juice can\'t tell): does this still look right?', line({ theme: 'dark', ends: 'plain', colorDepth: '256' }));
console.log('\nAnswer like: 1 yes, 2 yes, 3 yes, 4 yes, 5 yes');
