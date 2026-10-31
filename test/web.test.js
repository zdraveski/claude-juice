import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The customizer (GitHub Pages) runs juice's own drawing code in the browser. Anything Node-only in a file it
// imports breaks the public page while every other test stays green, so follow its imports and check each file.
test('every file the web customizer imports runs in a browser', () => {
  const seen = new Set();
  const visit = (url) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const src = readFileSync(fileURLToPath(url), 'utf8');
    const code = src.replace(/\/\/.*$/gm, ''); // comments may mention Node freely
    for (const [, spec] of code.matchAll(/(?:import|export)\s[^;]*?from\s+'([^']+)'|import\(\s*'([^']+)'\s*\)/g)) {
      if (!spec) continue;
      assert.ok(spec.startsWith('.'), `${url.pathname} imports '${spec}', which a browser can't load`);
      visit(new URL(spec, url));
    }
    assert.doesNotMatch(code, /\bprocess\.|\brequire\(|\bBuffer\./, `${url.pathname} uses something only Node has`);
  };
  visit(new URL('../web/app.js', import.meta.url));
  assert.ok(seen.size > 5, `followed ${seen.size} files`);
});
