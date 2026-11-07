import './helpers.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip, at, fixture, NOW } from './helpers.js';
import { normalize } from '../src/data.js';

const TERM = { columns: 200, theme: 'dark', ends: 'round', colorDepth: 'truecolor' };
import { render } from '../src/render/index.js';
import { LAYOUTS } from '../src/render/layouts.js';
import { DEFAULTS, LAYOUT_IDS, applySet } from '../src/schema.js';
import { SAMPLES, withAccount } from '../src/samples.js';
import { fg, contrast } from '../src/render/ansi.js';
import { palette, NEUTRAL, makeCtx } from '../src/render/palette.js';

const term = { columns: 200, theme: 'dark', ends: 'round', colorDepth: 'truecolor' };
const run = (data, over = {}, t = {}) => render(data, { ...DEFAULTS, ...over }, { ...term, ...t }).text;
const text = (...a) => strip(run(...a));
const inOrder = (s, parts) => parts.reduce((from, p) => {
  const i = s.indexOf(p, from);
  assert.ok(i >= 0, `"${p}" not found in order in: ${s}`);
  return i + p.length;
}, 0);

test('bar busy max reads in order', () => {
  inOrder(text(SAMPLES.busy), ['Opus 5.5', 'high', 'Memory', '64%', 'Session', '47%', 'resets in 2h 10m', 'Fable', '41%', 'Weekly', '50%', 'resets Sat 7:20 PM']);
  assert.equal(text(SAMPLES.busy).match(/resets /g).length, 2, 'Fable resets with Weekly, so it has no countdown of its own');
});
test('bar trouble shows the warnings', () => {
  const s = text(SAMPLES.trouble);
  for (const w of ['summary soon', 'resets in 2h 5m', 'resets Thu 4:20 PM']) assert.ok(s.includes(w), w);
});
test('refills warnings shows the countdown only where it matters', () => {
  const s = text(SAMPLES.busy, { refills: 'warnings' });
  assert.ok(!s.includes('resets in 2h 10m') && s.includes('resets Sat 7:20 PM'), s);
});
test('Fable keeps its own countdown when Weekly is hidden or resets at another time', () => {
  assert.ok(text(SAMPLES.busy, { show: ['memory', 'session', 'fable'] }).includes('resets Sat 7:20 PM'));
  const apart = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, resetsAt: at(104400) } } };
  assert.ok(text(apart).includes('resets Thu 7:20 PM'));
});
test('warnings do not rely on colour alone: ! going fast, !! nearly out', () => {
  const busy = text(SAMPLES.busy);
  assert.equal((busy.match(/!/g) || []).length, 1, busy);
  assert.match(busy, /Weekly \S+ ! resets Sat 7:20 PM/);
  const trouble = text(SAMPLES.trouble);
  for (const name of ['Memory', 'Session', 'Weekly']) assert.match(trouble, new RegExp(`${name} \\S+ !!`), name);
  for (const layout of LAYOUT_IDS) assert.ok(text(SAMPLES.trouble, { layout }).includes('!!'), layout);
  const fable = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, used: 97 } } };
  assert.match(text(fable), /Fable \S+ !!/, 'Fable keeps its warning even with no countdown');
});
test('Fable has its own colour while fine, and warns like the others when not', () => {
  const v = (t) => { const n = parseInt(NEUTRAL[t].fable.slice(1), 16); return `;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`; };
  for (const layout of ['bar', 'segments', 'panel']) {
    const s = run(SAMPLES.busy, { layout });
    assert.ok(s.includes(v('dark')), layout);
    assert.ok(!run(SAMPLES.busy, { layout, show: ['memory', 'session', 'week'] }).includes(v('dark')), `${layout}: only Fable is violet`);
    assert.ok(run(SAMPLES.busy, { layout }, { theme: 'light' }).includes(v('light')), `${layout} light`);
  }
  const low = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, fable: { ...SAMPLES.busy.limits.fable, used: 93 } } };
  for (const layout of LAYOUT_IDS) assert.ok(!run(low, { layout }).includes(v('dark')), layout);
});
test('focus busy', () => {
  const s = text(SAMPLES.busy, { layout: 'focus' });
  inOrder(s, ['Weekly', '50% used ! · resets Sat 7:20 PM', 'Memory 64%', 'Session 47%', 'Fable 41%']);
});
test('pills: a capsule per battery, filled with colour when it needs you; only the most urgent says its times', () => {
  const s = text(SAMPLES.trouble, { layout: 'pills' });
  inOrder(s, ['Opus 5.5', 'Memory 91% !!', 'Session 88% !!', 'runs out ~2:44 PM · resets in 2h 5m', 'Fable 62%', 'Weekly 95% !!']);
  assert.equal(s.match(/runs out|resets/g).length, 2, s);
  const raw = run(SAMPLES.trouble, { layout: 'pills' }), P = palette(DEFAULTS, 'dark');
  const bgOf = (h) => `48;2;${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(';')}m`;
  assert.ok(raw.includes(bgOf(P.bad)) && raw.includes(bgOf(P.casing)), 'red capsules filled, the fine one dark');
  assert.ok(raw.includes('') && !run(SAMPLES.trouble, { layout: 'pills' }, { ends: 'plain' }).includes(''), 'rounded ends only where they can be drawn');
});
test('tank: shows what is left, and the gauge empties as the battery is used', () => {
  inOrder(text(SAMPLES.busy, { layout: 'tank' }), ['Memory ▰▱▱▱ 36% left', 'Session ▰▰▱▱ 53% left', 'Fable ▰▰▱▱ 59% left', 'Weekly ▰▰▱▱ 50% left! resets Sat 7:20 PM']);
  assert.match(text(SAMPLES.trouble, { layout: 'tank' }), /Weekly ▰▱▱▱ 5% left!!/, 'a little left keeps one cell lit');
  const empty = { ...SAMPLES.busy, limits: { ...SAMPLES.busy.limits, session: { ...SAMPLES.busy.limits.session, used: 100 } } };
  assert.match(text(empty, { layout: 'tank' }), /Session ▱▱▱▱ 0% left!!/);
});
test('order: yours keeps show, urgent puts what needs you first, fullest the most used', () => {
  const lim = (used, secs, windowSec) => ({ used, resetsAt: at(secs), windowSec });
  const mixed = { ...SAMPLES.busy, memoryUsed: 74, limits: { session: lim(72, 7200, 18000), week: lim(48, 259200, 604800), fable: lim(83, 259200, 604800) } };
  const names = (order) => text(mixed, { layout: 'segments', order }).match(/Memory|Session|Fable|Weekly/g);
  assert.deepEqual(names('yours'), ['Memory', 'Session', 'Fable', 'Weekly']);
  assert.deepEqual(names('urgent'), ['Session', 'Fable', 'Memory', 'Weekly'], 'red first, the one that runs out soonest leading');
  assert.deepEqual(names('fullest'), ['Fable', 'Memory', 'Session', 'Weekly']);
});
test('panel busy', () => {
  const lines = text(SAMPLES.busy, { layout: 'panel' }).split('\n');
  assert.equal(lines.length, 5);
  assert.ok(lines[1].startsWith('Memory') && lines[1].includes('64% used') && lines[1].includes('in this chat'));
  const f = lines.find((l) => l.startsWith('Fable weekly'));
  assert.ok(f && !f.includes('resets'), f);
  assert.ok(lines.findIndex((l) => l.startsWith('Fable')) < lines.findIndex((l) => l.startsWith('Weekly')));
  assert.equal(new Set(lines.slice(1).map((l) => l.search(/[▆■]/))).size, 1, 'battery bars line up');
});
test('segments busy', () => inOrder(text(SAMPLES.busy, { layout: 'segments' }), ['Session', '47%', 'resets in 2h 10m']));
test('show order and omission', () => {
  const s = text(SAMPLES.busy, { show: ['model', 'effort', 'week', 'session'] });
  assert.ok(s.indexOf('Week') < s.indexOf('Session'));
  assert.ok(!s.includes('Memory'));
});
test('payg', () => {
  const s = text(withAccount(SAMPLES.busy, 'payg'));
  assert.ok(!s.includes('Session') && !s.includes('Week'));
  assert.ok(s.includes('spent $3.42'));
});
test('cost on/auto for a subscriber', () => {
  assert.ok(text(SAMPLES.busy, { cost: 'on' }).includes('$3.42 value'));
  assert.ok(!text(SAMPLES.busy, { cost: 'auto' }).includes('$'));
  assert.ok(!text(withAccount(SAMPLES.busy, 'payg'), { cost: 'off' }).includes('$'));
  assert.ok(!text({ ...SAMPLES.busy, costUsd: null }, { cost: 'on' }).includes('$'));
});
test('fable model highlights the Fable battery', () => {
  const s = run({ ...SAMPLES.busy, model: { name: 'Fable 5.1', isFable: true } });
  assert.ok(s.includes(fg(palette(DEFAULTS, 'dark').accent, 'Fable')));
});
test('plain ends', () => assert.ok(!/[]/.test(run(SAMPLES.busy, {}, { ends: 'plain' }))));
test('light theme', () => assert.ok(run(SAMPLES.busy, {}, { theme: 'light' }).includes('38;2;29;138;78')));
test('badges first', () => assert.ok(text({ ...SAMPLES.busy, badges: ['[RTK 98 ↓61%]'] }).startsWith('[RTK 98 ↓61%]')));
test('no effort', () => {
  const s = text({ ...SAMPLES.busy, effort: null });
  assert.ok(!/[▂▃▅▆]/.test(s) && !s.includes('high'));
});
test('model names', () => {
  assert.ok(text({ ...SAMPLES.busy, model: { name: 'Haiku 5.5', isFable: false } }).includes('Haiku 5.5'));
  assert.ok(text({ ...SAMPLES.busy, model: { name: 'Sonnet 5.5', isFable: false } }).includes('Sonnet 5.5'));
});
test('LAYOUTS keys match LAYOUT_IDS', () => assert.deepEqual(Object.keys(LAYOUTS), [...LAYOUT_IDS]));
test('256 colour output has no truecolor escapes', () => assert.ok(!/38;2;/.test(run(SAMPLES.busy, {}, { colorDepth: '256' }))));
test('unknown layout falls back to bar', () => assert.equal(run(SAMPLES.busy, { layout: 'nope' }), run(SAMPLES.busy)));
test('without colour (NO_COLOR, plain previews) there are no escape codes and unlit cells differ by shape', () => {
  const t = run(SAMPLES.busy, { layout: 'segments' }, { colorDepth: 'none', ends: 'plain' });
  assert.ok(!t.includes('\x1b'), t);
  assert.match(t, /Session +▊▊░░░■ 47%/, 'two of five lit, the rest drawn as ░');
  assert.match(run(SAMPLES.busy, { layout: 'panel' }, { colorDepth: 'none' }), /▆░/);
});

