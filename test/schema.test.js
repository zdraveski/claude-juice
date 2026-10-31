import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, LAYOUT_IDS, PRESET_IDS, LOOKS, sanitize, applySet, toCommand, encodeLink, parseLink, CUSTOMIZER_URL } from '../src/schema.js';

const A = { plentyLeft: '#11AA22', goingFast: '#223344', almostEmpty: '#abcdef', accent: '#000000' };
const custom = { dark: A, light: { ...A, accent: '#ffffff' } };

test('ids and url', () => {
  assert.deepEqual(LAYOUT_IDS, ['bar', 'segments', 'focus', 'panel']);
  assert.deepEqual(PRESET_IDS, ['claude', 'frost', 'calm', 'safe', 'bold', 'ocean', 'midnight', 'vampire', 'candy', 'forest', 'sunset', 'solar', 'rose']);
  assert.match(CUSTOMIZER_URL, /^https:\/\//);
});

test('sanitize defaults and unknown keys', () => {
  assert.deepEqual(sanitize({}, { allowBadges: true }).settings, DEFAULTS);
  const r = sanitize({ layout: 'xyz', foo: 1 }, { allowBadges: true });
  assert.equal(r.settings.layout, 'bar');
  assert.ok(!('foo' in r.settings));
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /layout/);
});

test('sanitize non-objects give defaults', () => {
  for (const x of [null, 'x', 5, []]) assert.deepEqual(sanitize(x, { allowBadges: true }).settings, DEFAULTS);
});

test('sanitize show', () => {
  const r = sanitize({ show: ['week', 'memory', 'week', 'nope'] }, { allowBadges: true });
  assert.deepEqual(r.settings.show, ['week', 'memory']);
  assert.deepEqual(sanitize({ show: 'week' }, { allowBadges: true }).settings.show, DEFAULTS.show);
});

test('sanitize colours', () => {
  assert.deepEqual(sanitize({ colors: custom }, { allowBadges: true }).settings.colors, custom);
  assert.equal(sanitize({ colors: 'bold' }, { allowBadges: true }).settings.colors, 'bold');
  const bad = sanitize({ colors: { dark: { ...A, accent: '#12345' }, light: A } }, { allowBadges: true });
  assert.equal(bad.settings.colors, 'claude');
  assert.equal(bad.warnings.length, 1);
  assert.equal(sanitize({ colors: 'nope' }, { allowBadges: true }).settings.colors, 'claude');
});

test('sanitize other enums fall back', () => {
  const r = sanitize({ cost: 'x', ends: 'x', terminal: 'x', refills: 'x', fable: 'x' }, { allowBadges: true });
  assert.deepEqual(r.settings, DEFAULTS);
  assert.equal(r.warnings.length, 5);
  const old = sanitize({ clock: '24h' }, { allowBadges: true });
  assert.deepEqual([old.settings, old.warnings], [DEFAULTS, []], 'an old clock setting is ignored quietly');
  assert.ok(!('clock' in DEFAULTS));
});

test('sanitize badges', () => {
  const x = { badges: [{ command: 'echo hi' }] };
  assert.deepEqual(sanitize(x, { allowBadges: false }).settings.badges, []);
  assert.deepEqual(sanitize(x, { allowBadges: true }).settings.badges, [{ command: 'echo hi' }]);
  const bad = sanitize({ badges: [{ command: '' }, { command: 'a'.repeat(501) }, { command: 5 }, 'x', { command: 'ok' }] }, { allowBadges: true });
  assert.deepEqual(bad.settings.badges, [{ command: 'ok' }]);
});

test('applySet', () => {
  const r = applySet(DEFAULTS, ['layout=panel', 'ends=plain']);
  assert.deepEqual(r.changed, ['layout', 'ends']);
  assert.equal(r.settings.layout, 'panel');
  assert.equal(DEFAULTS.layout, 'bar');
  assert.deepEqual(applySet(DEFAULTS, ['layout=bar']).changed, []);
  assert.deepEqual(applySet(DEFAULTS, ['show=week,memory,week']).settings.show, ['week', 'memory']);
  assert.throws(() => applySet(DEFAULTS, ['badges=x']), { message: 'Badges can only be added with /juice badges add' });
});

const LOOK_KEYS = ['layout', 'show', 'colors', 'cost', 'refills', 'ends'];

