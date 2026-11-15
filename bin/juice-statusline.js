#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runStatusLine } from '../src/statusline.js';

const juice = fileURLToPath(new URL('./juice.js', import.meta.url));
// Claude Code goes through a company proxy when HTTPS_PROXY is set; Node's own fetch only does when told to
// (Node 22.21 and 24.0 onward; older ones ignore the switch), so the Fable refresher is told to. Badges are
// people's own commands and keep the environment they had.
const proxied = process.env.HTTPS_PROXY || process.env.https_proxy;
const env = proxied ? { ...process.env, NODE_USE_ENV_PROXY: '1' } : process.env;
const spawnDetached = (args) => spawn(process.execPath, [juice, ...args], { detached: true, stdio: 'ignore', windowsHide: true, env: args[0] === 'refresh-fable' ? env : process.env }).on('error', () => {}).unref();

let out = '';
try {
  // A pipe that never closes must not hang the status line: draw with what arrived after 2 s, or at 1 MB.
  const stdinText = await new Promise((resolve) => {
    let text = '';
    const done = () => { clearTimeout(timer); resolve(text); };
    const timer = setTimeout(done, 2000);
    process.stdin.setEncoding('utf8').on('data', (c) => { text += c; if (text.length > 1e6) done(); }).on('end', done).on('error', done);
  });
  out = await runStatusLine({ stdinText, env: process.env, now: new Date(), platform: process.platform, spawnDetached });
} finally {
  process.stdout.write(out + '\n', () => process.exit(0));
}
