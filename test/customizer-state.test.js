// The customizer's state (web/state.js) and the rules it shares with /juice set, without a browser.
// The page's wiring of each one is checked by scripts/check-customizer.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reset, chooseLook, choose, toggleBattery, moveBattery, dropBattery, choosePreset, setCustom } from '../web/state.js';
import { toCommand, hidesStyle, readability, applySet } from '../plugin/src/schema.js';
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