test('looks: twelve, each sets exactly the six look keys to valid values', () => {
  assert.deepEqual(LOOKS.map((l) => l.id), ['juice', 'basics', 'spotlight', 'everything', 'retro', 'quiet', 'nightowl', 'easy', 'colorblind', 'anywhere', 'costwatch', 'fablefirst']);
  for (const l of LOOKS) {
    assert.ok(l.name && l.note, l.id);
    assert.deepEqual(Object.keys(l.set).sort(), [...LOOK_KEYS].sort(), l.id);
    const r = sanitize(l.set, { allowBadges: false });
    assert.deepEqual(r.warnings, [], l.id);
    for (const k of LOOK_KEYS) assert.deepEqual(r.settings[k], l.set[k], `${l.id}.${k}`);
  }
  const juice = LOOKS.find((l) => l.id === 'juice').set;
  for (const k of LOOK_KEYS) assert.deepEqual(juice[k], DEFAULTS[k], k);
});

test('applySet look: sets the six keys, leaves the rest, later pairs win', () => {
  const quiet = LOOKS.find((l) => l.id === 'quiet').set;
  const start = { ...DEFAULTS, terminal: 'light', fable: 'off' };
  const r = applySet(start, ['look=quiet']);
  for (const k of LOOK_KEYS) assert.deepEqual(r.settings[k], quiet[k], k);
  assert.equal(r.settings.terminal, 'light');
  assert.equal(r.settings.fable, 'off');
  assert.deepEqual(r.changed, ['show', 'colors', 'refills']);
  assert.equal(applySet(start, ['look=quiet', 'colors=ocean']).settings.colors, 'ocean');
  const back = applySet(r.settings, ['look=juice']);
  for (const k of LOOK_KEYS) assert.deepEqual(back.settings[k], DEFAULTS[k], k);
  back.settings.show.push('x');
  assert.ok(!LOOKS.find((l) => l.id === 'juice').set.show.includes('x'), 'look data must not be shared');
});

test('applySet unknown look keeps settings and warns', () => {
  const r = applySet(DEFAULTS, ['look=nope']);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.settings, DEFAULTS);
  assert.match(r.warnings[0], /look: 'nope' isn't a look/);
});

test('applySet bad values and keys keep current value', () => {
  const r = applySet(DEFAULTS, ['layout=xyz', 'nope=1', 'noequals', 'ends=plain']);
  assert.equal(r.settings.layout, 'bar');
  assert.deepEqual(r.changed, ['ends']);
  assert.equal(r.warnings.length, 3);
  assert.deepEqual(applySet(DEFAULTS, ['show=nope']).changed, []);
  assert.equal(applySet(DEFAULTS, ['colors=dark:#12,#1,#1,#1/light:#1']).settings.colors, 'claude');
});

test('applySet colours', () => {
  assert.equal(applySet(DEFAULTS, ['colors=calm']).settings.colors, 'calm');
  const w = 'colors=dark:#11aa22,#223344,#abcdef,#000000/light:#11aa22,#223344,#abcdef,#ffffff';
  assert.deepEqual(applySet(DEFAULTS, [w]).settings.colors, {
    dark: { plentyLeft: '#11aa22', goingFast: '#223344', almostEmpty: '#abcdef', accent: '#000000' },
    light: { plentyLeft: '#11aa22', goingFast: '#223344', almostEmpty: '#abcdef', accent: '#ffffff' },
  });
});

test('toCommand', () => {
  // The public page starts at Automatic: pasting a look from it keeps the person's own terminal colour.
  assert.equal(toCommand(DEFAULTS), '/juice set layout=bar show=model,effort,memory,session,fable,week,budget cost=auto colors=claude ends=auto refills=always');
  const mine = applySet({ ...DEFAULTS, fable: 'on', terminal: 'light' }, toCommand(DEFAULTS).split(' ').slice(2)).settings;
  assert.deepEqual([mine.fable, mine.terminal], ['on', 'light'], 'neither their fable nor their terminal choice is undone');
  // Choosing Automatic on the page does say so, and undoes Light.
  const chosen = applySet({ ...DEFAULTS, terminal: 'light' }, toCommand(DEFAULTS, { terminalChosen: true }).split(' ').slice(2)).settings;
  assert.equal(chosen.terminal, 'auto');
  assert.match(toCommand({ ...DEFAULTS, terminal: 'light' }), /terminal=light/);
  assert.doesNotMatch(toCommand({ ...DEFAULTS, fable: 'on' }), /fable=/);
});

