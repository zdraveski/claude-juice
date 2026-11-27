// Draws docs/images/anatomy-*.png, colours-*.png, looks-*.png, colour-sets-*.png and fuse-*.png with juice's own renderer, each for
// GitHub's dark and light themes, in the same GitHub box as the hero.
// Run: node scripts/pictures/readme.mjs (needs Playwright installed globally, npm i -g playwright, ffmpeg and the network, for Google Fonts).
import { browser, shoot } from './shot.mjs';
import { busy, LOOKS, PRESETS, NEUTRAL, SAMPLES, THEMES, line, head, page } from './common.mjs';

const W = 1280, TALL = 4000;
const withLimit = (d, id, used) => ({ ...d, limits: { ...d.limits, [id]: { ...d.limits[id], used } } });
const low = withLimit(busy, 'session', 93);
const box = (theme, css, title, hint, body) => page(theme, W, TALL, css, `<div class="box">${head(title, hint)}${body}</div>`);
const term = (html) => `<div class="term">${html}</div>`;

// ---------- 1. Anatomy: the whole line once, each part numbered, then what each number means ----------
// The real full line, cut at its dividers; the model and effort share a group, split at the space between them.
const GROOVE = /<span style="[^"]*"> {2}<\/span><span class="cell" style="[^"]*"><\/span><span style="[^"]*"> {2}<\/span>/;
const KEY = [['Model', 'the model Claude is using.'], ['Effort', 'how hard Claude is thinking: more bars, more effort.'],
  ['Memory', 'how full this chat is. It has no reset time.'], ['Session', 'the 5-hour limit: used so far, and the time left before it resets.'],
  ['Fable', 'its own limit, in its own violet battery.'], ['Weekly', 'the weekly limit, with its reset day and time. A ! or !! warns you.']];
const anatomy = (theme) => {
  const SPACE = `<span style="color:${NEUTRAL[theme].fg}">  </span>`;
  const [modelEffort, ...groups] = line(busy, {}, 400, theme).html.replace(/^<div class="ln">|<\/div>$/g, '').split(GROOVE);
  const cut = modelEffort.indexOf(SPACE);
  const pieces = [modelEffort.slice(0, cut), modelEffort.slice(cut + SPACE.length), ...groups];
  if (cut < 0 || pieces.length !== KEY.length) throw new Error(`anatomy: the line split into ${pieces.length} parts, expected ${KEY.length}`);
  return box(theme, `.whole{display:flex;flex-wrap:wrap;gap:20px 40px;align-items:flex-start;padding:26px 28px 22px}
.part{display:flex;flex-direction:column;align-items:center;gap:10px}
.key{display:grid;grid-template-columns:repeat(3,1fr);gap:22px 40px;padding:24px 28px 26px}
.key div{display:flex;gap:14px;align-items:flex-start}.key p{color:var(--sub);line-height:1.4}.key p b{color:var(--ink);font-weight:600}`,
  'Reading the status line', 'Each part numbered',
  `<div class="row whole">${pieces.map((h, i) => `<div class="part">${term(`<div class="ln">${h}</div>`)}<b class="n">${i + 1}</b></div>`).join('')}</div>
<div class="row key">${KEY.map(([name, text], i) => `<div><b class="n">${i + 1}</b><p><b>${name}:</b> ${text}</p></div>`).join('')}</div>`);
};

