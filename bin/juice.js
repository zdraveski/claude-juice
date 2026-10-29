#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { main } from '../src/cli.js';

const open = (url) => {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref(); } catch {}
};

process.exitCode = await main(process.argv.slice(2), {
  out: (l) => console.log(l), err: (l) => console.error(l),
  env: process.env, now: new Date(), platform: process.platform, open,
});
