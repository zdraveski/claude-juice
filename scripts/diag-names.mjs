// TEMPORARY diagnostic (remove once understood): on Windows, Node 22 could not load a script from a folder
// named "Zoë O'Brien & Co (1)". This tries each unusual character on its own and prints which names fail.
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = mkdtempSync(join(realpathSync.native(tmpdir()), 'diag-'));
const names = ['plain', 'Zoe', 'Zoë', "O'Brien", 'a & b', 'Co (1)', 'Zoë O', "Zoë O'Brien", "Zoë O'Brien & Co (1)", 'ünï', '日本'];
console.log(`node ${process.version} on ${process.platform}`);
for (const name of names) {
  const dir = join(root, name, '.claude');
  mkdirSync(dir, { recursive: true });
  for (const ext of ['js', 'mjs']) {
    const file = join(dir, `x.${ext}`);
    writeFileSync(file, ext === 'js' ? 'console.log("ran")' : 'console.log("ran")');
    const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
    const ok = r.status === 0 && r.stdout.trim() === 'ran';
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${ext.padEnd(3)} ${JSON.stringify(name)}${ok ? '' : `  exit ${r.status}: ${(r.stderr || '').split('\n').find((l) => /Error/.test(l)) ?? r.stderr}`}`);
  }
}