test('a cost of $0.00 is never shown: before the first reply it says nothing about money', () => {
  const d = { ...SAMPLES.busy, account: 'payg', limits: {}, costUsd: 0 };
  assert.ok(!text(d).includes('$'), text(d));
  assert.match(text({ ...d, costUsd: 1.25 }), /spent \$1\.25/);
});

const lim = (used, s, windowSec) => ({ used, resetsAt: at(s), windowSec });
const locked = (limits, model = SAMPLES.busy.model) => ({ ...SAMPLES.busy, model, limits });

test('a used-up limit shows even in a look that leaves it out', () => {
  const t = text(locked({ session: lim(10, 4 * 3600, 18000), week: lim(100, 2 * 86400, 604800) }), applySet(DEFAULTS, ['look=basics']).settings);
  assert.match(t, /Weekly .*100%.*!!/, t);
  const fable = locked({ session: lim(10, 4 * 3600, 18000), week: lim(30, 3 * 86400, 604800), fable: lim(100, 3 * 86400, 604800) }, { name: 'Fable 5.1', isFable: true });
  assert.match(text(fable, applySet(DEFAULTS, ['look=quiet']).settings), /Fable .*100%/, 'while Fable is in use');
  assert.doesNotMatch(text({ ...fable, model: SAMPLES.busy.model }, applySet(DEFAULTS, ['look=quiet']).settings), /Fable/, 'not while another model is in use');
  // A company's spending cap at 100% blocks too.
  const spent = { ...SAMPLES.busy, account: 'gateway', limits: { budget: lim(100, 5 * 86400, null) } };
  assert.match(text(spent, { show: ['model', 'memory', 'session', 'week'] }), /Budget .*100%/);
});

