import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fg, strip, vis, cut, contrast, inkOn, to256 } from '../src/render/ansi.js';

test('strip removes escapes', () => assert.equal(strip(fg('#ff0000', 'hi')), 'hi'));
test('vis ignores escapes', () => assert.equal(vis(fg('#ff0000', 'abc')), 3));
test('vis counts emoji as 2 columns', () => {
  assert.equal(vis('🧠 x'), 4);
  assert.equal(vis('⚠️'), 2);
});
test('cut keeps escapes and resets', () => {
  const s = cut(fg('#fff', 'abcdef'), 3);
  assert.equal(strip(s), 'abc');
  assert.ok(s.endsWith('\x1b[0m'));
});
test('cut never exceeds n columns with wide characters', () => assert.equal(strip(cut('a🧠b', 2)), 'a'));
test('contrast and inkOn', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.equal(inkOn('#7fd8a0'), '#141312');
  assert.equal(inkOn('#1d8a4e'), '#ffffff');
});
test('to256 maps truecolor to xterm-256', () => {
  assert.equal(to256('\x1b[38;2;255;0;0mx'), '\x1b[38;5;196mx');
  const g = Number(/48;5;(\d+)m/.exec(to256('\x1b[48;2;24;24;24mx'))[1]);
  assert.ok(g >= 232 && g <= 255);
});
test('strip removes every escape sequence and control char but keeps newlines', () => {
  assert.equal(strip('\x1b]0;x\x07hi'), 'hi');
  assert.equal(strip('\x1b]0;x\x1b\\hi'), 'hi');
  assert.equal(strip('a\x1b[2Jb\x1b[31mc\x1b[0m'), 'abc');
  assert.equal(strip('a\x07b\x7fc\x00'), 'abc');
  assert.equal(strip('a\x1bMb'), 'ab');
  assert.equal(strip('a\nb'), 'a\nb');
});
