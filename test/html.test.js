import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ansiToHtml } from '../plugin/src/render/html.js';
import { render } from '../plugin/src/render/index.js';
import { DEFAULTS, SHOW_IDS, LOOKS } from '../plugin/src/schema.js';
import { SAMPLES } from '../plugin/src/samples.js';

// The visible text: what sits between the tags.
const text = (html) => [...html.matchAll(/>([^<]*)</g)].map((m) => m[1]).join('');
// Block cells, the pace tick and the round ends: the customizer draws these itself, never with the browser's font.
const DRAWN = /[▁-▏│]/;

test('html: every look draws with no escape code left and every battery glyph as a cell', () => {
  for (const l of LOOKS) for (const theme of ['dark', 'light']) for (const colors of [l.set.colors, 'terminal']) {
    const st = { ...DEFAULTS, show: [...SHOW_IDS], badges: [], ...l.set, colors };
    const t = render(SAMPLES.busy, st, { columns: 400, theme, ends: 'round', colorDepth: 'truecolor' }).text;
    const html = ansiToHtml(t, '#cccccc');
    const seen = text(html);
    assert.doesNotMatch(seen, /\x1b/, `${l.id} ${theme} ${colors}`);
    assert.doesNotMatch(seen, DRAWN, `${l.id} ${theme} ${colors}`);
    assert.equal((html.match(/class="ln"/g) ?? []).length, t.split('\n').length);
  }
});

test('html: words are escaped, and the 16 colours, bold and a reset carry over', () => {
  const html = ansiToHtml('\x1b[1;31m<a&b>\x1b[0m"x"', '#eeeeee');
  assert.equal(html, '<div class="ln"><span style="color:#cd3131;font-weight:700">&lt;a&amp;b&gt;</span><span style="color:#eeeeee">&quot;x&quot;</span></div>');
  assert.match(ansiToHtml('\x1b[38;2;1;2;3;48;2;4;5;6mz', '#fff'), /color:rgb\(1,2,3\);background:rgb\(4,5,6\)/);
});
