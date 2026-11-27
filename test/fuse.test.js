import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip, at } from './helpers.js';
import { render } from '../plugin/src/render/index.js';
import { palette } from '../plugin/src/render/palette.js';
import { vis, contrast } from '../plugin/src/render/ansi.js';
import { DEFAULTS, PRESET_IDS } from '../plugin/src/schema.js';
import { SAMPLES, withAccount } from '../plugin/src/samples.js';

const T = SAMPLES.trouble, B = SAMPLES.busy, Q = SAMPLES.quiet;
// Plain ends and no colour unless a test says otherwise: the line as its words and shapes.
const draw = (data, columns = 200, over = {}, term = {}) => render(data, { ...DEFAULTS, layout: 'fuse', ...over }, { columns, theme: 'dark', ends: 'plain', colorDepth: 'none', ...term });
const line = (...a) => draw(...a).text;
const lim = (d, id, v) => ({ ...d, limits: { ...d.limits, [id]: v } });
const EDGE = {
  fast: lim(B, 'session', { used: 40, resetsAt: at(210 * 60), windowSec: 18000 }), // amber, and it runs out
  twoOut: lim(T, 'week', { used: 99, resetsAt: at(26 * 3600), windowSec: 604800 }), // Weekly runs out while Session is dry
  usedUp: lim(T, 'session', { ...T.limits.session, used: 100 }),
  redLasts: lim(B, 'session', { used: 92, resetsAt: at(6 * 60), windowSec: 18000 }), // red, yet it lasts to the refill
  trail: lim(T, 'week', { used: 40, resetsAt: at(4.9 * 86400), windowSec: 604800 }), // amber Weekly that runs out, not focal
  gateway: { ...B, account: 'gateway', limits: { budget: { used: 93, resetsAt: at(9 * 86400), windowSec: null } } },
  payg: withAccount(B, 'payg'),
  memOnly: { ...Q, memoryUsed: 91 },
};

test('fuse: calm, busy and trouble at full width', () => {
  assert.equal(line(Q), '◆ Opus 5.5  ▂▃▁▁▁ medium  memory 18%  session 12% ◆┄│  fable 18% ◆┄┄│  weekly 35% ◆┄│');
  assert.equal(line(B), '◆ Opus 5.5  ▂▃▅▁▁ high  memory 64%  session 47% ◆│  fable 41% ◆┄│  Weekly 50%! ◆│ -4');
  assert.equal(line(T), '◆ Opus 5.5  ▂▃▅▆█ max  MEMORY 91%!!  SESSION 88%!! ━━╳┄┄┄┄┄┄○ ►2:44p ○4:25p  fable 62% ◆┄┄│  WEEKLY 95%!! │━◆►9:48p');
  assert.deepEqual(draw(T).dropped, []);
});

test('fuse: what a narrow window drops, step by step (trouble)', () => {
  const at = (w, text, dropped, over) => { const r = draw(T, w, over); assert.equal(r.text, text, String(w)); assert.deepEqual(r.dropped, dropped, String(w)); };
  at(96, '◆ Opus 5.5  ▂▃▅▆█  MEM 91%»  SES 88%» ━━╳┄┄┄┄┄┄○ ►2:44p  fab 62% ◆┄┄│  WK 95%» │━◆►9:48p', ['the refill time', 'the effort word', 'limit names']);
  at(76, '◆ Opus 5.5  ▂▃▅▆█  MEM 91%»  SES 88%» ━╳┄┄┄○ ►2:44p  fab 62%  WK 95%» ►9:48p', ['the refill time', 'the effort word', 'the fuse length', 'limit names', 'pace marks']);
  // A 60-column window: the fuse, every red limit as short capitals, the fine one gone. The fuse is long again: room came back.
  at(56, 'MEM 91%»  SES 88%» ━━╳┄┄┄┄┄┄○ ►2:44p  WK 95%» ►9:48p', ['the refill time', 'limit names', 'pace marks', 'the effort level', 'the model name', 'batteries that are fine']);
  at(44, 'MEM 91%»  SES 88%» ►2:44p  WK 95%» ►9:48p', ['the refill time', 'limit names', 'pace marks', 'the effort level', 'the model name', 'the fuse']);
  at(28, 'MEM 91%»  SES 88%»  WK 95%»', ['limit names', 'pace marks', 'the effort level', 'the model name', 'the fuse', 'run-out times and pace figures']);
  at(24, 'SES 88%»  WK 95%» …', ['limit names', 'pace marks', 'the effort level', 'the model name', 'the fuse', 'run-out times and pace figures', 'the end of the line']);
  // The cost loses its word first and is the last thing to go.
  at(116, '◆ Opus 5.5  ▂▃▅▆█  MEMORY 91%!!  SESSION 88%!! ━━╳┄┄┄┄┄┄○ ►2:44p  fable 62% ◆┄┄│  WEEKLY 95%!! │━◆►9:48p  $11.20', ['the refill time', 'the effort word', 'the cost word'], { cost: 'on' });
  at(56, 'MEM 91%»  SES 88%» ━╳┄┄┄○ ►2:44p  WK 95%» ►9:48p  $11.20', ['the refill time', 'the cost word', 'the fuse length', 'limit names', 'pace marks', 'the effort level', 'the model name', 'batteries that are fine'], { cost: 'on' });
  at(36, 'MEM 91%»  SES 88%»  WK 95%»  $11.20', ['the cost word', 'limit names', 'pace marks', 'the effort level', 'the model name', 'the fuse', 'run-out times and pace figures'], { cost: 'on' });
  assert.equal(line(T, 28, { cost: 'on' }), 'MEM 91%»  SES 88%»  WK 95%»');
});

