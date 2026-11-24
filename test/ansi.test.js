import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fg, strip, vis, cut, contrast, inkOn, to256, to16 } from '../plugin/src/render/ansi.js';
import { render } from '../plugin/src/render/index.js';
import { makeCtx } from '../plugin/src/render/palette.js';
import { batteryPct } from '../plugin/src/render/pieces.js';
import { SAMPLES } from '../plugin/src/samples.js';
import { DEFAULTS } from '../plugin/src/schema.js';

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
// Final review (1.4.1): to256 finds the nearest without searching all 240 colours each time (a refresh draws ~160).
// It must pick what the search picks, ties included, on words and fills, with and without a background.
test('to256 picks what searching all 240 colours picks', () => {
  const L = [0, 95, 135, 175, 215, 255];
  const lumOf = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const all = Array.from({ length: 240 }, (_, i) => {
    const v = i < 216 ? [L[Math.floor(i / 36)], L[Math.floor(i / 6) % 6], L[i % 6]] : Array(3).fill(8 + (i - 216) * 10);
    return { n: 16 + i, v, y: lumOf(v) };
  });
  const search = (rgb, away) => {
    const y = lumOf(rgb);
    let best = 16, d0 = Infinity;
    for (const c of all) {
      const d = (c.v[0] - rgb[0]) ** 2 + (c.v[1] - rgb[1]) ** 2 + (c.v[2] - rgb[2]) ** 2;
      if (d < d0 && away * (c.y - y) >= 0) { d0 = d; best = c.n; }
    }
    return best;
  };
  // Every 51st value, the halfway points between cube levels, and greys halfway between two greys.
  const vals = [...Array.from({ length: 6 }, (_, i) => i * 51), 13, 23, 47, 48, 114, 115, 116, 123, 154, 155, 156, 194, 195, 196, 233, 235, 236];
  const wrong = [];
  for (const [bg, bgRgb] of [[undefined], ['#1e1e1e', [30, 30, 30]], ['#fafafa', [250, 250, 250]]]) {
    for (const r of vals) for (const g of vals) for (const b of vals) {
      const rgb = [r, g, b], hex = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
      const word = bg ? Math.sign(lumOf(rgb) - lumOf(bgRgb)) : 0, fill = bg ? (inkOn(hex) === '#ffffff' ? -1 : 1) : 0;
      const got = to256(`\x1b[38;2;${r};${g};${b}m`, bg) + to256(`\x1b[48;2;${r};${g};${b}m`, bg), want = `\x1b[38;5;${search(rgb, word)}m\x1b[48;5;${search(rgb, fill)}m`;
      if (got !== want && wrong.length < 5) wrong.push(`${hex} on ${bg}: ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
  }
  assert.deepEqual(wrong, []);
});
// Re-review (1.4.1): a round end is a word in the battery's casing colour and the battery a fill of it. In 256 colours
// the word moved away from the background and the fill away from its ink, so they met with a seam (237 beside 236).
test('in 256 colours a round end and the battery it closes get the same colour', () => {
  for (const [back, casing] of [['#1e1e1e', '#353535'], ['#fafafa', '#e6e6e6']]) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(casing.slice(i, i + 2), 16));
    const out = to256(`${fg(casing, '')}\x1b[48;2;${r};${g};${b}m 42% \x1b[49m${fg(casing, '')}`, back);
    const [left, body, right] = [...out.matchAll(/[34]8;5;(\d+)/g)].map((m) => m[1]);
    assert.equal(left, body, `${casing} on ${back}: ${JSON.stringify(out)}`);
    assert.equal(right, body, `${casing} on ${back}: ${JSON.stringify(out)}`);
  }
});
// Re-review (1.4.1): only a round end may map the fill's way. A faint colour of your own that the line also fills with
// moved its words toward their background (#073397 on #181818: 1.63:1 in full colour, 1.14:1 in 256).
test('in 256 colours a word maps by what it sits on, even when the line also fills with its colour', () => {
  for (const [back, c] of [['#ffffff', '#928828'], ['#181818', '#073397']]) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const alone = to256(fg(c, 'abc'), back), withFill = to256(`${fg(c, 'abc')} \x1b[48;2;${r};${g};${b}m 42% \x1b[49m`, back);
    assert.ok(withFill.startsWith(alone), `${c} on ${back}: ${JSON.stringify(withFill)} vs ${JSON.stringify(alone)}`);
  }
});
// Re-review (1.4.1): the cells of a battery are drawn as a colour on its casing, the band behind its number as a fill of
// that colour. Mapping only round ends the fill's way split them: Claude dark, pace, 82% gave cells 65 and band 242.
test('in 256 colours a battery\'s cells and the band behind its number get one colour', () => {
  for (const theme of ['dark', 'light']) for (const ends of ['round', 'plain']) {
    const ctx = makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'pace', colors: 'claude' }, { theme, ends });
    const s = batteryPct(ctx, 82, 'ok', 7, 0.6), out = to256(s, ctx.P.bg);
    const full = [...s.matchAll(/\x1b\[[0-9;]*m/g)], mapped = [...out.matchAll(/\x1b\[[0-9;]*m/g)];
    const seen = {}; // rgb -> { fill: Set, ink: Set } of the 256 colours it became
    full.forEach((m, i) => {
      const c = m[0].match(/([34]8);2;(\d+;\d+;\d+)/), n = mapped[i][0].match(/[34]8;5;(\d+)/);
      if (c) ((seen[c[2]] ??= { fill: new Set(), ink: new Set() })[c[1] === '48' ? 'fill' : 'ink']).add(n[1]);
    });
    const fills = Object.entries(seen).filter(([, v]) => v.fill.size);
    assert.ok(fills.length, `${theme}/${ends}: no fill in ${JSON.stringify(s)}`);
    for (const [rgb, v] of fills) assert.deepEqual([...new Set([...v.fill, ...v.ink])], [...v.fill], `${theme}/${ends} ${rgb}: ${JSON.stringify(out)}`);
  }
});
test('strip removes every escape sequence and control char but keeps newlines', () => {
  assert.equal(strip('\x1b]0;x\x07hi'), 'hi');
  assert.equal(strip('\x1b]0;x\x1b\\hi'), 'hi');
  assert.equal(strip('a\x1b[2Jb\x1b[31mc\x1b[0m'), 'abc');
  assert.equal(strip('a\x07b\x7fc\x00'), 'abc');
  assert.equal(strip('a\x1bMb'), 'ab');
  assert.equal(strip('a\nb'), 'a\nb');
});

test('CJK characters count as 2 columns', () => {
  assert.equal(vis('日本語'), 6);
  assert.equal(vis('한글'), 4);
  assert.equal(vis('ａ'), 2);
  assert.equal(vis('abc'), 3);
});

test('vis: ♥ and ▪ draw one column (text presentation)', () => {
  assert.equal(vis('♥▪'), 2);
});

test('strip removes bidi overrides and zero-width marks but keeps joiners for emoji', () => {
  assert.equal(strip('a\u202eb\u200bc\u200e\u200f\u202a\u2066\u2069\u2028\u2029\ufeffd'), 'abcd');
  assert.equal(strip('\u{1F468}\u200d\u{1F469}\u200c'), '\u{1F468}\u200d\u{1F469}\u200c');
});

test('strip removes the other invisible marks too: Arabic letter mark, word joiners, soft hyphen, tag characters', () => {
  assert.equal(strip('a؜b⁠c⁤d­e᠎f￹g\u{e0041}\u{e007f}h'), 'abcdefgh');
});

// A badge can colour itself with one combined code (bold and red together), which kept its 24-bit colour (1.4.0).
test('to256 rewrites 24-bit colour wherever it sits in the code, and leaves 256-colour codes alone', () => {
  assert.equal(to256('\x1b[1;38;2;255;0;0;48;2;0;0;255m'), '\x1b[1;38;5;196;48;5;21m');
  assert.equal(to256('\x1b[38;5;38;1m'), '\x1b[38;5;38;1m');
});

// Terminals draw these two columns wide; counting them as one let a line overrun its width (1.4.0).
test('the less common wide characters count as 2 columns too', () => {
  for (const ch of ['\u2329', '\ufe10', '\ufe50', '\ua960', '\u{16fe0}', '\u{17000}', '\u{18b00}', '\u{1b000}', '\u{1f200}', '\u{1f260}']) {
    assert.equal(vis(ch), 2, ch.codePointAt(0).toString(16));
  }
});

// colors=terminal: juice's own colours become the terminal's 16, so a palette you remapped shows through.
test('to16 names each hue by its terminal colour: bright on a dark terminal, plain on a light one', () => {
  for (const [hex, dark, plain] of [['#7fd8a0', 92, 32], ['#f3c467', 93, 33], ['#ff9e64', 93, 33], ['#ff7f86', 91, 31], ['#88c0d0', 96, 36], ['#60a5fa', 94, 34], ['#a78bfa', 95, 35]]) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(';');
    assert.equal(to16(`\x1b[38;2;${rgb}mx`, true), `\x1b[${dark};49mx`, hex);
    assert.equal(to16(`\x1b[38;2;${rgb}mx`, false), `\x1b[${plain};49mx`, hex);
  }
});

test('to16 gives a grey the grey of its lightness, never the one that is usually the background', () => {
  const grey = (v, dark) => to16(`\x1b[38;2;${v};${v};${v}mx`, dark);
  assert.deepEqual([0x18, 0x7a, 0xcc, 0xff].map((v) => grey(v, true)), ['\x1b[90;49mx', '\x1b[90;49mx', '\x1b[37;49mx', '\x1b[97;49mx']);
  assert.deepEqual([0x18, 0x7a, 0xcc, 0xff].map((v) => grey(v, false)), ['\x1b[30;49mx', '\x1b[90;49mx', '\x1b[37;49mx', '\x1b[37;49mx']);
});

test('to16 puts black or white words on a fill, but a battery cell keeps its colour', () => {
  assert.equal(to16('\x1b[48;2;255;255;0m 5% \x1b[0m', true), '\x1b[30;103m 5% \x1b[0;39;49m');
  assert.equal(to16('\x1b[38;2;255;255;0;48;2;40;40;40m█', true), '\x1b[93;100m█');
});

test('to16 keeps other codes and the 16 colours a badge sends, and maps its 256 colours', () => {
  assert.equal(to16('\x1b[1;31mx\x1b[22;39m', true), '\x1b[1;31;49mx\x1b[22;39;49m');
  assert.equal(to16('\x1b[38;5;196mx\x1b[38;5;9mx', false), '\x1b[31;49mx\x1b[91;49mx');
});

test('colors=terminal draws with no 24-bit or 256-colour codes', () => {
  for (const colorDepth of ['truecolor', '256']) for (const layout of ['bar', 'pills']) {
    const out = render(SAMPLES.busy, { ...DEFAULTS, layout, colors: 'terminal' }, { columns: 200, theme: 'dark', ends: 'round', colorDepth }).text;
    assert.ok(/\x1b\[[0-9;]*m/.test(out) && !/\x1b\[[0-9;]*[34]8;[25];/.test(out), `${colorDepth} ${layout}`);
  }
});

test('to16 on a light terminal: black words on plain green and yellow fills, white on red; a second pass changes nothing', () => {
  assert.equal(to16('\x1b[48;2;0;160;0mx', false), '\x1b[30;42mx');
  assert.equal(to16('\x1b[48;2;160;160;0mx', false), '\x1b[30;43mx');
  assert.equal(to16('\x1b[48;2;160;0;0mx', false), '\x1b[97;41mx');
  const once = render(SAMPLES.busy, { ...DEFAULTS, layout: 'pills', colors: 'terminal' }, { columns: 200, theme: 'light', ends: 'round', colorDepth: 'truecolor' }).text;
  assert.equal(to16(once, false), once);
});
