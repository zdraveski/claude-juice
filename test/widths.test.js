import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vis, cut } from '../src/render/ansi.js';

// Every glyph juice draws, with the columns terminals give it, written by hand so a Node Unicode update can't move one.
const ONE = '·•…─━│┣┫┿╋▀▁▂▃▅▆█▉▊▋▌▍▎▏░▕■▪▰▱▸▹◆○●◑◔◕♡♥✓⠂⡀⣀⣄⣤⣦⣶⣷⣿';
const WIDE = { '日': 2, '✅': 2, '🙂': 2, '♥️': 2, '▪️': 2, '️': 0 };

test('widths: every glyph juice draws has its pinned column count', () => {
  for (const ch of ONE) assert.equal(vis(ch), 1, `U+${ch.codePointAt(0).toString(16)}`);
  for (const [ch, w] of Object.entries(WIDE)) assert.equal(vis(ch), w, `U+${ch.codePointAt(0).toString(16)}`);
});

test('widths: every non-ASCII character in src/ is in the table, so a new glyph gets pinned too', () => {
  const found = new Set();
  for (const f of readdirSync(new URL('../src', import.meta.url), { recursive: true, withFileTypes: true })) {
    if (f.isFile() && f.name.endsWith('.js')) for (const ch of readFileSync(join(f.parentPath, f.name), 'utf8')) if (ch > '\x7f') found.add(ch);
  }
  found.delete('﻿'); // the BOM juice strips from files
  assert.deepEqual([...found].filter((ch) => !ONE.includes(ch)), []);
});

test('vis and cut: a character plus VS16 is two columns, and cut never splits the pair', () => {
  assert.equal(vis('a♥️b'), 4);
  assert.equal(vis('\x1b[31m♥️\x1b[0m'), 2);
  assert.equal(cut('♥️ab', 2), '♥️\x1b[0m');
  assert.equal(cut('a♥️b', 2), 'a\x1b[0m');
  assert.equal(cut('a♥️b', 3), 'a♥️\x1b[0m');
  for (let n = 0; n < 6; n++) assert.ok(vis(cut('♥️日a♥️', n)) <= n);
});