test('a used-up limit gets the spotlight before one that merely runs out later', () => {
  const t = text(locked({ session: lim(100, 3600, 18000), week: lim(70, 3.5 * 86400, 604800) }), { layout: 'focus' });
  assert.match(t, /│ {3}Session .*100% used !!/, t);
});

test('Fable keeps its countdown when Weekly is not actually showing one', () => {
  const d = locked({ session: lim(10, 4 * 3600, 18000), week: lim(20, 3 * 86400, 604800), fable: lim(100, 3 * 86400, 604800) });
  const t = text(d, { refills: 'warnings' });
  assert.match(t.split('Weekly')[0], /Fable .*!! resets Sat 2:20 PM/, t);
});

test('spotlight goes to the red battery that runs out first, not just the fullest', () => {
  const t = text(SAMPLES.trouble, { layout: 'focus' });
  assert.match(t, /│ {3}Session .*■ 88% used !! · runs out ~2:44 PM .*│ {3}Weekly 95%!!/, t);
});

test('grey labels and countdowns are readable (WCAG AA, 4.5:1) on both default backgrounds', () => {
  for (const t of ['dark', 'light']) assert.ok(contrast(NEUTRAL[t].mute, NEUTRAL[t].bg) >= 4.5, t);
});

test('gateway shows Budget', () => {
  const d = { ...SAMPLES.busy, account: 'gateway', limits: { budget: { used: 20, resetsAt: null, windowSec: null } } };
  assert.ok(text(d).includes('Budget'));
  assert.ok(!text({ ...d, account: 'subscriber' }).includes('Budget'), 'Budget is for gateway accounts only');
});
test('fit flags hide things', async () => {
  const { makeCtx } = await import('../src/render/palette.js');
  const ctx = makeCtx({ ...SAMPLES.busy, badges: ['[B]'] }, { ...DEFAULTS }, term);
  ctx.fit = { noRefills: true, noEffortWord: true, noModel: true, badges: true };
  const s = strip(LAYOUTS.bar({ ...SAMPLES.busy, badges: ['[B]'] }, ctx));
  assert.ok(!s.includes('resets in 2h 10m') && !s.includes('high') && !s.includes('Opus') && !s.includes('[B]'), s);
  assert.ok(s.includes('resets Sat 7:20 PM'), 'a battery going fast keeps its countdown');
});

