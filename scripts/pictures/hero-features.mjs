// Draws docs/images/hero.png and features.png. Every status line in them comes from juice's own renderer.
// Run: node scripts/pictures/hero-features.mjs (needs Playwright installed globally: npm i -g playwright).
import { browser, shoot } from './shot.mjs';
import { busy, LOOKS, PRESETS, line, logo, page } from './common.mjs';

// ---------- Shared sizes ----------
// 720px canvases, one column. Type scale (1.333): 25 code, 33 text, 44 titles, 59 headlines, 78 wordmark.
const W = 720, TALL = 4000;
const one = (id, data = busy, o = {}) => line(data, { show: [id], ...o });
const rows = (ls) => `<div class="sl term">${ls.map((l) => `<div>${l.html}</div>`).join('')}</div>`;
const CTA = '<div class="cta"><s>&gt;</s>/plugin marketplace add<br>zdraveski/claude-juice</div>';
const COMMON = `.cta{font-size:25px;line-height:1.35;white-space:normal;align-items:flex-start}
.sl{background:#121212;border:1px solid var(--line);border-radius:18px;padding:24px 28px;font-size:25px;box-shadow:0 24px 60px rgba(0,0,0,.55);display:grid;gap:12px}
.sl .ln{height:1.4em;line-height:1.4}
.wrap{position:absolute;top:48px;left:40px;right:40px;display:flex;flex-direction:column;gap:32px}`;

// ---------- Hero: the wordmark on a soft glow, three batteries, the install command ----------
const hero = page(W, TALL, `${COMMON}
body{background:radial-gradient(440px 380px at 10% 4%,rgba(226,136,95,.30),transparent 70%),radial-gradient(440px 380px at 95% 60%,rgba(167,139,250,.26),transparent 70%),#151413}
.wrap{align-items:center;text-align:center}
.word{font:700 78px/0.95 'Space Grotesk';letter-spacing:-.045em}.word span{color:var(--clay)}
.for{font-size:33px;color:var(--sub);line-height:1.25;margin-top:-8px}
.sl{text-align:left;background:rgba(20,20,20,.86)}.wrap .cta{text-align:left}`,
`<div class="wrap"><div class="word">claude-<span>juice</span></div><div class="for">A battery-style status line<br>for Claude Code</div>
${rows([one('memory'), one('session'), one('week')])}${CTA}</div>`);

// ---------- Features: one tile per row ----------
const look = (id) => { const l = LOOKS.find((x) => x.id === id); return line(busy, { ...l.set, show: ['session'], cost: 'off', refills: 'warnings' }); };
const sw = (id) => `<span class="sw">${PRESETS[id].dark.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
const tile = (accent, title, text, visual) => `<div class="tile"><div class="vis">${visual}</div><h3><i style="background:${accent}"></i>${title}</h3><p>${text}</p></div>`;
const cells = (...ls) => ls.map((l) => `<div class="term">${l.html}</div>`).join('');
const cmd = (...cs) => cs.map((c) => `<div class="code mono"><s>&gt;</s> ${c}</div>`).join('');
const features = page(W, TALL, `
.wrap{position:absolute;top:48px;left:40px;right:40px;display:flex;flex-direction:column;gap:24px}
.top{display:flex;flex-direction:column;gap:20px;margin-bottom:8px}h1{font-size:59px;letter-spacing:-.025em;line-height:1.05}h1 em{font-style:normal;color:var(--clay)}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:22px;padding:22px 22px 26px}
.vis{background:#141414;border:1px solid #2a2826;border-radius:14px;padding:16px 16px;display:flex;flex-direction:column;gap:10px;font-size:25px;overflow:hidden}
h3{font-size:44px;letter-spacing:-.01em;line-height:1.1;margin:22px 0 8px;display:flex;align-items:center;gap:14px}h3 i{width:16px;height:16px;border-radius:4px;flex:none}
p{color:var(--sub);font-size:33px;line-height:1.3}
.sw{display:inline-flex;gap:4px;margin:4px 14px 6px 0}.sw i{width:22px;height:22px;border-radius:5px}
.code{font-size:25px;color:var(--ink)}.code s{text-decoration:none;color:var(--clay)}`,
`<div class="wrap"><div class="top">${logo(33)}<h1>Everything juice <em>gives you</em></h1></div>
${tile('var(--green)', 'Used %, like Anthropic', 'Session, Weekly and Fable match Anthropic\'s usage page.', cells(one('session', busy, { refills: 'warnings' }), one('fable')))}
${tile('var(--amber)', 'When every limit resets', 'How long, or which day and time, right next to it.', cells(one('session'), one('week')))}
${tile('var(--red)', 'Warnings you can\'t miss', 'Amber ! when you\'re going fast, red !! when nearly out.', cells(one('week'), one('memory', { ...busy, memoryUsed: 91 })))}
${tile('var(--violet)', 'Fable stands apart', 'Fable gets its own battery, violet in most colour sets.', cells(one('fable')))}
${tile('var(--clay)', LOOKS.length + ' ready-made looks', 'From “Just the basics” to “Everything”, in one click.', cells(look('retro'), look('basics')))}
${tile('var(--green)', Object.keys(PRESETS).length + ' colour sets', 'Dark or light terminal, colour-blind safe, or your own.', `<div>${Object.keys(PRESETS).map(sw).join('')}</div>`)}
${tile('var(--amber)', 'Live in every window', 'Idle windows and new chats stay current (Fable battery on).', cells(one('memory'), one('session')))}
${tile('var(--violet)', 'Just say it: /juice', 'Plain words in Claude Code, or the web customizer.', cmd('/juice use the quiet look', '/juice looks'))}
${tile('var(--red)', 'Safe to try', 'Your old status line is saved and comes back in one step.', cmd('/juice restore') + '<div class="mono" style="color:var(--green);font-size:25px">Your old status line is back.</div>')}
</div>`);

const br = await browser();
await shoot(br, 'hero', hero);
await shoot(br, 'features', features);
await br.close();
