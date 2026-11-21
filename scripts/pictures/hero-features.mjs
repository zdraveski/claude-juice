// Draws docs/images/hero-*.png (a Claude Code window with juice under the prompt), looks-grid-*.png (6 looks as cards),
// each for GitHub's dark and light themes, plus social.png: the link card at
// 1280x640. Every status line in them comes from juice's own renderer, which draws VS Code's round ends: the README says
// that other terminals show plain ends until /juice use round ends turns them on.
// Run: node scripts/pictures/hero-features.mjs (needs Playwright installed globally, npm i -g playwright, ffmpeg and the network, for Google Fonts).
import { browser, shoot } from './shot.mjs';
import { demo, LOOKS, THEMES, line, brand, page, WINDOW_CSS, winBar, prompt } from './common.mjs';

const W = 1280;
const look = (id) => LOOKS.find((x) => x.id === id);
const term = (html) => `<div class="term">${html}</div>`;
// 100 columns keeps all four batteries and the Weekly reset on one line at a size a phone can still read.
const heroLine = (theme) => line(demo, { show: ['memory', 'session', 'week', 'fable'], cost: 'off' }, 100, theme).html;

// ---------- Hero: one landscape Claude Code window, the real line under the prompt ----------
const hero = (theme) => page(theme, W, 640, `${WINDOW_CSS}
.box{position:absolute;inset:32px;display:flex;flex-direction:column;justify-content:space-between}
.chat{font-size:30px;gap:20px;padding-top:34px}.prompt{font-size:26px;padding:18px 22px}.under .term{font-size:20px}`,
`<div class="box win"><div>${winBar('claude', 'juice is the line under the prompt')}
<div class="chat"><div class="me"><b>&gt;</b>fix the rounding bug in checkout</div>
<div class="ai"><b>&#9679;</b>The total rounds before tax is added. I changed that.</div>
<div class="ai"><b>&#9679;</b>Edited src/checkout.js. All 12 tests pass.</div></div></div>
<div>${prompt('')}<div class="under">${term(heroLine(theme))}</div></div></div>`);

// ---------- Looks: 6 cards in 2 columns, the same Session and Weekly in each ----------
const GRID = ['juice', 'spotlight', 'everything', 'retro', 'capsule', 'colorblind'];
const grid = (theme) => page(theme, W, 4000, `.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{border:1.5px solid var(--line);border-radius:12px;background:var(--term);overflow:hidden}
.top{padding:18px 24px 6px}.top b{font-size:26px;font-weight:700;letter-spacing:-.01em}.top p{font-size:21px;color:var(--sub);line-height:1.35;margin-top:4px;min-height:2.7em}
.card .term{padding:14px 0 22px 16px;font-size:19.3px}`,
`<div class="g">${GRID.map((id) => { const l = look(id); return `<div class="card"><div class="top"><b>${l.name}</b><p>${l.note}</p></div>${term(line(demo, { ...l.set, show: ['session', 'week'], cost: 'off', refills: 'warnings' }, 53, theme).html)}</div>`; }).join('')}</div>`);

// ---------- Social: the link card. Logo, a big tagline, one big juice line; 40px safe margins ----------
const social = page('dark', W, 640, `.in{position:absolute;inset:40px;display:flex;flex-direction:column;justify-content:space-between}
h1{font-size:80px;line-height:1.08;font-weight:800;letter-spacing:-.025em;font-stretch:108%;margin-top:26px}
.box{padding:0}.box .term{font-size:28px;padding:34px 30px}`,
`<div class="in"><div>${brand(56)}<h1>See your Claude Code limits as batteries.</h1></div>
<div class="box">${term(line(demo, { show: ['memory', 'session', 'week'], cost: 'off' }, 70, 'dark').html)}</div></div>`);

const br = await browser();
for (const theme of THEMES) {
  await shoot(br, `hero-${theme}`, hero(theme), { height: 640 });
  await shoot(br, `looks-grid-${theme}`, grid(theme));
}
await shoot(br, 'hero', hero('dark'), { height: 640, scale: 1 });
await shoot(br, 'social', social, { height: 640, scale: 1, shown: 640 });
await br.close();
