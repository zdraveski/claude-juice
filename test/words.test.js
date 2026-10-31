import { NOW, at } from './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { countdown, clock, resetWhen, limitNote, memoryNote, LABELS, EFFORT } from '../src/render/words.js';
import { assess } from '../src/render/limits.js';

test('countdown: minutes, hours and minutes, or days and hours', () => {
  assert.equal(countdown(at(31 * 60), NOW), '31m');
  assert.equal(countdown(at(5460), NOW), '1h 31m');
  assert.equal(countdown(at(3600), NOW), '1h');
  assert.equal(countdown(at(104400), NOW), '1d 5h');
  assert.equal(countdown(at(277200 + 29 * 60), NOW), '3d 5h');
  assert.equal(countdown(at(277200 + 59 * 60), NOW), '3d 6h', 'past a day the hours round, not cut');
  assert.equal(countdown(at(86400 + 59 * 60), NOW), '1d 1h');
  assert.equal(countdown(at(2 * 86400 - 20 * 60), NOW), '2d', 'rounding carries into the days');
  assert.equal(countdown(at(2 * 86400), NOW), '2d');
});

// The usage service sends resets a few milliseconds either side of the hour (02:59:59.92 or 03:00:00.03).
test('countdown rounds to the nearest minute and never says 0m', () => {
  assert.equal(countdown(at(5460 - 0.08), NOW), '1h 31m');
  assert.equal(countdown(at(5460 + 0.03), NOW), '1h 31m');
  assert.equal(countdown(at(20), NOW), '1m');
});

// NOW is Wednesday Oct 28, 2:20 PM.
test('resetWhen: how long under a day, the day and time after, the countdown when squeezed', () => {
  assert.equal(resetWhen(at(7800), NOW), 'in 2h 10m');
  assert.equal(resetWhen(at(86400 - 60), NOW), 'in 23h 59m', 'just under a day is still a countdown');
  assert.equal(resetWhen(at(86400), NOW), 'Thu 2:20 PM');
  assert.equal(resetWhen(at(277200 + 29 * 60 - 25), NOW), 'Sat 7:49 PM', 'the time is rounded to the minute, like the countdown');
  assert.equal(resetWhen(at(10 * 3600), NOW), 'in 10h', 'after midnight but under a day: still how long');
  assert.equal(resetWhen(at(7 * 86400 - 60), NOW), 'next Wed 2:19 PM', 'a week away is not today');
  assert.equal(resetWhen(at(6 * 86400), NOW), 'Tue 2:20 PM');
  assert.equal(resetWhen(at(7800), NOW, true), '2h 10m');
  assert.equal(resetWhen(at(277200), NOW, true), '3d 5h', 'squeezed, the shorter countdown');
});

const win = 18000;
test('limitNote: always when it resets, coloured by how it is going', () => {
  const fine = assess({ used: 20, resetsAt: at(7800), windowSec: win }, NOW);
  assert.deepEqual(limitNote(fine, NOW), { text: 'resets in 2h 10m', tone: 'mute' });
  const far = assess({ used: 20, resetsAt: at(104400), windowSec: 604800 }, NOW);
  assert.equal(limitNote(far, NOW).text, 'resets Thu 7:20 PM');
  assert.deepEqual(limitNote(assess({ used: 0, resetsAt: at(-5) }, NOW), NOW), { text: '', tone: 'mute' });
  assert.deepEqual(limitNote({ level: 'warn', resetsAt: at(7800) }, NOW), { text: 'resets in 2h 10m', tone: 'watch' });
  const out = assess({ used: 88, resetsAt: at(7500), windowSec: win }, NOW);
  assert.equal(out.level, 'crit');
  assert.deepEqual(limitNote(out, NOW), { text: 'runs out ~2:44 PM · resets in 2h 5m', tone: 'bad' });
  assert.equal(limitNote(out, NOW, { squeezed: true }).text, 'out ~2:44 PM', 'a tight window keeps the more urgent half');
  assert.equal(limitNote(fine, NOW, { squeezed: true }).text, 'resets 2h 10m');
});

test('clock: the time today, the weekday this week, "next" a week out, the date further', () => {
  assert.equal(clock(at(1432), NOW), '2:44 PM');
  assert.equal(clock(at(10 * 3600), NOW), 'Thu 12:20 AM', 'after midnight is another day');
  assert.equal(clock(at(4 * 86400 + 3600), NOW), 'Sun 3:20 PM');
  assert.equal(clock(at(-14 * 3600), NOW), '12:20 AM');
  assert.equal(clock(at(7 * 86400), NOW), 'next Wed 2:20 PM');
  assert.equal(clock(at(10 * 86400), NOW), 'Nov 7, 2:20 PM', 'a monthly budget 10 days out is not "this Saturday"');
  assert.equal(clock(at(-86400), NOW), 'Oct 27, 2:20 PM');
});

test('resetWhen counts days on the calendar, across daylight saving and a slow clock', () => {
  const keep = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    // The night clocks go back has 25 hours: 24h10m after 12:30 AM is still the same day.
    assert.equal(resetWhen(new Date(Date.UTC(2026, 10, 2, 4, 40)), new Date(Date.UTC(2026, 10, 1, 4, 30))), '11:40 PM');
    // The week clocks go forward: 6d23h45m after Sat 11:30 PM is the Sunday after next, not tomorrow.
    assert.equal(resetWhen(new Date(Date.UTC(2026, 2, 15, 4, 15)), new Date(Date.UTC(2026, 2, 8, 4, 30))), 'Mar 15, 12:15 AM');
    process.env.TZ = 'Europe/London';
    // Rounding a reset at 11:59:45 PM a week out to midnight lands on the day after: a date, not "Thu".
    assert.equal(resetWhen(new Date(2026, 10, 4, 23, 59, 45), new Date(2026, 9, 28, 23, 59, 50)), 'Nov 5, 12:00 AM');
    assert.equal(resetWhen(new Date(2026, 9, 29, 23, 59, 40), new Date(2026, 9, 29, 0, 0)), 'Fri 12:00 AM', 'the weekday of the time shown');
    process.env.TZ = 'UTC';
    assert.equal(resetWhen(at(3 * 86400), NOW), 'Sat 2:20 PM UTC', 'a computer on UTC says so');
  } finally { process.env.TZ = keep; }
});

// Every other test runs in London's winter time (helpers.js); people don't, and daylight saving moves clocks.
test('clock reads the local time zone, across the night daylight saving ends', () => {
  const keep = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York'; // EDT until 2026-11-01 06:00 UTC, then EST
    const now = new Date(Date.UTC(2026, 9, 31, 20, 0)); // 4:00 PM EDT on Oct 31
    assert.equal(clock(new Date(Date.UTC(2026, 9, 31, 21, 15)), now), '5:15 PM');
    assert.equal(clock(new Date(Date.UTC(2026, 10, 1, 5, 30)), now), 'Sun 1:30 AM', 'still EDT');
    assert.equal(clock(new Date(Date.UTC(2026, 10, 1, 7, 30)), now), 'Sun 2:30 AM', 'now EST: an hour later in UTC, the same hour on the clock');
    assert.equal(countdown(new Date(Date.UTC(2026, 10, 1, 20, 0)), now), '1d', 'a countdown is real time: 24 hours, though the clock moves 25 that night');
  } finally { process.env.TZ = keep; }
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
