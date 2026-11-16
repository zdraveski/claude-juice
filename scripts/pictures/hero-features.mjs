// Draws docs/images/hero-*.png, features-*.png and open-customizer-*.png (the README's button), each for GitHub's dark and
// light themes, plus hero.png: the dark hero at 1280x640, the size GitHub and link previews want. Every status line in them
// comes from juice's own renderer.
// Run: node scripts/pictures/hero-features.mjs (needs Playwright installed globally, npm i -g playwright, ffmpeg and the network, for Google Fonts).
import { browser, shoot } from './shot.mjs';
import { busy, LOOKS, PRESETS, THEMES, line, brand, head, page } from './common.mjs';

const W = 1280, TALL = 4000;
// A chat that is nearly full: the one red battery, so the pictures show all three states.
const full = { ...busy, memoryUsed: 91 };
const look = (id) => LOOKS.find((x) => x.id === id);
const nb = (s) => `<span style="white-space:nowrap">${s}</span>`; // keeps a hyphenated word on one line
const lines = (ls) => `<div class="lines">${ls.map((l) => `<div class="term">${l.html}</div>`).join('')}</div>`;

// ---------- Hero: a GitHub box, the same numbers drawn in five of the looks; also the social preview, so 1280x640 ----------
const HERO_LOOKS = ['juice', 'spotlight', 'retro', 'capsule', 'roadtrip'];
const hero = (theme) => page(theme, W, 640, `
.box{position:absolute;inset:32px;display:flex;flex-direction:column}
.head{gap:28px;padding:22px 32px}.pitch{font-size:27px;font-weight:500;letter-spacing:-.01em}
.row{flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 28px}.name{font-size:21px;font-weight:600;margin-bottom:5px}.name span{font-weight:400;color:var(--sub);margin-left:10px}`,
`<div class="box"><div class="head">${brand(48)}<div class="pitch">Your Claude Code limits as batteries, right under the prompt.</div></div>
${HERO_LOOKS.map((id) => { const l = look(id); return `<div class="row"><div class="name">${l.name}<span>${l.note}</span></div><div class="term">${line(busy, { ...l.set, show: ['memory', 'session', 'week'], cost: 'off', refills: 'warnings' }, 400, theme).html}</div></div>`; }).join('')}
</div>`);

// ---------- Features: five rows, what it does on the left and the real line on the right ----------
const features = (theme) => {
  const one = (id, data = busy) => line(data, { show: [id] }, 400, theme);
  const inLook = (id) => line(busy, { ...look(id).set, show: ['session'], cost: 'off', refills: 'warnings' }, 400, theme);
  const row = (title, text, visual) => `<div class="row"><div><h3>${title}</h3><p class="sub">${text}</p></div>${visual}</div>`;
  return page(theme, W, TALL, `
.row{display:grid;grid-template-columns:540px 1fr;gap:40px;align-items:center;padding:20px 28px}
h3{font-size:22px;font-weight:600;margin-bottom:4px}.lines{display:grid;gap:6px}.ok{color:var(--good)}`,
  `<div class="box">${head('What you get')}
${row('When every limit resets', 'How long, or which day and time, right next to it.', lines([one('session'), one('week')]))}
${row('Warnings you can\'t miss', 'Amber ! when you\'re going fast, red !! when nearly out.', lines([one('week'), one('memory', full)]))}
${row('Fable has its own battery', 'Its own weekly limit, in its own violet battery.', lines([one('fable')]))}
${row(`${LOOKS.length} looks, ${Object.keys(PRESETS).length} colour sets`, `Shown: Night owl, Easy to see and ${nb('Colour-blind')} friendly. One click each, with ${nb('colour-blind')} safe and ${nb('light-terminal')} sets.`, lines([inLook('nightowl'), inLook('easy'), inLook('colorblind')]))}
${row('Safe to try', 'Your old status line is saved and comes back in one step.', `<div class="lines"><div class="code"><s>&gt;</s> /juice restore</div><div class="term ok">Your old status line is back.</div></div>`)}
</div>`);
};

// ---------- The "Open the live customizer" button: a link in the README, so its corners stay see-through ----------
const BW = 520;
const button = (theme) => page(theme, BW, 200, `html,body{background:transparent}
.btn{position:absolute;top:0;left:0;right:0;height:76px;display:flex;align-items:center;gap:16px;padding:0 28px;border-radius:12px;
background:var(--accent);color:var(--on-accent);font-size:28px;font-weight:700;white-space:nowrap;letter-spacing:-.01em}
.btn .bat{font-size:34px;border-color:currentColor}.btn .bat::after,.btn .bat b{background:currentColor}.btn s{text-decoration:none;margin-left:auto;font-weight:500}`,
`<div class="btn"><span class="bat"><b></b></span>Open the live customizer<s>→</s></div>`);

const br = await browser();
for (const theme of THEMES) {
  await shoot(br, `hero-${theme}`, hero(theme), { height: 640 });
  await shoot(br, `features-${theme}`, features(theme));
  await shoot(br, `open-customizer-${theme}`, button(theme), { width: BW, shown: 340, clear: true });
}
await shoot(br, 'hero', hero('dark'), { height: 640, scale: 1 });
await br.close();
