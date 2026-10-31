// Mac Keychain check, run in CI on macOS only (node scripts/mac-keychain.mjs): stores a fake Claude Code sign-in
// in a throwaway keychain under the names Claude Code uses, and checks juice reads it through the real `security`
// tool, not a mock. It changes the keychain search list while it runs, so it refuses to run outside CI: on a
// personal Mac, never.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { keychainService, readToken } from '../src/fable.js';

if (process.platform !== 'darwin' || process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true') {
  console.log('Skipped: this check only runs on macOS in GitHub Actions, because it changes the keychain search list.');
  process.exit(0);
}

const sec = (...args) => execFileSync('security', args, { encoding: 'utf8' });
const dir = mkdtempSync(join(tmpdir(), 'juice-kc-'));
const keychain = join(dir, 'juice-test.keychain-db');
const before = sec('list-keychains', '-d', 'user').split('\n').map((l) => l.trim().replace(/^"|"$/g, '')).filter(Boolean);

try {
  sec('create-keychain', '-p', 'juice', keychain);
  sec('unlock-keychain', '-p', 'juice', keychain);
  sec('set-keychain-settings', keychain); // no auto-lock while the check runs
  sec('list-keychains', '-d', 'user', '-s', keychain, ...before);
  const store = (env, token) => sec('add-generic-password', '-a', 'juice-test', '-s', keychainService(env), '-w',
    JSON.stringify({ claudeAiOauth: { accessToken: token } }), '-A', keychain);

  // Claude Code's plain name, used without CLAUDE_CONFIG_DIR.
  store({}, 'token-plain');
  assert.equal(readToken({ platform: 'darwin', env: {} }), 'token-plain', 'plain name');
  console.log('ok Keychain: the plain name');

  // With CLAUDE_CONFIG_DIR, Claude Code adds a hash of the folder; an accent typed either way names the same entry.
  const nfc = { CLAUDE_CONFIG_DIR: '/Users/zoë/.claude-work' };
  const nfd = { CLAUDE_CONFIG_DIR: '/Users/zoë/.claude-work' }; // e + a separate two-dot accent
  store(nfc, 'token-folder');
  assert.notEqual(keychainService(nfc), keychainService({}));
  assert.equal(readToken({ platform: 'darwin', env: nfc }), 'token-folder', 'name with the folder hash');
  assert.equal(readToken({ platform: 'darwin', env: nfd }), 'token-folder', 'the same folder typed with a separate accent');
  console.log('ok Keychain: the name with CLAUDE_CONFIG_DIR');

  // Another folder's login is never used, and a missing entry is simply no token.
  assert.equal(readToken({ platform: 'darwin', env: { CLAUDE_CONFIG_DIR: '/Users/someone/.other' } }), null, 'missing entry');
  console.log('ok Keychain: a missing entry gives no token');
} finally {
  try { sec('list-keychains', '-d', 'user', '-s', ...before); } catch {}
  try { sec('delete-keychain', keychain); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
