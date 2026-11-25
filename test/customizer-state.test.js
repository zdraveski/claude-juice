// The customizer's state (web/state.js) and the rules it shares with /juice set, without a browser.
// The page's wiring of each one is checked by scripts/check-customizer.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reset, chooseLook, choose, toggleBattery, moveBattery, dropBattery, choosePreset, setCustom, startFrom, previewOf, offered } from '../web/state.js';
import { toCommand, hidesStyle, readability, applySet, encodeLink, DEFAULTS, LOOKS } from '../plugin/src/schema.js';
import { PRESETS } from '../plugin/src/render/palette.js';

const cmd = (st) => toCommand(st.s, st);

test('a look sets what it sets; another look afterwards undoes Sand, and only Sand', () => {
  let st = chooseLook(reset(), 'sand');
  assert.equal(st.s.battery, 'sand');
  st = chooseLook(st, 'juice');
  assert.equal(st.s.battery, 'glossy');
  st = chooseLook(choose(st, 'battery', 'pie'), 'juice');
  assert.equal(st.s.battery, 'pie', 'a style the person picked stays');
});

test('the battery-style hint shows only when a picked style is hidden, and agrees with /juice set', () => {
  let st = choose(reset(), 'layout', 'segments');
  assert.equal(hidesStyle(st.s), false, 'the default style: nothing to warn about');
  st = choose(st, 'battery', 'pie');
  assert.equal(hidesStyle(st.s), true);
  assert.match(applySet(choose(reset(), 'battery', 'pie').s, ['layout=segments']).warnings.join(), /styles show in Status bar and Tightest first/);
  assert.equal(hidesStyle(choose(st, 'layout', 'focus').s), false);
});

test('batteries move one step, drop onto a row to take its place, and never past either end', () => {
  let st = reset();
  assert.deepEqual(st.order, ['memory', 'session', 'fable', 'week']);
  assert.equal(dropBattery(st, 'memory', 'memory'), st, 'dropped onto itself: nothing moves');
  st = dropBattery(st, 'week', 'memory');
  assert.deepEqual(st.order, ['week', 'memory', 'session', 'fable']);
  assert.match(cmd(st), /show=model,effort,week,memory,session,fable,budget /);
  st = moveBattery(st, 'session', -1);
  assert.deepEqual(st.order, ['week', 'session', 'memory', 'fable']);
  // Dragged down onto the last row, it takes the last place (1.4.0 stopped one short).
  st = dropBattery(st, 'week', 'fable');
  assert.deepEqual(st.order, ['session', 'memory', 'fable', 'week']);
  assert.equal(moveBattery(st, 'week', 1), st);
  assert.equal(moveBattery(st, 'session', -1), st);
});

test('a battery switched off keeps its place, and with everything off nothing shows', () => {
  let st = toggleBattery(reset(), 'session');
  assert.ok(!st.s.show.includes('session'));
  st = toggleBattery(st, 'session');
  assert.deepEqual(st.s.show, reset().s.show);
  for (const id of reset().s.show) st = toggleBattery(st, id);
  assert.deepEqual(st.s.show, []);
});

test('terminal= and motion= join the command only once chosen, and Reset forgets that', () => {
  let st = reset();
  assert.doesNotMatch(cmd(st), /motion=|terminal=/, 'a page left at its start keeps what they set before');
  st = choose(st, 'motion', 'off');
  assert.match(cmd(st), / motion=off$/);
  st = choose(st, 'terminal', 'auto');
  assert.match(cmd(st), /terminal=auto/);
  assert.match(cmd(chooseLook(st, 'juice')), /motion=off/, 'a look keeps what was chosen');
  assert.doesNotMatch(cmd(reset()), /motion=|terminal=/);
});

test('colour sets fill the pickers; a picker changes one colour of one terminal', () => {
  let st = choosePreset(reset(), 'calm');
  assert.equal(st.s.colors, 'calm');
  st = setCustom(st, 'dark', 0, '#111111');
  assert.equal(st.s.colors.dark.plentyLeft, '#111111');
  assert.deepEqual(Object.values(st.s.colors.light), PRESETS.calm.light, 'the light terminal keeps the set it had');
  assert.deepEqual(Object.values(st.s.colors.dark).slice(1), PRESETS.calm.dark.slice(1));
  assert.equal(choosePreset(st, 'custom').s.colors.dark.plentyLeft, '#111111', 'Your own brings the pickers back');
});

