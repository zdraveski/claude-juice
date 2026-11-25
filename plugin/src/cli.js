import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths, hideHome } from './paths.js';
import { readJson } from './cache.js';
import { loadSettings, saveSettings } from './settings.js';
import { applySet, encodeLink, CUSTOMIZER_URL, LOOKS, NOTHING_SHOWN } from './schema.js';
import { render } from './render/index.js';
import { strip } from './render/ansi.js';
import { SAMPLES } from './samples.js';
import { refreshFable } from './fable.js';
import { readFetched } from './fetched.js';
import { refreshBadges, addBadge, checkEnv, listBadges, badgeList, removeBadge } from './badges.js';
import { install, restore, matchRefresh, refreshWords, NeedsConfirm } from './setup.js';
import { Unreadable } from './install.js';
import { fwd } from './launcher-file.js';

const ROOT = new URL('..', import.meta.url);
// The /juice skill runs badges list without asking, and a command can hold a key: shown is only its first word,
// after any NAME=value set in front of it (GITHUB_TOKEN=… gh …), with the values left out.
const SET = /^([A-Za-z_]\w*)=(?:"(?:[^"\\]|\\.)*"|'[^']*'|\$'(?:[^'\\]|\\.)*'|\$\{[^}]*\}|\$\([^)]*\)|`[^`]*`|\\.|[^\s"'\\])*\s*/;
function hidden(c) {
  let rest = c.trim(), shown = '';
  for (let m; (m = SET.exec(rest));) { shown += `${m[1]}=… `; rest = rest.slice(m[0].length); }
  const [word, ...more] = rest.split(/\s+/).filter(Boolean);
  const first = word && word.length > 40 ? `${word.slice(0, 40)}...` : word;
  return `${shown}${first ?? ''}${more.length ? ' …' : ''}`.trim();
}
const USAGE ='Usage: juice set <key=value>... | get | looks | setup | restore | customize | doctor | badges add|list|remove | refresh-fable | refresh-badges <key>';
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
        const { settings, warnings, chosen, changed: moved } = applySet(loaded.settings, args);
        // Only what was asked for is written, and only where the file says otherwise (a value juice couldn't use reads
        // as its default, so choosing that default still has to be written). Everything else stays as it was.
        const file = readJson(p.settingsFile) ?? {};
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const write = chosen.filter((k) => !same(file[k], settings[k]));
        // Said changed when what juice uses changed (applySet's list), or a value it couldn't use was replaced.
        const changed = write.filter((k) => moved.includes(k) || Object.hasOwn(file, k));
        if (write.length) saveSettings(p, Object.fromEntries(write.map((k) => [k, settings[k]])));
        io.out(changed.length ? `Changed: ${changed.join(', ')}` : 'Nothing changed.');
        if (chosen.includes('motion')) {
          try {
            const r = matchRefresh(p, { platform: io.platform });
            if (r) io.out(r.kept ? `Your status line keeps its own refresh time (${refreshWords(r.seconds)}), so juice left it as it is.`
              : `juice now refreshes ${refreshWords(r.seconds)}.`);
          } catch (e) {
            // An error code means the file couldn't be saved; without one, it couldn't be read, or its JSON is broken.
            io.out(e?.code ? `Warning: motion is saved, but the refresh time stays as it is. ${friendly(e)}`
              : e instanceof Unreadable ? "Warning: motion is saved, but juice can't read your Claude Code settings file (settings.json), so the refresh time stays as it is. Make sure it is yours and you can read it, then try again."
              : 'Warning: motion is saved, but your Claude Code settings file (settings.json) has a mistake in it, so the refresh time stays as it is. Ask Claude to fix it, then try again.');
          }
        }
        // The file's warnings were read before this write: drop the ones about values just replaced.
        [...loaded.warnings.filter((w) => !write.some((k) => w.startsWith(`${k}:`))), ...warnings].forEach((w) => io.out(`Warning: ${w}`));
        if (!settings.show.length) io.out(`Warning: ${NOTHING_SHOWN}`);
        return 0;
      }
      case 'get': {
        const { settings: { badges, ...rest }, warnings } = loadSettings(p);
        // The /juice skill runs get before every change, so badge commands (which can hold keys) never go in here.
        // fableOn tells the skill whether to ask before setup reads the login.
        const fableOn = readFetched(p, rest.fable, io.platform, io.now).on;
        io.out(JSON.stringify({ ...rest, fableOn, badges: badges.length }, null, 2));
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
          // --env NAME,NAME just before the --yes: the extra environment variables this badge may see.
          const at = rest.at(-2) === '--env' ? rest.length - 2 : rest.length;
          const env = [...new Set((rest[at + 1] ?? '').split(',').map((n) => n.trim()).filter(Boolean))];
          const command = rest.slice(0, at).join(' ');
          if (!command) { io.err('Give the command to add, for example: badges add "git branch --show-current" --yes'); return 1; }
          // A --env anywhere else (no names after it, or names split by a space) would end up inside the command.
          if (rest.slice(0, at).includes('--env')) { io.err('Put the names right after --env, joined by commas with no spaces, for example: --env HTTPS_PROXY,NO_PROXY'); return 1; }
          try { checkEnv(env); } catch (e) { io.err(e.message); return 1; }
          const list = badgeList(p), mine = (list.find((b) => b.command === command)?.first ?? 0) - 1;
          const was = list[mine]?.env ?? [];
          if (mine >= 0 && was.join(',') === env.join(',')) { io.out(`That badge is already there, as badge ${mine + 1}.`); return 0; }
          const sees = env.length ? `also see ${env.join(', ')}` : 'see only the basic environment variables';
          if (!yes) {
            // An update says so: re-adding without --env takes a badge's variables away.
            if (mine >= 0) { io.out(`Badge ${mine + 1} would then ${sees}.`); io.out('Run again with --yes to change it.'); return 2; }
            io.out(`This badge would run: ${command}`);
            if (env.length) io.out(`It would also see these environment variables: ${env.join(', ')}`);
            io.out('Run again with --yes to add it.'); return 2;
          }
          addBadge(p, command, env);
          io.out(mine >= 0 ? `Updated badge ${mine + 1}: it will now ${sees}.`
            : list.some((b) => b.command === command) ? `Approved badge: ${command}` : `Added badge: ${command}`);
          return 0;
        }
        if (sub === 'list') {
          const list = badgeList(p);
          const name = (c) => (all.includes('--show') ? strip(c) : hidden(c));
          const why = (b, n) => (b.approved ? (b.first !== n ? ` (a second copy of badge ${b.first}: remove it)` : '')
            : b.first ? ` (a copy of badge ${b.first} that never runs: remove it)`
              : ' (not approved on this computer, so it never runs: add the same command again to approve it)');
          // Names only, never values, so this is safe in the chat.
          const env = (b) => (b.env.length ? ` (also sees ${b.env.join(', ')})` : '');
          io.out(list.length ? list.map((b, i) => `${i + 1}. ${name(b.command)}${env(b)}${why(b, i + 1)}`).join('\n') : 'No badges.');
          loadSettings(p).warnings.forEach((w) => io.out(`Warning: ${w}`));
          return 0;
        }
        if (sub === 'remove') {
          // remove takes only a number, so --yes may come before or after it.
          const n = Number(all.find((a) => a !== '--yes'));
          const command = listBadges(p)[n - 1];
          if (!Number.isInteger(n) || command === undefined) { io.err('No badge with that number. Run badges list to see them.'); return 1; }
          if (!all.includes('--yes')) { io.out(`This would remove badge ${n}: ${hidden(command)}`); io.out('Run again with --yes to remove it.'); return 2; }
          removeBadge(p, n);
          io.out(`Removed badge: ${hidden(command)}`);
          return 0;
        }
        io.err(USAGE); return 1;
      }
      case 'refresh-fable': {
        const { settings } = loadSettings(p);
        if (readFetched(p, settings.fable, io.platform, io.now).on) {
          await refreshFable({ p, platform: io.platform, env: io.env, now: io.now, version: version() });
        }
        return 0;
      }
      case 'refresh-badges': {
        const key = args[0];
        if (!/^[0-9a-f]{16}$/.test(key ?? '')) { io.err('refresh-badges needs a 16-character key.'); return 1; }
        let stdinText;
        // Deleted once read: it holds the chat's project folder and transcript path, and nothing reads it again.
        const stash = join(p.cacheDir, 'badges', `${key}.stdin.json`);
        try { stdinText = readFileSync(stash, 'utf8'); } catch { stdinText = ''; }
        try { rmSync(stash, { force: true }); } catch {} // a week-old one goes with the badge caches
        await refreshBadges({ p, settings: loadSettings(p).settings, key, stdinText, env: io.env });
        return 0;
      }
      case 'help': case '--help': case '-h': io.out(USAGE); return 0;
      default: io.err(USAGE); return 1;
    }
  } catch (e) {
    if (e instanceof NeedsConfirm) { io.out(e.message); return 2; }
    io.err(friendly(e));
    return 1;
  }
}

