// The release notes script: the current version is ready to tag, and a mismatched tag is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const notes = (tag) => spawnSync(process.execPath, ['scripts/release-notes.mjs', tag], { cwd: ROOT, encoding: 'utf8' });

test('the current version matches plugin.json and has a changelog entry', () => {
  const r = notes(`v${version}`);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim().length > 0);
  assert.doesNotMatch(r.stdout, /^## /m); // only this version's entry, not the next one
});

test('a tag that does not match the version is refused', () => {
  const r = notes('v0.0.0');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /the tag says 0\.0\.0/);
});
