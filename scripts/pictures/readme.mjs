// Draws docs/images/anatomy.png, colours.png, looks.png and colour-sets.png with juice's own renderer.
// Run: node scripts/pictures/readme.mjs (needs Playwright installed globally: npm i -g playwright).
import { browser, shoot } from './shot.mjs';
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

const busy = SAMPLES.busy;
const settings = (o = {}) => ({ ...DEFAULTS, show: [...SHOW_IDS], badges: [], ...o });
const term = { columns: 400, theme: 'dark', ends: 'round', colorDepth: 'truecolor' };
// Real status line markup plus its width in characters.
const line = (data, o) => { const t = render(data, settings(o), { ...term, columns: 38 }).text; return { html: ansiToHtml(t, NEUTRAL.dark.fg), chars: Math.max(...strip(t).split('\n').map(vis)) }; };

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';
const BASE = `:root{--bg:#181818;--panel:#1f1e1d;--panel2:#252321;--line:#33302d;--ink:#ecebe8;--sub:#a7a29c;--mute:#7c776f;--clay:#e2885f;--green:#7fd8a0;--amber:#f3c467;--red:#ff7f86;--violet:#a78bfa}
*{box-sizing:border-box;margin:0}html,body{background:var(--bg)}body{width:var(--w);height:var(--h);overflow:hidden;color:var(--ink);font-family:'Space Grotesk',system-ui,sans-serif;position:relative}
.mono{font-family:'JetBrains Mono',Consolas,monospace}.ln{white-space:pre;height:1.32em;line-height:1.32}.cell{display:inline-block;width:1ch;height:1.32em;vertical-align:top}
.term{font-family:'JetBrains Mono',Consolas,monospace}
.win{background:#141414;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55)}
.bar{display:flex;align-items:center;gap:8px;padding:11px 16px;background:#1c1b1a;border-bottom:1px solid var(--line);color:var(--mute);font:500 13px 'JetBrains Mono',monospace}
.bar i{width:11px;height:11px;border-radius:50%;background:#3a3835;display:inline-block}
.logo{display:flex;align-items:center;gap:12px;font-weight:700;font-size:26px;letter-spacing:-.01em}
.bat{position:relative;display:inline-block;border:3px solid currentColor;border-radius:7px;padding:3px}.bat::after{content:"";position:absolute;right:-9px;top:50%;width:5px;height:42%;transform:translateY(-50%);border-radius:0 3px 3px 0;background:currentColor}
.bat b{display:block;height:100%;border-radius:3px}
.cta{white-space:nowrap;font:500 17px 'JetBrains Mono',monospace;color:var(--ink);background:#0f0f0f;border:1px solid var(--line);border-radius:10px;padding:12px 16px;display:inline-flex;gap:10px;align-items:center;min-height:46px}
.cta s{text-decoration:none;color:var(--clay)}
.chip{white-space:nowrap;display:inline-flex;align-items:center;gap:9px;padding:9px 14px;border-radius:999px;background:var(--panel2);border:1px solid var(--line);font-size:18px;font-weight:500}
.chip i{width:9px;height:9px;border-radius:50%}`;
const logo = (size = 26) => `<div class="logo" style="font-size:${size}px"><span class="bat" style="color:var(--clay);width:${size * 1.3}px;height:${size * 0.82}px"><b style="width:62%;background:var(--clay)"></b></span><span>claude-<span style="color:var(--clay)">juice</span></span></div>`;
const page = (w, h, css, body) => `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}:root{--w:${w}px;--h:${h}px}${css}</style></head><body>${body}</body></html>`;


