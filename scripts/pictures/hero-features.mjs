// Draws docs/images/hero.png and features.png. Every status line in them comes from juice's own renderer.
// Run: node scripts/pictures/hero-features.mjs (needs Playwright installed globally: npm i -g playwright).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = join(import.meta.dirname, '../../');
const OUT = join(import.meta.dirname, 'out'), IMG = join(REPO, 'docs/images');
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
const line = (data, o) => { const t = render(data, settings(o), term).text; return { html: ansiToHtml(t, NEUTRAL.dark.fg), chars: Math.max(...strip(t).split('\n').map(vis)) }; };
// Font size so a line of `chars` fits `px` wide (JetBrains Mono is 0.6em per character).
const fit = (chars, px, max) => Math.min(max, Math.floor((px / (chars * 0.6)) * 10) / 10);

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
const CTA = '<div class="cta"><s>&gt;</s>/plugin marketplace add zdraveski/claude-juice</div>';

// ---------- Hero ----------
// The Status bar line with the three limits; its text shrinks in the browser until the line fits the box.
const rows = [line(busy, { layout: 'bar', show: ['model', 'session', 'fable', 'week'] })];
const heroA = page(1280, 640, `
.wrap{position:absolute;inset:44px 64px 40px;display:flex;flex-direction:column}
h1{font-size:72px;line-height:1;letter-spacing:-.03em;font-weight:700;margin:22px 0 10px}h1 em{font-style:normal;color:var(--clay)}
.lede{font-size:25px;color:var(--sub);line-height:1.3;white-space:nowrap}
.sl{margin:auto 0;background:#121212;border:1px solid var(--line);border-radius:18px;padding:18px 28px;font-size:30px;box-shadow:0 24px 60px rgba(0,0,0,.55)}
.sl .ln{height:1.4em;line-height:1.4}
.foot{align-self:flex-end}.cta{font-size:20px}`,
`<div class="wrap">${logo(30)}<h1>Your Claude usage, <em>at a glance.</em></h1>
<p class="lede">A battery-style status line for Claude Code. Know before you run out, and when it resets.</p>
<div class="sl term">${rows.map((r) => r.html).join('')}</div>
<div class="foot">${CTA}</div></div>
<script>document.fonts.ready.then(() => { const s = document.querySelector('.sl'); let f = 30; while (s.scrollWidth > s.clientWidth && f > 8) s.style.fontSize = (f -= 0.25) + 'px'; document.body.dataset.font = f; });</script>`);
// ---------- Features ----------
const mini = (data, o) => line(data, o);
const look = (id) => { const l = LOOKS.find((x) => x.id === id); return mini(busy, { ...l.set, show: ['session'], cost: 'off', refills: 'warnings' }); };
const sw = (id) => `<span class="sw">${PRESETS[id].dark.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
const tile = (accent, title, text, visual) => `<div class="tile"><div class="vis term">${visual}</div><h3><i style="background:${accent}"></i>${title}</h3><p>${text}</p></div>`;
const vis1 = (l) => `<div style="font-size:${fit(l.chars, 470, 24)}px">${l.html}</div>`;
const features = page(1280, 2000, `
body{padding:56px 56px}
.top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:36px}h1{font-size:70px;letter-spacing:-.025em;line-height:1}h1 em{font-style:normal;color:var(--clay)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.tile{min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:26px 30px 30px}.tile:last-child{grid-column:1/-1}
.vis{background:#141414;border:1px solid #2a2826;border-radius:14px;padding:18px 22px;min-height:120px;display:flex;flex-direction:column;justify-content:center;gap:10px;overflow:hidden}
h3{font-size:35px;letter-spacing:-.01em;margin:22px 0 8px;display:flex;align-items:center;gap:14px}h3 i{width:15px;height:15px;border-radius:4px;flex:none}
p{color:var(--sub);font-size:27px;line-height:1.3}
.sw{display:inline-flex;gap:3px;margin:0 14px 10px 0}.sw i{width:18px;height:18px;border-radius:4px}
.code{font-size:24px;color:var(--ink)}.code s{text-decoration:none;color:var(--clay)}`,
`<div class="top"><h1>Everything juice <em>gives you</em></h1>${logo(32)}</div><div class="grid">
${tile('var(--green)', 'Used %, like Anthropic', 'Session, Weekly and Fable match Anthropic\'s usage page.', vis1(mini(busy, { show: ['session'], refills: 'warnings' })) + vis1(mini(busy, { show: ['fable'] })))}
${tile('var(--amber)', 'When every limit resets', 'How long, or which day and time, right next to it.', vis1(mini(busy, { show: ['session'] })) + vis1(mini(busy, { show: ['week'] })))}
${tile('var(--red)', 'Warnings you can\'t miss', 'Amber ! when you\'re going fast, red !! when nearly out.', vis1(mini(busy, { show: ['week'] })) + vis1(mini({ ...busy, memoryUsed: 91 }, { show: ['memory'] })))}
${tile('var(--violet)', 'Fable stands apart', 'Fable gets its own battery, violet in most colour sets.', vis1(mini(busy, { show: ['fable'], layout: 'segments' })) + vis1(mini(busy, { show: ['fable'] })))}
${tile('var(--clay)', LOOKS.length + ' ready-made looks', 'From “Just the basics” to “Everything”, in one click.', vis1(look('retro')) + vis1(look('basics')))}
${tile('var(--green)', '13 colour sets', 'Dark or light terminal, colour-blind safe, or your own.', `<div>${['claude', 'frost', 'calm', 'safe', 'bold', 'ocean', 'midnight', 'vampire', 'candy', 'forest', 'sunset', 'solar', 'rose'].map(sw).join('')}</div>`)}
${tile('var(--amber)', 'Live in every window', 'Idle windows and new chats stay current (Fable battery on).', vis1(mini(busy, { show: ['memory'] })) + vis1(mini(busy, { show: ['session'] })))}
${tile('var(--violet)', 'Just say it: /juice', 'Plain words in Claude Code, or the web customizer.', '<div class="code mono"><s>&gt;</s> /juice use the quiet look</div><div class="code mono"><s>&gt;</s> /juice looks</div>')}
${tile('var(--red)', 'Safe to try', 'Your old status line is saved and comes back in one step.', '<div class="code mono"><s>&gt;</s> /juice restore</div><div class="mono" style="color:var(--green);font-size:24px">Your old status line is back.</div>')}
</div>`);

mkdirSync(OUT, { recursive: true });
const files = { hero: [heroA, 1280, 640], features: [features, 1280, 2000] };
for (const [n, [html]] of Object.entries(files)) writeFileSync(join(OUT, `${n}.html`), html);

// Export PNGs with the globally installed Playwright.
const pw = createRequire(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js'))('playwright');
const browser = await pw.chromium.launch();
for (const [n, [, w, h]] of Object.entries(files)) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await pg.goto(pathToFileURL(join(OUT, `${n}.html`)).href);
  await pg.evaluate(() => document.fonts.ready);
  if (n === 'hero') console.log('hero line font', await pg.waitForFunction(() => document.body.dataset.font).then((h) => h.jsonValue()), 'px');
  const used = n === 'features' ? await pg.evaluate(() => Math.ceil(Math.max(...[...document.body.children].map((e) => e.getBoundingClientRect().bottom))) + 56) : h;
  if (used > h) console.log(n, 'CUT: needs', used);
  await pg.screenshot({ path: join(IMG, `${n}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, used) } });
  const over = await pg.evaluate(() => [...document.querySelectorAll('.win,.sl,.strip,.card,.vis,.tile,.grid,.chips,.pills,.foot,body')].filter((e) => e.scrollWidth > e.clientWidth + 1).length + (document.documentElement.scrollHeight > innerHeight + 1 ? 1 : 0));
  console.log(n, `${w}x${Math.min(h, used)} @2x`, over ? `OVERFLOW in ${over} boxes` : 'fits');
  await pg.close();
}
await browser.close();
