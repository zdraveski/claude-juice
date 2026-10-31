#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runStatusLine } from '../src/statusline.js';

const juice = fileURLToPath(new URL('./juice.js', import.meta.url));
const spawnDetached = (args) => spawn(process.execPath, [juice, ...args], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();

let out = '';
try {
  let stdinText = '';
  try { process.stdin.setEncoding('utf8'); for await (const c of process.stdin) stdinText += c; } catch {}
  out = await runStatusLine({ stdinText, env: process.env, now: new Date(), platform: process.platform, spawnDetached });
} finally {
  process.stdout.write(out + '\n', () => process.exit(0));
}
