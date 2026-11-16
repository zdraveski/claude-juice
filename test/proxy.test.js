// README: a set HTTPS_PROXY carries juice's connection to Anthropic. bin/juice-statusline.js does that by handing the
// Fable refresher NODE_USE_ENV_PROXY=1; drop that and Node goes straight out, and the Fable battery quietly stays empty.
// Here the real status line starts the real refresher, with a fake login and a fake proxy on this computer. A preload
// stops every connection that is not to this computer, so even a broken pass-through sends nothing anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanEnv } from './helpers.js';

const BIN = fileURLToPath(new URL('../bin/juice-statusline.js', import.meta.url));
const GUARD = `import net from 'node:net';
const real = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) {
  const b = Array.isArray(a[0]) ? a[0] : a; // Node passes its own already-sorted arguments as one array
  const o = typeof b[0] === 'object' && b[0] !== null ? b[0] : { port: b[0], host: typeof b[1] === 'string' ? b[1] : undefined };
  if (!o.path && !['127.0.0.1', '::1', 'localhost'].includes(o.host)) throw new Error('juice test guard: blocked a connection to ' + o.host);
  return real.apply(this, a);
};
`;

async function viaProxy(variable) {
  const dir = mkdtempSync(join(tmpdir(), 'juice-proxy-'));
  writeFileSync(join(dir, '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: 'fake-token-for-the-proxy-test' } }));
  writeFileSync(join(dir, 'juice.json'), JSON.stringify({ fable: 'on' }));
  writeFileSync(join(dir, 'guard.mjs'), GUARD);
  const seen = [];
  const proxy = net.createServer((s) => {
    s.on('data', (d) => { seen.push(String(d).split('\r\n')[0]); s.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
    s.on('error', () => {});
  });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  try {
    const now = Math.floor(Date.now() / 1000);
    const stdin = readFileSync(new URL('./fixtures/busy.json', import.meta.url), 'utf8').replace(/"now\+(-?\d+)"/g, (_, n) => String(now + Number(n)));
    const env = cleanEnv(dir, { [variable]: `http://127.0.0.1:${proxy.address().port}`, NODE_OPTIONS: `--import ${pathToFileURL(join(dir, 'guard.mjs')).href}` });
    const c = spawn(process.execPath, [BIN], { env, stdio: ['pipe', 'ignore', 'ignore'] });
    c.stdin.end(stdin);
    for (let i = 0; i < 200 && !seen.length; i++) await new Promise((r) => setTimeout(r, 50)); // the refresher starts after the line is drawn
    return seen;
  } finally { proxy.close(); proxy.closeAllConnections?.(); }
}

// A Mac reads the login from the Keychain, which this test must never ask.
for (const variable of ['HTTPS_PROXY', 'https_proxy']) {
  test(`${variable} sends the Fable refresher's request through the proxy`, { skip: process.platform === 'darwin' && 'a Mac would ask the Keychain for the login' }, async () => {
    assert.deepEqual(await viaProxy(variable), ['CONNECT api.anthropic.com:443 HTTP/1.1']);
  });
}