// ---------- 2. Colours: fine, going fast, Fable, nearly out ----------
// Where the pace marker sits, in characters from the start of the line (each drawn cell is one character).
const markAt = (html) => { const b = html.slice(0, html.indexOf('<span class="cell" style="background:linear-gradient(90deg,rgb(')); return (b.match(/class="cell"/g) || []).length + b.split(/<[^>]+>/).join('').length; };
const colours = (theme) => {
  const one = (id, data = busy) => line(data, { show: [id] }, 400, theme);
  const row = (tone, lead, text, l, call = false) => `<div class="row"><div><h3><i class="dot" style="background:var(--${tone})"></i>${lead}</h3><p class="sub">${text}</p></div>
<div class="term${call ? ' pace' : ''}">${call ? `<div class="call" style="left:${markAt(l.html) + 0.5}ch"><span>even pace</span><i></i></div>` : ''}${l.html}</div></div>`;
  return box(theme, `.row{display:grid;grid-template-columns:480px 1fr;gap:40px;align-items:center;padding:20px 28px}
h3{font-size:22px;font-weight:600;margin-bottom:4px}.dot{display:inline-block;width:16px;height:16px;border-radius:4px;margin-right:12px}
.pace{position:relative;padding-top:54px}
.call{position:absolute;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;line-height:1}
.call span{font-family:'Mona Sans',system-ui,sans-serif;font-size:20px;font-weight:600;color:var(--ink)}
.call i{position:relative;display:block;width:3px;height:12px;margin-top:6px;background:var(--ink)}
.call i::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:7px solid transparent;border-top:9px solid var(--ink);border-bottom:0}`,
  'Colours tell you how it\'s going', 'Not only how much is used, but how fast',
  row('good', 'Green: plenty left.', 'At this pace you\'ll be fine until it resets. The thin line marks an even pace.', one('session'), true) +
  row('watch', 'Amber with !: a bit fast.', 'At this pace you will use most of it before it resets.', one('week')) +
  row('fable', 'Violet: Fable, while fine.', 'Fable has its own colour, then warns like the others.', one('fable')) +
  row('bad', 'Red with !!: nearly out.', 'Almost empty, or on track to run out before it resets. It tells you when.', one('session', low)));
};

// ---------- 3. All the looks, numbered as /juice look takes them, each showing the same Session and Weekly ----------
const looks = (theme) => box(theme, `.row{display:grid;grid-template-columns:30px 250px 1fr;gap:24px;align-items:center;padding:11px 28px}
.num{color:var(--sub);text-align:right;font-variant-numeric:tabular-nums}.name{font-weight:600}.hint .code{color:var(--ink)}`,
`${LOOKS.length} ready-made looks`, 'Pick one in the customizer, or type <span class="code">/juice look 5</span> in Claude Code',
LOOKS.map((l, n) => `<div class="row"><span class="num">${n + 1}</span><span class="name">${l.name}</span>${term(line(busy, { ...l.set, show: ['session', 'week'], cost: 'off', refills: 'warnings' }, 400, theme).html)}</div>`).join(''));

// ---------- 4. Every colour set: a battery with plenty left, one going fast and one nearly out ----------
const LEVELS = [withLimit(busy, 'session', 20), withLimit(busy, 'session', 55), withLimit(busy, 'session', 96)];
const pill = (html) => html.match(/<span class="cell"[\s\S]*?■<\/span>/)[0]; // the battery alone, without its name
const sets = (theme) => box(theme, `.row{display:grid;grid-template-columns:440px repeat(3,1fr);gap:24px;align-items:center;padding:12px 28px}
.cols{padding:12px 28px;color:var(--sub);font-weight:500;background:var(--box)}.name{font-weight:600;margin-right:12px}`,
`${Object.keys(PRESETS).length} colour sets`, 'Each for dark and light terminals, or make your own',
`<div class="row cols"><span>Set</span><span>Plenty left</span><span>Going fast !</span><span>Nearly out !!</span></div>`
+ Object.entries(PRESETS).map(([id, p]) => `<div class="row"><div><span class="name">${p.name}</span><span class="sub">${p.note}</span></div>${LEVELS.map((d) => term(`<div class="ln">${pill(line(d, { colors: id, show: ['session'], refills: 'warnings' }, 400, theme).html)}</div>`)).join('')}</div>`).join(''));

// ---------- 5. The Fuse layout: calm, busy and in trouble ----------
const FUSE_ROWS = [['quiet', 'Calm: every limit is fine'], ['busy', 'Busy: Weekly is going a bit fast'], ['trouble', 'In trouble: Session runs out at 2:44 and refills at 4:25']];
const fuse = (theme) => box(theme, `.row{padding:12px 28px}.cap{color:var(--sub);margin-bottom:6px}`,
  'The Fuse layout', 'Type <span class="code">/juice set layout=fuse</span> in Claude Code',
  FUSE_ROWS.map(([id, cap]) => `<div class="row"><div class="cap">${cap}</div>${term(line(SAMPLES[id], { layout: 'fuse' }, 400, theme).html)}</div>`).join(''));

const br = await browser();
for (const theme of THEMES) {
  await shoot(br, `anatomy-${theme}`, anatomy(theme));
  await shoot(br, `colours-${theme}`, colours(theme));
  await shoot(br, `looks-${theme}`, looks(theme));
  await shoot(br, `colour-sets-${theme}`, sets(theme));
  await shoot(br, `fuse-${theme}`, fuse(theme));
}
await br.close();