test('an all-wrong show= list says which names are right, in plain words', () => {
  const w = applySet(DEFAULTS, ['show=sesion,weekly']).warnings.join();
  assert.match(w, /'sesion', 'weekly' isn't a battery name .*Weekly is "week".*so nothing changed/);
  assert.doesNotMatch(w, /\[/, 'no raw JSON');
});

test('toCommand round-trips through applySet, custom colours too (everything but fable)', () => {
  const s = { ...DEFAULTS, layout: 'focus', show: ['week', 'model'], cost: 'on', colors: { dark: A, light: custom.light }, ends: 'round', terminal: 'light', refills: 'warnings', fable: 'off' };
  const lower = applySet(DEFAULTS, toCommand(s).split(' ').slice(2)).settings;
  assert.deepEqual(lower, { ...sanitize(s, { allowBadges: true }).settings, fable: DEFAULTS.fable });
  assert.equal(toCommand(s).split(' ').length, 9);
});

test('a share link never switches on Fable, which reads the login', () => {
  const raw = JSON.parse(atob(encodeLink({ ...DEFAULTS, fable: 'on' }).replace(/-/g, '+').replace(/_/g, '/')));
  assert.equal('fable' in raw, false);
  const crafted = btoa(JSON.stringify({ fable: 'on', layout: 'panel' })).replace(/=+$/, '');
  assert.deepEqual([parseLink(crafted).fable, parseLink(crafted).layout], ['auto', 'panel']);
});

test('a misspelt battery name is left out with a warning, never silently', () => {
  const r = applySet(DEFAULTS, ['show=memory,sesion']);
  assert.deepEqual(r.settings.show, ['memory']);
  assert.match(r.warnings.join(), /'sesion' isn't a battery name/);
  assert.match(sanitize({ show: ['week', 'wekly'] }, { allowBadges: true }).warnings.join(), /'wekly' isn't a battery name/);
  assert.deepEqual(applySet(DEFAULTS, ['show=memory,session']).warnings, []);
});

test('links', () => {
  const s = { ...DEFAULTS, layout: 'panel', colors: custom, badges: [{ command: 'echo hi' }] };
  const p = encodeLink(s);
  assert.match(p, /^[A-Za-z0-9_-]+$/);
  const want = { ...s, badges: [] };
  assert.deepEqual(parseLink(p), want);
  assert.deepEqual(parseLink('#c=' + p), want);
  for (const bad of ['###', '', undefined]) assert.throws(() => parseLink(bad), String(bad));
  assert.deepEqual(parseLink(encodeLink({ ...DEFAULTS, show: ['model', 'ünï'] })).show, ['model']);
});

test('links never carry badges: not in what juice writes, and not taken from a hand-built one', () => {
  const raw = JSON.parse(atob(encodeLink({ ...DEFAULTS, badges: [{ command: 'echo secret' }] }).replace(/-/g, '+').replace(/_/g, '/')));
  assert.equal('badges' in raw, false, 'the shared URL itself holds no badge commands');
  const evil = btoa(JSON.stringify({ badges: [{ command: 'rm -rf /' }] })).replace(/=+$/, '');
  assert.deepEqual(parseLink(evil).badges, []);
});

test('applySet ignores prototype names and bare words without throwing', () => {
  for (const p of ['constructor=x', '__proto__=x', 'toString=x', 'hasOwnProperty=x', 'valueOf=x', 'badgess', 'bare', '=x']) {
    const r = applySet(DEFAULTS, [p]);
    assert.deepEqual(r.changed, [], p);
    assert.equal(r.warnings.length, 1, p);
    assert.deepEqual(Object.keys(r.settings), Object.keys(DEFAULTS), p);
  }
});

// The /juice skill can't run code to look these up, so its lists must match the code exactly.
test('the /juice skill numbers the looks and names the colour sets exactly as the code does', async () => {
  const { readFileSync } = await import('node:fs');
  const { PRESETS } = await import('../src/render/palette.js');
  const skill = readFileSync(new URL('../skills/juice/SKILL.md', import.meta.url), 'utf8');
  const numbered = /numbered list: ([^(]+?) \(/.exec(skill)[1].split(', ').map((x) => x.split(' ')[1]);
  assert.deepEqual(numbered, LOOKS.map((l) => l.id));
  for (const id of PRESET_IDS) assert.ok(skill.includes(`${id} (${PRESETS[id].name}`), `colour set ${id} (${PRESETS[id].name}) is not named in the skill`);
});