test('fuse: a calm or busy line in a narrow window keeps every limit while it can', () => {
  assert.equal(line(B, 76), '◆ Opus 5.5  ▂▃▅▁▁  mem 64%  ses 47% ◆│  fab 41% ◆┄│  Wk 50%› ◆│ -4');
  assert.equal(line(B, 56), '◆ Opus 5.5  ▂▃▅▁▁  mem 64%  ses 47%  fab 41%  Wk 50%› -4');
  assert.equal(line(B, 44), 'mem 64%  ses 47%  fab 41%  Wk 50%› -4');
  assert.equal(line(B, 36), 'Weekly 50%! -4'); // room came back, so the name is long again
  assert.equal(line(Q, 56), '◆ Opus 5.5  ▂▃▁▁▁  mem 18%  ses 12%  fab 18%  wk 35%');
});

test('fuse: the edge cases each draw their own way', () => {
  const full = (d) => line(d, 200, { cost: 'on' });
  assert.match(full(EDGE.fast), /Session 40%! ━━━━━━╳┄┄○ ►4:35p ○5:50p  fable 41% ◆┄│  Weekly 50%! ◆│ -4 {3}\$3\.42 value$/);
  // Two run-outs on one fuse: Weekly's falls in Session's dry wait, and Weekly still says its own time.
  assert.match(full(EDGE.twoOut), /SESSION 88%!! ━━╳┄┄┄╳┄┄○ ►2:44p ○4:25p .* WEEKLY 99%!! │━◆►3:46p/);
  assert.equal(line(EDGE.twoOut, 56, { cost: 'on' }), 'MEM 91%»  SES 88%» ━╳┄╳┄○ ►2:44p  WK 99%» ►3:46p  $11.20');
  assert.match(full(EDGE.usedUp), /SESSION 100%!! ╳┄┄┄┄┄┄┄┄○ ►now ○4:25p/);
  assert.match(full(EDGE.redLasts), /SESSION 92%!! ━━━━━━━━━○ ○2:26p/);
  // An amber limit that runs out, beside the fuse: gauge and trail fill six cells up to its time, then its pace.
  assert.match(full(EDGE.trail), /Weekly 40%! │◆››››►Sat 5:56p \+10 {2}\$11\.20 value$/);
  assert.match(line(EDGE.trail, 116, { cost: 'on' }), /Weekly 40%! │◆►Sat 5:56p \+10 {2}\$11\.20$/); // squeezed: no trail
  assert.match(line(EDGE.trail, 76), /Wk 40%› ►Sat 5:56p$/); // one slot: the time, not the pace
  // With the cost on, 56 columns cannot hold both: the amber limit goes and the fuse stays.
  assert.equal(line(EDGE.trail, 56, { cost: 'on' }), 'MEMORY 91%!!  SESSION 88%!! ━━╳┄┄┄┄┄┄○ ►2:44p  $11.20');
  // Memory and Budget have no pace: no fuse, no gauge. Memory alone in the red gets no fuse either.
  assert.equal(full(EDGE.gateway), '◆ Opus 5.5  ▂▃▅▁▁ high  memory 64%  BUDGET 93%!!  $3.42 value');
  assert.equal(full(EDGE.payg), '◆ Opus 5.5  ▂▃▅▁▁ high  memory 64%  spent $3.42');
  assert.equal(line(EDGE.memOnly), '◆ Opus 5.5  ▂▃▁▁▁ medium  MEMORY 91%!!  session 12% ◆┄│  fable 18% ◆┄┄│  weekly 35% ◆┄│');
});

