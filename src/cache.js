import { readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync, statSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Notepad and PowerShell 5.1 start files with a BOM, which JSON.parse rejects.
export function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export const HOT_WRITE = { maxWaitMs: 30 };

// modeFrom: for a new file, the file whose permissions it should take (the old file's win when there is one).
export function writeJsonAtomic(file, value, { maxWaitMs = 2500, modeFrom } = {}) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  // Keep the old file's permissions: settings.json can hold API keys and be readable by its owner only.
  if (process.platform !== 'win32') {
    for (const from of [file, modeFrom].filter(Boolean)) { try { chmodSync(tmp, statSync(from).mode & 0o777); break; } catch {} }
  }
  const start = Date.now();
  for (;;) {
    try { return renameSync(tmp, file); } catch (e) {
      // Windows refuses a rename while another process has the target open.
      if (Date.now() - start >= maxWaitMs) { try { unlinkSync(tmp); } catch {} throw e; }
      pause(5 + Math.random() * 20);
    }
  }
}

export function takeLock(p, name, now, maxAgeMs = 30000) {
  const file = join(p.cacheDir, `${name}.lock`);
  const t = readJson(file);
  const age = now.getTime() - t;
  if (typeof t === 'number' && age >= 0 && age < maxAgeMs) return false; // a lock from the future (clock was ahead) is ignored
  try { writeJsonAtomic(file, now.getTime(), HOT_WRITE); } catch { return false; } // no lock recorded, so no refresher
  return true;
}
