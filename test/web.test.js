import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The customizer (GitHub Pages) runs juice's own drawing code in the browser. Anything Node-only in a file it
// imports breaks the public page while every other test stays green, so follow its imports and check each file.
// import/export ... from 'x', a bare import 'x', and import('x'), in either quote.
const SPEC = /(?:import|export)\s[^;]*?from\s*(['"])(.+?)\1|import\s*(['"])(.+?)\3|import\(\s*(['"])(.+?)\5\s*\)/g;
test('the import pattern sees double quotes and bare imports', () => {
  const found = (c) => [...c.matchAll(SPEC)].map((m) => m[2] ?? m[4] ?? m[6]);
  assert.deepEqual(found('import "node:fs";'), ['node:fs']);
  assert.deepEqual(found("import './x.js';"), ['./x.js']);
  assert.deepEqual(found('export { a } from "./a.js";'), ['./a.js']);
  assert.deepEqual(found("const m = await import('./m.js');"), ['./m.js']);
});
test('every file the web customizer imports runs in a browser', () => {
  const seen = new Set();
  const visit = (url) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const src = readFileSync(fileURLToPath(url), 'utf8');
    const code = src.replace(/\/\/.*$/gm, ''); // comments may mention Node freely
    for (const m of code.matchAll(SPEC)) {
      const spec = m[2] ?? m[4] ?? m[6];
      assert.ok(spec.startsWith('.'), `${url.pathname} imports '${spec}', which a browser can't load`);
      visit(new URL(spec, url));
    }
    assert.doesNotMatch(code, /\bprocess\.|\brequire\(|\bBuffer\./, `${url.pathname} uses something only Node has`);
  };
  visit(new URL('../web/app.js', import.meta.url));
  assert.ok(seen.size > 5, `followed ${seen.size} files`);
});