test('fuse: limits keep the order you chose, and move only when you ask', () => {
  const order = (over) => line(T, 200, over).match(/memory|session|fable|weekly/gi).map((x) => x.toLowerCase());
  assert.deepEqual(order({}), ['memory', 'session', 'fable', 'weekly']);
  assert.deepEqual(order({ order: 'urgent' }), ['session', 'weekly', 'memory', 'fable']);
});

test('fuse: every width from 20 to 250 fits, cuts between items, and hides no red limit from 28 up', () => {
  const REDS = { trouble: 3, twoOut: 3, usedUp: 3, trail: 2 };
  for (const [name, d] of Object.entries({ ...SAMPLES, ...EDGE })) for (const cost of ['auto', 'on']) for (const ends of ['round', 'plain']) for (let w = 20; w <= 250; w++) {
    const t = line(d, w, { cost }, { ends }), where = `${name}/${cost}/${ends}/${w}: ${t}`;
    assert.ok(vis(t) <= w, where);
    if (t.endsWith('…')) assert.match(t, / …$/, where);
    assert.doesNotMatch(t, /^\s|\s$/, where);
    if (REDS[name] && w >= 28) assert.equal((t.match(/\d+%(?:!!|»)/g) || []).length, REDS[name], where);
    if (cost === 'on' && w >= 36) assert.match(t, /\$/, where);
    // Names are all long or all short, never mixed.
    const names = t.match(/\b(?:memory|session|weekly|fable|budget|mem|ses|wk|fab|bud)\b/gi) || [];
    assert.ok(new Set(names.map((x) => x.length <= 3)).size <= 1, where);
  }
});

test('fuse: every colour the limits and the cost use reads at 4.5:1, on dark and light, in every colour set', () => {
  const faint = { dark: { plentyLeft: '#333333', goingFast: '#333333', almostEmpty: '#333333', accent: '#333333' }, light: { plentyLeft: '#eeeeee', goingFast: '#eeeeee', almostEmpty: '#eeeeee', accent: '#eeeeee' } };
  const show = DEFAULTS.show.filter((id) => id !== 'model' && id !== 'effort'); // the head is the shared one, not Fuse's
  for (const theme of ['dark', 'light']) for (const colors of [...PRESET_IDS.filter((id) => id !== 'terminal'), faint]) for (const [name, d] of Object.entries({ ...SAMPLES, ...EDGE })) {
    const settings = { ...DEFAULTS, layout: 'fuse', cost: 'on', colors, show }, bg = palette(settings, theme).bg;
    const raw = render(d, settings, { columns: 200, theme, ends: 'plain', colorDepth: 'truecolor' }).text;
    for (const [, r, g, b] of raw.matchAll(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g)) {
      const hex = '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join('');
      assert.ok(contrast(hex, bg) >= 4.5, `${theme}/${typeof colors === 'string' ? colors : 'faint'}/${name}: ${hex} is ${contrast(hex, bg).toFixed(2)}`);
    }
  }
});

test('fuse: red is bold capitals, and 256 and 16 colours keep every glyph', () => {
  const tc = draw(T, 200, {}, { colorDepth: 'truecolor' }).text;
  assert.ok(tc.includes('\x1b[1mSESSION\x1b[22m') && tc.includes('\x1b[1mWEEKLY\x1b[22m') && !tc.includes('\x1b[1mfable'));
  const c256 = draw(T, 200, {}, { colorDepth: '256' }).text;
  assert.doesNotMatch(c256, /38;2;/);
  assert.equal(strip(c256), strip(tc));
  const c16 = draw(T, 200, { colors: 'terminal' }, { colorDepth: 'truecolor' }).text;
  assert.doesNotMatch(c16, /38;[25];/);
  assert.equal(strip(c16), strip(tc));
  assert.match(c16, /\x1b\[1;91;49mSESSION/); // bright red, bold kept
});