// ---------- Shared: 720px canvases, one column. Type scale: 25 code, 33 text, 44 titles, 59 headlines ----------
const W = 720, TALL = 6000, MAXCH = 38;
const withLimit = (d, id, used) => ({ ...d, limits: { ...d.limits, [id]: { ...d.limits[id], used } } });
const low = withLimit(busy, 'session', 93);
const one = (id, data = busy, o = {}) => line(data, { show: [id], ...o });
// A status line has to fit a phone row; say so loudly instead of shrinking it.
const fits = (l, what) => { if (l.chars > MAXCH) console.warn(`${what}: ${l.chars} characters wide (max ${MAXCH})`); return l; };
const COMMON = `.wrap{position:absolute;top:48px;left:40px;right:40px;display:flex;flex-direction:column;gap:24px}
.top{display:flex;flex-direction:column;gap:16px;margin-bottom:8px}h1{font-size:59px;letter-spacing:-.025em;line-height:1.05}h1 em{font-style:normal;color:var(--clay)}.sub{color:var(--sub);font-size:33px;line-height:1.3}
.card{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:22px 22px 26px;min-width:0}
.box{background:#141414;border:1px solid #2a2826;border-radius:14px;padding:16px;font-size:25px}.box .ln{height:1.4em;line-height:1.4}
h3{font-size:44px;letter-spacing:-.01em;line-height:1.1;margin:20px 0 8px;display:flex;align-items:center;gap:14px}h3 i{width:16px;height:16px;border-radius:4px;flex:none}
p{color:var(--sub);font-size:33px;line-height:1.3}`;
const head = (title, sub) => `<div class="top">${logo(33)}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const doc = (css, title, sub, body) => page(W, TALL, COMMON + css, `<div class="wrap">${head(title, sub)}${body}</div>`);
const card = (accent, title, text, l, what) => `<div class="card"><div class="box term">${fits(l, what).html}</div><h3><i style="background:${accent}"></i>${title}</h3><p>${text}</p></div>`;

// ---------- 1. Anatomy: one labelled row per part of the line ----------
const part = (n, l, text) => `<div class="card"><div class="box term">${fits(l, n).html}</div><h3>${n}</h3><p>${text}</p></div>`;
const anatomy = doc('', 'Reading the <em>status line</em>', 'Each part of the line, one row each.',
  part('Model', one('model'), 'The model Claude is using.') +
  part('Effort', one('effort'), 'How hard Claude is thinking: more bars, more effort.') +
  part('Memory', one('memory'), 'How full this chat is. No pace, no reset.') +
  part('Session', one('session'), 'The 5-hour limit: used so far, and the time left before it resets.') +
  part('Fable', one('fable'), 'Its own battery, with its own limit and colour.') +
  part('Weekly', one('week'), 'The weekly limit, with its reset day and time. A ! or !! warns you.'));

// ---------- 2. Colours: fine, going fast, nearly out, Fable ----------
const colours = doc('', 'Colours tell you <em>how it\'s going</em>', 'Not only how much is used, but how fast you are going. The thin line marks an even pace.',
  card('var(--green)', 'Green: plenty left', 'At this pace you\'ll be fine until it resets.', one('session'), 'green') +
  card('var(--amber)', 'Amber with !: a bit fast', 'At this pace you will use most of it before it resets.', one('week'), 'amber') +
  card('var(--violet)', 'Violet: Fable, while fine', 'Fable has its own colour, then warns like the others.', one('fable'), 'violet') +
  card('var(--red)', 'Red with !!: nearly out', 'Almost empty, or on track to run out before it resets. It tells you when.', one('session', low), 'red'));

// ---------- 3. All the looks, one per row, each drawn with its own settings but limited to what fits ----------
const lookCard = (l, n) => { const r = fits(line(busy, { ...l.set, show: ['session'], cost: 'off', refills: 'warnings' }), l.name); return `<div class="card"><div class="box term">${r.html}</div><h3><b class="num">${n + 1}</b>${l.name}</h3><p>${l.note}</p></div>`; };
const looks = doc('.num{flex:none;width:52px;height:52px;border-radius:12px;background:var(--clay);color:#141312;display:grid;place-items:center;font-size:33px}',
  `${LOOKS.length} <em>ready-made looks</em>`, 'One click in the customizer, or <span class="mono" style="color:var(--ink);font-size:25px">/juice look 7</span> in Claude Code.',
  LOOKS.map(lookCard).join(''));

// ---------- 4. All the colour sets on dark, each with a fine, an amber ! and a red !! battery ----------
const fine = withLimit(busy, 'session', 20), amber = withLimit(busy, 'session', 55), red = withLimit(busy, 'session', 96);
const setCard = ([id, p]) => {
  const ls = [fine, amber, red].map((d) => fits(line(d, { colors: id, show: ['session'], refills: 'warnings' }), p.name));
  return `<div class="card"><h3 style="margin-top:0">${p.name}</h3><p>${p.note}</p><div class="box term" style="margin-top:16px;display:grid;gap:8px">${ls.map((l) => `<div>${l.html}</div>`).join('')}</div></div>`;
};
const sets = doc('', `${Object.keys(PRESETS).length} <em>colour sets</em>`, 'Shown on a dark terminal. Each has a light-terminal version too, and you can make your own.',
  Object.entries(PRESETS).map(setCard).join(''));

const br = await browser();
await shoot(br, 'anatomy', anatomy);
await shoot(br, 'colours', colours);
await shoot(br, 'looks', looks);
await shoot(br, 'colour-sets', sets);
await br.close();