test('64.1 used renders as 64% used in every layout; token memory is whole', () => {
  const d = normalize({ ...fixture('busy'), context_window: { used_percentage: 64.1 } }, {}, NOW);
  assert.equal(d.memoryUsed, 64);
  for (const layout of LAYOUT_IDS) {
    const s = strip(render(d, { ...DEFAULTS, layout }, TERM).text);
    assert.match(s, layout === 'tank' ? /36% left/ : /64%/, layout); // the tank shows what is left
    assert.doesNotMatch(s, /\d\.\d{3,}/, layout);
  }
  const t = normalize({ context_window: { context_window_size: 3, current_usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }, {}, NOW);
  assert.equal(t.memoryUsed, 33);
});

test('an empty badge leaves no gap at the start of the line', () => {
  const d = { ...normalize(fixture('busy'), {}, NOW), badges: ['', ''] };
  for (const layout of LAYOUT_IDS) {
    const s = strip(render(d, { ...DEFAULTS, layout }, TERM).text);
    assert.doesNotMatch(s, /^\s/, layout);
  }
});

test('before the first reply the line says the batteries are coming, and stops once memory arrives', () => {
  const fresh = { ...SAMPLES.busy, memoryUsed: null, limits: {} };
  assert.match(text(fresh), /Opus 5\.5.*high {4}batteries appear after Claude's first reply$/);
  assert.ok(!text({ ...fresh, memoryUsed: 3 }).includes('first reply'), 'an API key after its first reply');
  assert.ok(!text(fresh, {}, { columns: 40 }).includes('first reply'), 'only when it fits');
});

test('the model sits on a chip, and hiding the model hides the chip', () => {
  assert.ok(text(SAMPLES.busy).startsWith('\ue0b6◆ Opus 5.5\ue0b4'), text(SAMPLES.busy));
  assert.ok(!text(SAMPLES.busy, { show: ['effort', 'memory', 'session'] }).includes('◆'));
  for (const columns of [30, 40, 50]) {
    const r = render(SAMPLES.trouble, DEFAULTS, { ...term, columns });
    if (!strip(r.text).includes('Opus')) assert.ok(!strip(r.text).includes('◆'), `${columns}: ${strip(r.text)}`);
  }
});

test('bar: items divided by a dim │, plain gaps once spacing is squeezed', () => {
  const r = render(SAMPLES.busy, DEFAULTS, term), ctx = makeCtx(SAMPLES.busy, DEFAULTS, term);
  assert.ok(strip(r.text).includes('  │  Session'), strip(r.text));
  assert.ok(r.text.includes(fg(ctx.P.groove, '  │  ')), 'the divider is groove-coloured');
  const tight = render(withAccount(SAMPLES.trouble, 'pro'), DEFAULTS, { ...term, columns: 80 });
  assert.ok(tight.dropped.includes('spacing'), tight.dropped.join());
  assert.ok(!strip(tight.text).includes(' │ '), strip(tight.text));
});

// Review: without colour the divider was the same │ as the pace tick.
test('bar without colour has no divider, so a │ is always the pace tick', () => {
  const t = text(SAMPLES.busy, {}, { colorDepth: 'none' });
  assert.ok(!t.includes('  │  '), t);
  assert.ok(t.includes('│47%'), 'the tick is still there');
});

test('a form draws in Status bar and Tightest first, the number after it, the warning mark kept', () => {
  inOrder(text(SAMPLES.busy, { battery: 'slider' }), ['Session ', '●', ' 47%', 'Weekly ', '●', ' 50%']);
  assert.ok(!text(SAMPLES.busy, { battery: 'slider' }).includes('■'), 'no battery nub');
  assert.match(text(SAMPLES.trouble, { battery: 'dots' }), /Session [•·]+ \d+% !!/);
  const focus = text(SAMPLES.busy, { layout: 'focus', battery: 'pie' });
  assert.match(focus, /[○◔◑◕●] \d+% used/);
  assert.ok(!focus.includes('■'));
});
