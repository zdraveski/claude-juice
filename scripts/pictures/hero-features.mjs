// Draws docs/images/hero.png, features.png and open-customizer.png (the README's button). Every status line in them comes from juice's own renderer.
// Run: node scripts/pictures/hero-features.mjs (needs Playwright installed globally: npm i -g playwright).
import { browser, shoot } from './shot.mjs';
import { busy, LOOKS, PRESETS, line, logo, page } from './common.mjs';

// ---------- Shared sizes ----------
// 720px canvases, one column. Type scale (1.333): 25 code, 33 text, 44 titles, 59 headlines, 104 wordmark.
const W = 720, TALL = 4000;
const one = (id, data = busy, o = {}) => line(data, { show: [id], ...o });
const rows = (ls) => `<div class="sl term">${ls.map((l) => `<div>${l.html}</div>`).join('')}</div>`;
// A chat that is nearly full: the one red battery, so the pictures show all three states.
const full = { ...busy, memoryUsed: 91 };
const COMMON = `.sl{background:#121212;border:1px solid var(--line);border-radius:18px;padding:24px 28px;font-size:25px;box-shadow:0 24px 60px rgba(0,0,0,.55);display:grid;gap:12px}
.sl .ln{height:1.4em;line-height:1.4}
.wrap{position:absolute;top:48px;left:40px;right:40px;display:flex;flex-direction:column;gap:32px}`;

// ---------- Hero: the name on a soft glow, and the line in all three states ----------
// No install command here: a picture can't be copied, and the Install steps sit right below it in the README.
const hero = page(W, TALL, `${COMMON}
body{background:radial-gradient(440px 380px at 10% 4%,rgba(226,136,95,.30),transparent 70%),radial-gradient(440px 380px at 95% 60%,rgba(167,139,250,.26),transparent 70%),#151413}
.wrap{align-items:center;text-align:center;gap:28px}
.word{font:700 104px/0.9 'Space Grotesk';letter-spacing:-.05em;color:var(--clay);margin-top:8px}
.for{font-size:33px;color:var(--sub);line-height:1.25;margin:-6px 0 12px}
.sl{text-align:left;background:rgba(20,20,20,.86)}`,
`<div class="wrap"><div class="word">juice</div><div class="for">for Claude Code</div>
${rows([one('memory', full), one('session'), one('fable'), one('week')])}</div>`);

// ---------- Features: five tiles, one per row ----------
const look = (id) => { const l = LOOKS.find((x) => x.id === id); return line(busy, { ...l.set, show: ['session'], cost: 'off', refills: 'warnings' }); };
const sw = (id) => `<span class="sw">${PRESETS[id].dark.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
// Clay bullets: green, amber and red mean how full a battery is, so the tiles don't borrow them.
const tile = (title, text, visual) => `<div class="tile"><div class="vis">${visual}</div><h3><i></i>${title}</h3><p>${text}</p></div>`;
const cells = (...ls) => ls.map((l) => `<div class="term">${l.html}</div>`).join('');
const cmd = (...cs) => cs.map((c) => `<div class="code mono"><s>&gt;</s> ${c}</div>`).join('');
const features = page(W, TALL, `
.wrap{position:absolute;top:48px;left:40px;right:40px;display:flex;flex-direction:column;gap:24px}
.top{display:flex;flex-direction:column;gap:20px;margin-bottom:8px}h1{font-size:59px;letter-spacing:-.025em;line-height:1.05}h1 em{font-style:normal;color:var(--clay)}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:22px 22px 26px}
.vis{background:#141414;border:1px solid #2a2826;border-radius:14px;padding:16px 16px;display:flex;flex-direction:column;gap:10px;font-size:25px;overflow:hidden}
h3{font-size:44px;letter-spacing:-.01em;line-height:1.1;margin:22px 0 8px;display:flex;align-items:center;gap:14px}h3 i{width:16px;height:16px;border-radius:4px;flex:none;background:var(--clay)}
p{color:var(--sub);font-size:33px;line-height:1.3}
.sw{display:inline-flex;gap:4px;margin:4px 14px 6px 0}.sw i{width:22px;height:22px;border-radius:5px}
.code{font-size:25px;color:var(--ink)}.code s{text-decoration:none;color:var(--clay)}`,
`<div class="wrap"><div class="top">${logo(33)}<h1>What juice <em>gives you</em></h1></div>
${tile('When every limit resets', 'How long, or which day and time, right next to it.', cells(one('session'), one('week')))}
${tile('Warnings you can\'t miss', 'Amber ! when you\'re going fast, red !! when nearly out.', cells(one('week'), one('memory', full)))}
${tile('Fable has its own battery', 'Its own weekly limit, in its own violet battery.', cells(one('fable')))}
${tile(`${LOOKS.length} looks, ${Object.keys(PRESETS).length} colour sets`, 'One click each, with colour-blind safe and light-terminal sets.', cells(look('retro'), look('basics')) + `<div>${Object.keys(PRESETS).map(sw).join('')}</div>`)}
${tile('Safe to try', 'Your old status line is saved and comes back in one step.', cmd('/juice restore') + '<div class="mono" style="color:var(--green);font-size:25px">Your old status line is back.</div>')}
</div>`);

// ---------- The "Open the live customizer" button: a link in the README, so its corners stay see-through ----------
const BW = 460;
const button = page(BW, 200, `html,body{background:transparent}
.btn{position:absolute;top:0;left:0;right:0;height:84px;display:flex;align-items:center;gap:16px;padding:0 26px 0 24px;border-radius:14px;
background:linear-gradient(180deg,#eda07c,#dc7a52);border:1px solid #c96a43;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -3px 0 rgba(0,0,0,.14);
color:#1d1410;font-size:26px;white-space:nowrap;font-weight:700;letter-spacing:-.01em}
.btn .bat{width:38px;height:22px;flex:none}.btn .bat b{width:55%;background:currentColor}.btn s{text-decoration:none;margin-left:auto;font-weight:500}`,
`<div class="btn"><span class="bat"><b></b></span>Open the live customizer<s>→</s></div>`);

const br = await browser();
await shoot(br, 'hero', hero);
await shoot(br, 'features', features);
await shoot(br, 'open-customizer', button, BW, 0, { clear: true });
await br.close();
