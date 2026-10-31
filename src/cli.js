import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from './paths.js';
import { loadSettings, saveSettings } from './settings.js';
import { applySet, encodeLink, fableEnabled, CUSTOMIZER_URL, LOOKS } from './schema.js';
import { render } from './render/index.js';
import { strip } from './render/ansi.js';
import { SAMPLES } from './samples.js';
import { refreshFable } from './fable.js';
import { refreshBadges, addBadge, listBadges, removeBadge } from './badges.js';
import { install, restore, fwd, NeedsConfirm } from './setup.js';

const ROOT = new URL('..', import.meta.url);
const USAGE = 'Usage: juice set <key=value>... | get | looks | setup | restore | customize | badges add|list|remove | refresh-fable | refresh-badges <key>';
// Claude Code shows command output as plain text, so the previews drop colour and the rounded-end glyphs.
const PREVIEW = { columns: 160, theme: 'dark', ends: 'plain', colorDepth: 'truecolor' };

export async function main(argv, io) {
  try {
    const p = paths(io.env);
    const [cmd, ...args] = argv;
    switch (cmd) {
      case 'set': {
        const { settings, warnings, changed } = applySet(loadSettings(p).settings, args);
        if (changed.length) saveSettings(p, settings);
        io.out(changed.length ? `Changed: ${changed.join(', ')}` : 'Nothing changed.');
        warnings.forEach((w) => io.out(`Warning: ${w}`));
        return 0;
      }
      case 'get': io.out(JSON.stringify(loadSettings(p).settings, null, 2)); return 0;
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
        install(p, { pluginRoot, inPluginCache: pluginRoot.includes('/plugins/cache/'), yes: args.includes('--yes') }).forEach(io.out);
        return 0;
      }
      case 'restore': restore(p).forEach(io.out); return 0;
      case 'customize': {
        const url = `${CUSTOMIZER_URL}#c=${encodeLink(loadSettings(p).settings)}`;
        io.out(url);
        io.open(url);
        return 0;
      }
      case 'badges': {
        const [sub, ...rest] = args;
        if (sub === 'add') {
          const command = rest.filter((a) => a !== '--yes').join(' ');
          if (!command) { io.err('Give the command to add, for example: badges add "rtk gain" --yes'); return 1; }
          if (!rest.includes('--yes')) { io.out(`This badge would run: ${command}`); io.out('Run again with --yes to add it.'); return 2; }
          addBadge(p, command);
          io.out(`Added badge: ${command}`);
          return 0;
        }
        if (sub === 'list') {
          const l = listBadges(p);
          io.out(l.length ? l.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'No badges.');
          return 0;
        }
        if (sub === 'remove') {
          if (!removeBadge(p, Number(rest[0]))) { io.err('No badge with that number. Run badges list to see them.'); return 1; }
          io.out('Removed.');
          return 0;
        }
        io.err(USAGE); return 1;
      }
      case 'refresh-fable': {
        const { settings } = loadSettings(p);
        if (fableEnabled(settings.fable, io.platform)) {
          const { version } = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
          await refreshFable({ p, platform: io.platform, now: io.now, version });
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
    io.err(e?.message || 'Something went wrong.');
    return 1;
  }
}
