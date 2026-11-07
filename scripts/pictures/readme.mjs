// Draws docs/images/anatomy.png, colours.png, looks.png and colour-sets.png with juice's own renderer.
// Run: node scripts/pictures/readme.mjs (needs Playwright installed globally).
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
const withLimit = (d, id, used) => ({ ...d, limits: { ...d.limits, [id]: { ...d.limits[id], used } } });
const low = withLimit(busy, 'session', 93);
const settings = (o = {}) => ({ ...DEFAULTS, show: [...SHOW_IDS], badges: [], ...o });
const term = { columns: 400, theme: 'dark', ends: 'round', colorDepth: 'truecolor' };
const line = (data, o, columns = term.columns) => { const t = render(data, settings(o), { ...term, columns }).text; return { html: ansiToHtml(t, NEUTRAL.dark.fg), text: strip(t), chars: Math.max(...strip(t).split('\n').map(vis)) }; };
const fit = (chars, px, max) => Math.min(max, Math.floor((px / (chars * 0.6)) * 10) / 10);

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';
const BASE = `:root{--bg:#181818;--panel:#1f1e1d;--panel2:#252321;--line:#33302d;--ink:#ecebe8;--sub:#a7a29c;--mute:#7c776f;--clay:#e2885f;--green:#7fd8a0;--amber:#f3c467;--red:#ff7f86;--violet:#a78bfa}
*{box-sizing:border-box;margin:0}html,body{background:var(--bg)}body{width:var(--w);height:var(--h);overflow:hidden;color:var(--ink);font-family:'Space Grotesk',system-ui,sans-serif;position:relative;padding:48px 56px}
.term{font-family:'JetBrains Mono',Consolas,monospace}.ln{white-space:pre;height:1.32em;line-height:1.32}.cell{display:inline-block;width:1ch;height:1.32em;vertical-align:top}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:22px}.bat{position:relative;display:inline-block;border:3px solid currentColor;border-radius:7px;padding:3px}.bat::after{content:"";position:absolute;right:-9px;top:50%;width:5px;height:42%;transform:translateY(-50%);border-radius:0 3px 3px 0;background:currentColor}.bat b{display:block;height:100%;border-radius:3px}
.top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:26px}h1{font-size:40px;letter-spacing:-.02em;line-height:1.05}h1 em{font-style:normal;color:var(--clay)}.sub{color:var(--sub);font-size:18px;margin-top:8px}
.box{background:#141414;border:1px solid #2a2826;border-radius:12px;padding:14px 16px;overflow:hidden}`;
const logo = `<div class="logo"><span class="bat" style="color:var(--clay);width:29px;height:18px"><b style="width:62%;background:var(--clay)"></b></span><span>claude-<span style="color:var(--clay)">juice</span></span></div>`;
const head = (title, sub) => `<div class="top"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${logo}</div>`;
const page = (w, h, css, body) => `<!DOCTYPE html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}:root{--w:${w}px;--h:${h}px}${css}</style></head><body>${body}</body></html>`;

// ---------- 1. Anatomy: the default line with labels pointing at each part ----------
// The default line in two rows (one row is too small on a phone), each part labelled underneath.
const AR = [['model', 'effort', 'memory', 'session'], ['fable', 'week']].map((show) => line(busy, { show }));
const F = fit(Math.max(...AR.map((r) => r.chars)), 1100, 22), CH = F * 0.6, PAD = 30;
const at = (r, needle) => AR[r].text.indexOf(needle);
const parts = [[
  ['Model', at(0, 'Opus')], ['Effort', at(0, '▂')], ['Memory', at(0, 'Memory')], ['Session', at(0, 'Session')], ['Reset', at(0, 'resets')],
], [['Fable', at(1, 'Fable')], ['Weekly', at(1, 'Weekly')], ['! and !!', at(1, '!')]]];
const callouts = (r) => parts[r].map(([t, idx]) => `<div class="co" style="left:${PAD + idx * CH + CH / 2}px"><span class="stem"></span><b class="lab">${t}</b></div>`).join('');
const anatomy = page(1280, 800, `
h1{font-size:64px}.sub{font-size:29px;margin-top:12px}.top{margin-bottom:40px}.logo{font-size:35px;gap:14px}.logo .bat{width:46px!important;height:29px!important}
.arow{position:relative;height:${Math.round(F * 1.32 + 40 + 96)}px}.arow+.arow{margin-top:26px}
.strip{position:absolute;left:0;right:0;top:0;padding:20px ${PAD}px;font-size:${F}px;border-radius:16px}
.co{position:absolute;width:0;top:${Math.round(F * 1.32 + 40)}px}
.stem{position:absolute;left:0;top:0;width:2.5px;height:34px;background:#5a5650}
.stem::before{content:"";position:absolute;left:-4.5px;top:-5px;width:11.5px;height:11.5px;border-radius:50%;background:var(--clay)}
.lab{position:absolute;left:-10px;top:40px;white-space:nowrap;font-size:29px}`,
`${head('Reading the <em>status line</em>', 'Each part of the line, labelled.')}${AR.map((r, i) => `<div class="arow">${callouts(i)}<div class="strip box term">${r.html}</div></div>`).join('')}`);

