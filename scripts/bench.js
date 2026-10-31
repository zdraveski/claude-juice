// Median wall time of interleaved runs: Node doing nothing, juice, and juice through the launcher.
// The budget is what juice adds on top of Node starting, so the same number holds on fast and slow machines.
// --compare also times claude-dashboard when installed (it runs against your real ~/.claude).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../src/paths.js';
import { install } from '../src/setup.js';

const BUDGET_MS = 75; // juice adds about 60 ms on a 2011 i5; the rest is room for noise
const ROUNDS = 25;

const root = fileURLToPath(new URL('..', import.meta.url));
const now = Math.floor(Date.now() / 1000);
const input = JSON.stringify(JSON.parse(readFileSync(join(root, 'test/fixtures/busy.json'), 'utf8'), (_, v) => {
  const m = typeof v === 'string' && /^now\+(-?\d+)$/.exec(v);
  return m ? now + Number(m[1]) : v;
}));

const time = (args, env) => {
  const t = process.hrtime.bigint();
  spawnSync(process.execPath, args, { input, env, stdio: ['pipe', 'ignore', 'ignore'] });
  return Number(process.hrtime.bigint() - t) / 1e6;
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

// The real path Claude Code runs: the launcher, installed into a temp config dir only.
const env = { ...process.env, CLAUDE_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'juice-bench-')) };
const p = paths(env);
install(p, { pluginRoot: root });

const runs = { node: [['-e', '0'], env], juice: [[join(root, 'bin/juice-statusline.js')], env], launcher: [[p.launcherFile], env] };
for (const [args, e] of Object.values(runs)) time(args, e); // warm-up
const times = Object.fromEntries(Object.keys(runs).map((k) => [k, []]));
for (let i = 0; i < ROUNDS; i++) for (const [k, [args, e]] of Object.entries(runs)) times[k].push(time(args, e));
const [n, j, l] = ['node', 'juice', 'launcher'].map((k) => median(times[k]));

console.log(`Node doing nothing: ${n.toFixed(0)} ms`);
console.log(`juice: ${j.toFixed(0)} ms (+${(j - n).toFixed(0)})`);
console.log(`juice via launcher: ${l.toFixed(0)} ms (+${(l - n).toFixed(0)})`);
const over = l - n > BUDGET_MS;
console.log(`${over ? 'OVER' : 'OK'}: juice adds ${(l - n).toFixed(0)} ms to Node starting, budget ${BUDGET_MS} ms`);
process.exitCode = over ? 1 : 0;

const dash = join(homedir(), '.claude', 'plugins', 'cache', 'claude-dashboard');
if (process.argv.includes('--compare') && existsSync(dash)) {
  const dirs = readdirSync(dash).flatMap((m) => readdirSync(join(dash, m)).map((v) => ({ v, f: join(dash, m, v, 'dist', 'index.js') })));
  const newest = dirs.filter((d) => existsSync(d.f)).sort((a, b) => a.v.localeCompare(b.v, undefined, { numeric: true })).pop();
  if (newest) console.log(`claude-dashboard ${newest.v}: ${median(Array.from({ length: ROUNDS }, () => time([newest.f], process.env))).toFixed(0)} ms`);
}
