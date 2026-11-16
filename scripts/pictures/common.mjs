// Shared by the picture scripts: juice's own renderer, and the GitHub look every README picture shares
// (Primer colours, Mona Sans), drawn once for GitHub's dark theme and once for its light theme.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = join(import.meta.dirname, '../../');
const imp = (p) => import(pathToFileURL(REPO + p).href);
const { render } = await imp('src/render/index.js');
const { DEFAULTS, SHOW_IDS, LOOKS } = await imp('src/schema.js');
const { NEUTRAL, PRESETS } = await imp('src/render/palette.js');
const { SAMPLES } = await imp('src/samples.js');
const app = readFileSync(REPO + 'web/app.js', 'utf8');
const ansiToHtml = new Function(app.slice(app.indexOf('const LEFTS'), app.indexOf('// ---------- preview')) + '\nreturn ansiToHtml;')();

export { LOOKS, PRESETS, NEUTRAL };
export const busy = SAMPLES.busy;
export const THEMES = ['dark', 'light'];
const settings = (o = {}) => ({ ...DEFAULTS, show: [...SHOW_IDS], badges: [], ...o });
// Real status line markup, rendered for a `theme` ('dark' or 'light') terminal `columns` wide.
export const line = (data, o, columns = 400, theme = 'dark') => {
  const t = render(data, settings(o), { columns, theme, ends: 'round', colorDepth: 'truecolor' }).text;
  // The pace marker is 1.5px wide on screen and would vanish once GitHub shrinks the picture: draw it 3px here.
  const html = ansiToHtml(t, NEUTRAL[theme].fg).replace(/linear-gradient\(90deg,rgb\([^"]*?\)\)/g, (g) => g.replaceAll('.75px', '1.5px'));
  return { html };
};

// GitHub's own colours (Primer), so a picture reads as part of the page in either theme. The accent is juice's clay,
// darker on light so it keeps 4.5:1 as text. Battery colours (good, watch, bad, fable) come from juice's Claude set.
const T = {
  dark: { bg: '#0d1117', box: '#151b23', term: '#0d1117', line: '#3d444d', ink: '#f0f6fc', sub: '#9198a1', accent: '#e2885f', onAccent: '#0d1117' },
  light: { bg: '#ffffff', box: '#f6f8fa', term: '#ffffff', line: '#d1d9e0', ink: '#1f2328', sub: '#59636e', accent: '#b85932', onAccent: '#ffffff' },
};
const tone = (theme) => { const [good, watch, bad] = PRESETS.claude[theme]; return { good, watch, bad, fable: NEUTRAL[theme].fable }; };
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,200..900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';
const base = (theme) => {
  const t = T[theme], c = tone(theme);
  return `:root{--bg:${t.bg};--box:${t.box};--term:${t.term};--line:${t.line};--ink:${t.ink};--sub:${t.sub};--accent:${t.accent};--on-accent:${t.onAccent};--good:${c.good};--watch:${c.watch};--bad:${c.bad};--fable:${c.fable}}
*{box-sizing:border-box;margin:0}html,body{background:var(--bg)}
body{width:var(--w);height:var(--h);overflow:hidden;color:var(--ink);font-family:'Mona Sans',system-ui,sans-serif;font-size:21px;position:relative;-webkit-font-smoothing:antialiased}
.term,.code{font-family:'JetBrains Mono',Consolas,monospace;font-size:20px;white-space:pre}.ln{white-space:pre;height:1.32em;line-height:1.32}.cell{display:inline-block;width:1ch;height:1.32em;vertical-align:top}
.code{font-weight:500;color:var(--ink)}.code s{text-decoration:none;color:var(--sub)}
.brand{display:flex;align-items:center;gap:.28em;font-weight:800;font-stretch:112%;letter-spacing:-.02em;color:var(--ink)}
.bat{position:relative;display:inline-block;flex:none;width:1.15em;height:.66em;border:.07em solid var(--accent);border-radius:.14em;padding:.06em}
.bat::after{content:"";position:absolute;right:-.15em;top:50%;width:.08em;height:40%;transform:translateY(-50%);border-radius:0 .05em .05em 0;background:var(--accent)}
.bat b{display:block;height:100%;width:62%;border-radius:.05em;background:var(--accent)}
.box{border:1.5px solid var(--line);border-radius:12px;overflow:hidden;background:var(--term)}
.head{display:flex;align-items:center;gap:14px;padding:18px 28px;background:var(--box);border-bottom:1.5px solid var(--line);font-size:24px;font-weight:600;white-space:nowrap}
.head .brand{font-size:26px}.head i{font-style:normal;font-weight:400;color:var(--sub)}.head .hint{margin-left:auto;font-size:21px;font-weight:400;color:var(--sub)}
.row{padding:16px 28px;border-bottom:1.5px solid var(--line)}.row:last-child{border-bottom:0}
.sub{color:var(--sub);line-height:1.4}p,.sub{text-wrap:pretty}
.n{flex:none;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:20px;font-weight:700}`;
};
export const brand = (size) => `<div class="brand"${size ? ` style="font-size:${size}px"` : ''}><span class="bat"><b></b></span><span>juice</span></div>`;
// A box header like a GitHub file path: juice / title, with an optional hint on the right.
export const head = (title, hint = '') => `<div class="head">${brand()}<i>/</i><span>${title}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
export const page = (theme, w, h, css, body) => `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>${base(theme)}:root{--w:${w}px;--h:${h}px}${css}</style></head><body>${body}</body></html>`;
