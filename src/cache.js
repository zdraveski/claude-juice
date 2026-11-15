import { readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync, statSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Notepad and PowerShell 5.1 start files with a BOM, which JSON.parse rejects.
export function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; }
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export const HOT_WRITE = { maxWaitMs: 30 };

// Deletes the files in dir that `ok` picks and nobody has touched for keepMs. Claude Code can stop a status line
// run between writing a temp copy and renaming it into place, so stray .tmp files are swept from time to time.
export function removeOld(dir, ok, keepMs) {
  try {
    for (const f of readdirSync(dir)) {
      if (!ok(f)) continue;
      try { if (Date.now() - statSync(join(dir, f)).mtimeMs > keepMs) unlinkSync(join(dir, f)); } catch {}
    }
  } catch {}
}

export const writeJsonAtomic = (file, value, opts) => writeAtomic(file, JSON.stringify(value, null, 2), opts);

// Written to a temp copy, then renamed into place, so a reader (another window's refresh) never sees half a file.
// modeFrom: for a new file, the file whose permissions it should take (the old file's win when there is one).
export function writeAtomic(file, text, { maxWaitMs = 2500, modeFrom } = {}) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  // Born private, so not even the temp copy of a settings.json holding API keys is readable by others for a moment;
  // then it takes the old file's permissions (or modeFrom's).
  try { writeFileSync(tmp, text, { mode: 0o600 }); } catch (e) { try { unlinkSync(tmp); } catch {} throw e; } // a full disk leaves a half temp file
  if (process.platform !== 'win32') {
    for (const from of [file, modeFrom].filter(Boolean)) { try { chmodSync(tmp, statSync(from).mode & 0o777); break; } catch {} }
  }
  const start = Date.now();
  for (;;) {
    try { return renameSync(tmp, file); } catch (e) {
      // Windows refuses a rename while another process has the target open. A folder or read-only target never clears.
      const st = statSync(file, { throwIfNoEntry: false });
      const transient = process.platform === 'win32' && /^(EPERM|EACCES|EBUSY)$/.test(e.code) && !(st && (st.isDirectory() || !(st.mode & 0o200)));
      if (!transient || Date.now() - start >= maxWaitMs) { try { unlinkSync(tmp); } catch {} throw e; }
      pause(5 + Math.random() * 20);
    }
  }
}

// Keeps a lock closed for holdMs, for a refresher that could not save its result: without this, every draw would run it again.
export function holdLock(p, name, now, holdMs) {
  try { writeJsonAtomic(join(p.cacheDir, `${name}.lock`), { at: +now, holdMs }, HOT_WRITE); } catch {}
}

// Taken by creating the file, which only one window can do; a stale one is removed and taken again once.
export function takeLock(p, name, now, maxAgeMs = 30000) {
  const file = join(p.cacheDir, `${name}.lock`);
  try { mkdirSync(p.cacheDir, { recursive: true, mode: 0o700 }); } catch { return false; }
  for (let i = 0; i < 2; i++) {
    try { writeFileSync(file, String(now.getTime()), { flag: 'wx', mode: 0o600 }); return true; } catch (e) {
      if (e.code !== 'EEXIST') return false; // no lock recorded, so no refresher
      const l = readJson(file), t = l?.at ?? l;
      const age = now.getTime() - t;
      if (typeof t === 'number' && age >= 0 && age < (l?.holdMs ?? maxAgeMs)) return false; // a lock from the future (clock was ahead) is ignored
      try { unlinkSync(file); } catch { return false; }
    }
  }
  return false;
}
