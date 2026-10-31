import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from './paths.js';
import { loadSettings, saveSettings } from './settings.js';
import { applySet, encodeLink, fableEnabled, CUSTOMIZER_URL, LOOKS, NOTHING_SHOWN } from './schema.js';
import { render } from './render/index.js';
import { strip } from './render/ansi.js';
import { SAMPLES } from './samples.js';
import { refreshFable } from './fable.js';
import { refreshBadges, addBadge, listBadges, removeBadge, unapprovedBadges } from './badges.js';
import { install, restore, fwd, NeedsConfirm } from './setup.js';

const ROOT = new URL('..', import.meta.url);
const USAGE = 'Usage: juice set <key=value>... | get | looks | setup | restore | customize | doctor | badges add|list|remove | refresh-fable | refresh-badges <key>';
const version = () => JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')).version;
// Claude Code shows command output as plain text, so the previews drop colour and the rounded-end glyphs.
const PREVIEW = { columns: 160, theme: 'dark', ends: 'plain', colorDepth: 'none' };

export async function main(argv, io) {
  try {
    const p = paths(io.env);
    const [cmd, ...args] = argv;
    switch (cmd) {
      case 'set': {
        const loaded = loadSettings(p);
        const { settings, warnings, changed } = applySet(loaded.settings, args);
        // A juice.json with a bad value is saved clean too, so the doctor's "change any setting" fixes it. (An unreadable
        // one is never overwritten: saveSettings refuses, since it may hold badges the person wants to fix by hand.)
        if (changed.length || loaded.warnings.length) saveSettings(p, settings);
        io.out(changed.length ? `Changed: ${changed.join(', ')}` : 'Nothing changed.');
        warnings.forEach((w) => io.out(`Warning: ${w}`));
        if (!settings.show.length) io.out(`Warning: ${NOTHING_SHOWN}`);
        return 0;
      }
      case 'get': {
        const { settings: { badges, ...rest }, warnings } = loadSettings(p);
        // The /juice skill runs get before every change, so badge commands (which can hold keys) never go in here.
        io.out(JSON.stringify({ ...rest, badges: badges.length }, null, 2));
        warnings.forEach((w) => io.out(`Warning: ${w}`)); // an unreadable juice.json must not pass for the defaults
        return 0;
      }
      case 'looks': {
        const { settings } = loadSettings(p);
        LOOKS.forEach((l, n) => {
          const preview = strip(render(SAMPLES.busy, applySet(settings, [`look=${l.id}`]).settings, PREVIEW).text);
          io.out(`${n + 1}. ${l.name} (${l.id}): ${l.note}\n${preview.split('\n').map((ln) => `   ${ln}`).join('\n')}`);
        });
        return 0;
      }
      case 'setup': {
        const pluginRoot = fwd(fileURLToPath(ROOT)).replace(/\/$/, '');
        install(p, { pluginRoot, yes: args.includes('--yes') }).forEach(io.out);
        return 0;
      }
      case 'restore': restore(p).forEach(io.out); return 0;
      case 'doctor': {
        const { doctor } = await import('./doctor.js'); // pulls in the launcher and badges, which other commands never need
        doctor(p, { env: io.env, platform: io.platform, now: io.now, cwd: process.cwd(), version: version() }).forEach(io.out);
        return 0;
      }
      case 'customize': {
        const url = `${CUSTOMIZER_URL}#c=${encodeLink(loadSettings(p).settings)}`;
        io.out(url);
        io.open(url);
        return 0;
      }
      case 'badges': {
        const [sub, ...all] = args;
        // Only a final --yes is the go-ahead; one inside the command (npx --yes ccusage) belongs to the command.
        const yes = all.at(-1) === '--yes', rest = yes ? all.slice(0, -1) : all;
        if (sub === 'add') {
          const command = rest.join(' ');
          if (!command) { io.err('Give the command to add, for example: badges add "rtk gain" --yes'); return 1; }
          if (!yes) { io.out(`This badge would run: ${command}`); io.out('Run again with --yes to add it.'); return 2; }
          addBadge(p, command);
          io.out(`Added badge: ${command}`);
          return 0;
        }
        if (sub === 'list') {
          const l = listBadges(p), off = unapprovedBadges(p);
          io.out(l.length ? l.map((c, i) => `${i + 1}. ${c}${off.includes(i + 1) ? ' (not approved on this computer, so it never runs: remove it, then add it again to use it)' : ''}`).join('\n') : 'No badges.');
          loadSettings(p).warnings.forEach((w) => io.out(`Warning: ${w}`));
          return 0;
        }
        if (sub === 'remove') {
          // remove takes only a number, so --yes may come before or after it.
          const n = Number(all.find((a) => a !== '--yes'));
          const command = listBadges(p)[n - 1];
          if (!Number.isInteger(n) || command === undefined) { io.err('No badge with that number. Run badges list to see them.'); return 1; }
          if (!all.includes('--yes')) { io.out(`This would remove badge ${n}: ${command}`); io.out('Run again with --yes to remove it.'); return 2; }
          removeBadge(p, n);
          io.out(`Removed badge: ${command}`);
          return 0;
        }
        io.err(USAGE); return 1;
      }
      case 'refresh-fable': {
        const { settings } = loadSettings(p);
        if (fableEnabled(settings.fable, io.platform)) {
          await refreshFable({ p, platform: io.platform, env: io.env, now: io.now, version: version() });
        }
        return 0;
      }
      case 'refresh-badges': {
        const key = args[0];
        if (!/^[0-9a-f]{16}$/.test(key ?? '')) { io.err('refresh-badges needs a 16-character key.'); return 1; }
        let stdinText;
        try { stdinText = readFileSync(join(p.cacheDir, 'badges', `${key}.stdin.json`), 'utf8'); } catch { stdinText = ''; }
        await refreshBadges({ p, settings: loadSettings(p).settings, key, stdinText });
        return 0;
      }
      default: io.err(USAGE); return 1;
    }
  } catch (e) {
    if (e instanceof NeedsConfirm) { io.out(e.message); return 2; }
    // A read-only file or folder: plain words, not an EPERM with the full path (and the person's name) in it.
    const locked = e?.code === 'EPERM' || e?.code === 'EACCES';
    io.err(locked ? "juice couldn't save a file in your Claude folder because it is read-only. Make it writable (Claude can do it for you), then try again."
      : e?.message || 'Something went wrong.');
    return 1;
  }
}