// ---------- 2. Colours: fine, going fast, nearly out, Fable ----------
// Three short lines side by side; red says when it runs out, so it gets the full width. One text size for all four.
const S = [line(busy, { show: ['session'] }), line(busy, { show: ['week'] }), line(busy, { show: ['fable'] }), line(low, { show: ['session'] })];
const SF = Math.min(...S.slice(0, 3).map((l) => fit(l.chars, 300, 20)), fit(S[3].chars, 1080, 20));
const state = (accent, title, text, l, wide) => `<div class="st${wide ? ' wide' : ''}"><div class="box term" style="font-size:${SF}px">${l.html}</div><h3><i style="background:${accent}"></i>${title}</h3><p>${text}</p></div>`;
const states = page(1280, 640, `
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.st{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px}.st.wide{grid-column:1/-1}
.st .box{padding:16px 18px}h3{font-size:21px;margin:14px 0 4px;display:flex;align-items:center;gap:10px}h3 i{width:11px;height:11px;border-radius:3px;flex:none}p{color:var(--sub);font-size:16px}`,
`${head('Colours tell you <em>how it\'s going</em>', 'Not only how much is used, but how fast you are going. The thin line marks an even pace.')}<div class="grid">
${state('var(--green)', 'Green: plenty left', 'At this pace you\'ll be fine until it resets.', S[0])}
${state('var(--amber)', 'Amber with !: a bit fast', 'At this pace you will use most of it before it resets.', S[1])}
${state('var(--violet)', 'Violet: Fable, while fine', 'Fable has its own colour, then warns like the others.', S[2])}
${state('var(--red)', 'Red with !!: nearly out', 'Almost empty, or on track to run out before it resets. It tells you when.', S[3], true)}</div>`);

// ---------- 3. The 12 looks, two to a row, each drawn as it really is ----------
const lookCard = (l, n) => { const r = line(busy, l.set); return `<div class="lk"><div class="lt"><b>${n + 1}</b><div><h3>${l.name}</h3><p>${l.note}</p></div></div><div class="box term">${r.html}</div></div>`; };
const looks = page(1280, 2600, `
.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.lk{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;min-width:0}
.lt{display:flex;gap:12px;align-items:center;margin-bottom:10px}.lt b{flex:0 0 auto;width:30px;height:30px;border-radius:8px;background:var(--clay);color:#141312;display:grid;place-items:center;font-size:15px}
h3{font-size:19px}p{color:var(--sub);font-size:14.5px}.lk .box{font-size:11.5px;padding:10px 12px;overflow:hidden}`,
`${head(`${LOOKS.length}` + ' <em>ready-made looks</em>', 'One click in the customizer, or <span class="term" style="color:var(--ink)">/juice look 7</span> in Claude Code.')}<div class="grid">${LOOKS.map(lookCard).join('')}</div>`);

// ---------- 4. The 13 colour sets, each with its own green, amber and red ----------
const setData = withLimit(busy, 'fable', 93);
const setRow = ([id, p]) => { const r = line(setData, { colors: id, show: ['memory', 'fable', 'week'], refills: 'warnings' }); return `<div class="cs"><div class="nm"><h3>${p.name}</h3><p>${p.note}</p></div><div class="chips">${p.dark.map((c) => `<i style="background:${c}"></i>`).join('')}</div><div class="term ln2" style="font-size:${fit(r.chars, 690, 14)}px">${r.html}</div></div>`; };
const sets = page(1280, 960, `
.list{display:grid;gap:8px}.cs{display:grid;grid-template-columns:250px 96px minmax(0,1fr);align-items:center;gap:18px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 18px}
h3{font-size:18px}p{color:var(--sub);font-size:13.5px}.chips{display:flex;gap:4px}.chips i{width:19px;height:19px;border-radius:5px}.ln2{font-size:14px;background:#141414;border-radius:8px;padding:6px 10px}`,
`${head('13 <em>colour sets</em>', 'Shown on a dark terminal. Each one has a light-terminal version too, and you can make your own.')}<div class="list">${Object.entries(PRESETS).map(setRow).join('')}</div>`);

const files = { 'readme-anatomy': [anatomy, 1280, 800], 'readme-colours': [states, 1280, 640], 'readme-looks': [looks, 1280, 2200], 'readme-colour-sets': [sets, 1280, 1140] };
mkdirSync(OUT, { recursive: true });
for (const [n, [html]] of Object.entries(files)) writeFileSync(join(OUT, `${n}.html`), html);

const pw = createRequire(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js'))('playwright');
const browser = await pw.chromium.launch();
for (const [n, [, w, h]] of Object.entries(files)) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await pg.goto(pathToFileURL(join(OUT, `${n}.html`)).href);
  await pg.evaluate(() => document.fonts.ready);
  const used = await pg.evaluate(() => Math.ceil(Math.max(...[...document.body.children].map((e) => e.getBoundingClientRect().bottom))) + 48);
  const over = await pg.evaluate(() => [...document.querySelectorAll('.box,.lk,.cs,.st,.grid,.list,.stage')].filter((e) => e.scrollWidth > e.clientWidth + 1 && !e.closest('.lk')).length);
  await pg.screenshot({ path: join(IMG, `${n.replace('readme-', '')}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, used) } });
  console.log(n, `${w}x${Math.min(h, used)} @2x`, used > h ? `CUT: needs ${used}px` : 'fits', over ? `OVERFLOW ${over}` : '');
  await pg.close();
}
// The customizer picture and GIF come from customizer.mjs.
await browser.close();
