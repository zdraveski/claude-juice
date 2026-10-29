import { NOW, at } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { countdown, limitNote, memoryNote, LABELS, EFFORT } from '../src/render/words.js';
import { assess } from '../src/render/limits.js';

test('countdown: minutes, hours and minutes, or days and hours', () => {
  assert.equal(countdown(at(31 * 60), NOW), '31m');
  assert.equal(countdown(at(5460), NOW), '1h 31m');
  assert.equal(countdown(at(3600), NOW), '1h');
  assert.equal(countdown(at(104400), NOW), '1d 5h');
  assert.equal(countdown(at(277200 + 59 * 60), NOW), '3d 5h');
  assert.equal(countdown(at(2 * 86400), NOW), '2d');
});

// The usage service sends resets a few milliseconds either side of the hour (02:59:59.92 or 03:00:00.03).
test('countdown rounds to the nearest minute and never says 0m', () => {
  assert.equal(countdown(at(5460 - 0.08), NOW), '1h 31m');
  assert.equal(countdown(at(5460 + 0.03), NOW), '1h 31m');
  assert.equal(countdown(at(20), NOW), '1m');
});

const win = 18000;
test('limitNote: always the countdown, coloured by how it is going', () => {
  const fine = assess({ used: 20, resetsAt: at(7800), windowSec: win }, NOW);
  assert.deepEqual(limitNote(fine, NOW), { text: 'resets in 2h 10m', tone: 'mute' });
  const far = assess({ used: 20, resetsAt: at(104400), windowSec: 604800 }, NOW);
  assert.equal(limitNote(far, NOW).text, 'resets in 1d 5h');
  assert.deepEqual(limitNote(assess({ used: 0, resetsAt: at(-5) }, NOW), NOW), { text: '', tone: 'mute' });
  assert.deepEqual(limitNote({ level: 'warn', resetsAt: at(7800) }, NOW), { text: 'resets in 2h 10m', tone: 'watch' });
  const out = assess({ used: 88, resetsAt: at(7500), windowSec: win }, NOW);
  assert.equal(out.level, 'crit');
  assert.deepEqual(limitNote(out, NOW), { text: 'resets in 2h 5m', tone: 'bad' });
  assert.equal(limitNote(out, NOW, { squeezed: true }).text, 'resets 2h 5m');
});

test('limitNote without a reset time falls back to words', () => {
  assert.deepEqual(limitNote({ level: 'crit', resetsAt: null }, NOW), { text: 'almost empty', tone: 'bad' });
  assert.equal(limitNote({ level: 'crit', resetsAt: null }, NOW, { squeezed: true }).text, 'low');
  assert.deepEqual(limitNote({ level: 'warn', resetsAt: null }, NOW), { text: 'a bit fast', tone: 'watch' });
  assert.equal(limitNote({ level: 'warn', resetsAt: null }, NOW, { squeezed: true }).text, 'fast');
});

test('memoryNote and tables', () => {
  assert.equal(memoryNote('warn', false), 'filling up');
  assert.equal(memoryNote('warn', true), '', 'a tight window leaves the warning to the ! mark');
  assert.equal(memoryNote('crit', false), 'summary soon');
  assert.equal(memoryNote('crit', true), '');
  assert.equal(memoryNote('ok', false), '');
  assert.deepEqual(LABELS.week, ['Weekly', 'Weekly', 'Week']);
  assert.equal(LABELS.fable[1], 'Fable weekly');
  assert.deepEqual(EFFORT.xhigh, [4, 'extra high']);
});