test('readability: the same bar the page marks and /juice set warns at', () => {
  assert.equal(readability('#707070', 'dark').level, 'faint');
  assert.equal(readability('#404040', 'dark').level, 'hard');
  assert.equal(readability('#ffffff', 'dark').level, 'ok');
  assert.match(applySet(reset().s, ['colors=dark:#404040,#ffffff,#ffffff,#ffffff/light:#000000,#000000,#000000,#000000']).warnings.join(), /hard to read on a dark terminal/);
});

test('the page starts from a valid link, else the saved settings, else the defaults, and says when a link was damaged', () => {
  const linked = applySet(DEFAULTS, ['layout=panel']).settings, saved = applySet(DEFAULTS, ['layout=tank']).settings;
  const savedText = JSON.stringify(saved), hash = '#c=' + encodeLink(linked);
  const start = (h, text) => { const { st, damaged } = startFrom(h, text); return [st.s.layout, damaged]; };
  assert.deepEqual(start(hash, savedText), ['panel', false], 'a valid link wins over what was saved');
  assert.deepEqual(start(hash.slice(0, 8), savedText), ['tank', true], 'a link cut short: the saved settings, and a word why');
  assert.deepEqual(start('', savedText), ['tank', false], 'no link: the saved settings');
  assert.deepEqual(start('', '{not json'), [DEFAULTS.layout, false], 'damaged saved settings: the defaults');
  assert.deepEqual(start('', null), [DEFAULTS.layout, false], 'nothing saved: the defaults');
  assert.deepEqual(startFrom('', JSON.stringify({ ...saved, badges: [{ command: 'echo hi' }] })).st.s.badges, [], 'saved settings never bring badges');
  // What was chosen stays chosen across an address change.
  assert.equal(startFrom(hash, null, choose(reset(), 'motion', 'on')).st.motionChosen, true);
});

// ---------- the preview ----------
const VIEW = { state: 'busy', term: 'dark', width: 'wide', plan: 'max', model: 'Opus 5.5', hover: null };

test('the preview draws with a chosen terminal colour; Automatic follows the Dark/Light switch again', () => {
  const light = choose(reset(), 'terminal', 'light');
  assert.equal(previewOf(light.s, VIEW).term, 'light', 'a chosen colour beats the switch');
  assert.equal(previewOf(choose(light, 'terminal', 'auto').s, VIEW).term, 'dark', 'back on Automatic, the switch decides');
  assert.equal(previewOf(reset().s, { ...VIEW, term: 'light' }).term, 'light');
  assert.equal(previewOf(startFrom(encodeLink(light.s), null).st.s, VIEW).term, 'light', 'a link made for a light terminal previews as light');
});

test('a hovered look or layout is tried on top of the chosen settings and named', () => {
  const s = reset().s, plain = previewOf(s, VIEW);
  assert.equal(plain.previewing, null);
  const look = previewOf(s, { ...VIEW, hover: 'look:sand' });
  assert.equal(look.previewing, LOOKS.find((l) => l.id === 'sand').name);
  assert.notEqual(look.text, plain.text);
  assert.equal(previewOf(s, { ...VIEW, hover: 'layout:panel' }).previewing, 'Panel');
  assert.equal(previewOf(s, { ...VIEW, hover: 'look:nope' }).text, plain.text, 'an unknown card tries nothing on');
});

test('the preview says when the line is blank or too narrow', () => {
  assert.equal(previewOf({ ...reset().s, show: [] }, VIEW).blank, true);
  const s = reset().s, small = previewOf(s, { ...VIEW, width: 'small' });
  assert.equal(previewOf(s, VIEW).blank, false);
  assert.deepEqual(previewOf(s, VIEW).dropped, [], 'wide fits everything');
  assert.ok(small.dropped.includes('the model name'), small.dropped.join());
  assert.equal(small.columns, 80);
});

test('the preview offers only the batteries its plan has', () => {
  assert.equal(offered(VIEW, 'session'), true);
  assert.equal(offered({ ...VIEW, plan: 'payg' }, 'session'), false);
  assert.equal(offered({ ...VIEW, plan: 'payg' }, 'memory'), true);
});