// Plain words for a file that can't be saved, not a raw error with the full path (and the person's name) in it.
const CANT_SAVE = "juice couldn't save a file in your Claude folder because ";
const SAVE_FAILS = {
  // Windows gives EPERM for a file another program holds open, too. Elsewhere a save replaces the file, so a folder's
  // owner or mode stops it (EACCES), and so does a locked file (EPERM: the Finder's Locked box, chattr +i).
  EPERM: process.platform === 'win32'
    ? 'it is read-only or open in another program. Make it writable or close that program (Claude can help), then try again.'
    : 'it or a folder it goes in is read-only, locked or belongs to another user. Make them yours and writable (Claude can help), then try again.',
  EROFS: 'the disk is read-only. Use a Claude folder on a disk you can write to, then try again.',
  EBUSY: 'another program is using it. Close that program, then try again.',
  ENOSPC: 'the disk is full. Free some space, then try again.',
  ENOTDIR: 'a folder it needs is really a file. Check that your Claude folder is the right one, then try again.',
};
SAVE_FAILS.EACCES = SAVE_FAILS.EPERM;
SAVE_FAILS.EEXIST = SAVE_FAILS.ENOTDIR; // making a folder where a file already is
export const friendly = (e) => (SAVE_FAILS[e?.code] ? CANT_SAVE + SAVE_FAILS[e.code] : hideHome(e?.message || 'Something went wrong.'));
