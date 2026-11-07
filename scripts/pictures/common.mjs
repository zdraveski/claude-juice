// Shared by hero-features.mjs and readme.mjs: juice's own renderer, the README pictures' fonts, colours and page shell.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = join(import.meta.dirname, '../../');
const imp = (p) => import(pathToFileURL(REPO + p).href);
const { render } = await imp('src/render/index.js');
const { DEFAULTS, SHOW_IDS, LOOKS } = await imp('src/schema.js');
const { NEUTRAL, PRESETS } = await imp('src/render/palette.js');
const { SAMPLES } = await imp('src/samples.js');
const { strip, vis } = await imp('src/render/ansi.js');
const app = readFileSync(REPO + 'web/app.js', 'utf8');
const ansiToHtml = new Function(app.slice(app.indexOf('const LEFTS'), app.indexOf('// ---------- preview')) + '\nreturn ansiToHtml;')();

export { LOOKS, PRESETS };
export const busy = SAMPLES.busy;
const settings = (o = {}) => ({ ...DEFAULTS, show: [...SHOW_IDS], badges: [], ...o });
// Real status line markup plus its width in characters, rendered for a terminal `columns` wide.
export const line = (data, o, columns = 400) => {
  const t = render(data, settings(o), { columns, theme: 'dark', ends: 'round', colorDepth: 'truecolor' }).text;
  return { html: ansiToHtml(t, NEUTRAL.dark.fg), chars: Math.max(...strip(t).split('\n').map(vis)) };
};

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';
const BASE = `:root{--bg:#181818;--panel:#1f1e1d;--panel2:#252321;--line:#33302d;--ink:#ecebe8;--sub:#a7a29c;--mute:#7c776f;--clay:#e2885f;--green:#7fd8a0;--amber:#f3c467;--red:#ff7f86;--violet:#a78bfa}
*{box-sizing:border-box;margin:0}html,body{background:var(--bg)}body{width:var(--w);height:var(--h);overflow:hidden;color:var(--ink);font-family:'Space Grotesk',system-ui,sans-serif;position:relative}
.mono{font-family:'JetBrains Mono',Consolas,monospace}.ln{white-space:pre;height:1.32em;line-height:1.32}.cell{display:inline-block;width:1ch;height:1.32em;vertical-align:top}
.term{font-family:'JetBrains Mono',Consolas,monospace}
.logo{display:flex;align-items:center;gap:12px;font-weight:700;font-size:26px;letter-spacing:-.01em}
.bat{position:relative;display:inline-block;border:3px solid currentColor;border-radius:7px;padding:3px}.bat::after{content:"";position:absolute;right:-9px;top:50%;width:5px;height:42%;transform:translateY(-50%);border-radius:0 3px 3px 0;background:currentColor}
.bat b{display:block;height:100%;border-radius:3px}
.cta{white-space:nowrap;font:500 17px 'JetBrains Mono',monospace;color:var(--ink);background:#0f0f0f;border:1px solid var(--line);border-radius:10px;padding:12px 16px;display:inline-flex;gap:10px;align-items:center;min-height:46px}
.cta s{text-decoration:none;color:var(--clay)}`;
export const logo = (size = 26) => `<div class="logo" style="font-size:${size}px"><span class="bat" style="color:var(--clay);width:${size * 1.3}px;height:${size * 0.82}px"><b style="width:62%;background:var(--clay)"></b></span><span>claude-<span style="color:var(--clay)">juice</span></span></div>`;
export const page = (w, h, css, body) => `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}:root{--w:${w}px;--h:${h}px}${css}</style></head><body>${body}</body></html>`;
