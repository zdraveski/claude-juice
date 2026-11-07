// Draws docs/images/anatomy.png, colours.png, looks.png and colour-sets.png with juice's own renderer.
// Run: node scripts/pictures/readme.mjs (needs Playwright installed globally: npm i -g playwright).
import { browser, shoot } from './shot.mjs';
import { busy, LOOKS, PRESETS, line as lineAt, logo, page } from './common.mjs';

// ---------- Shared: 720px canvases, one column. Type scale: 25 code, 33 text, 44 titles, 59 headlines ----------
const W = 720, TALL = 6000, MAXCH = 38;
const line = (data, o) => lineAt(data, o, MAXCH); // a phone row is 38 characters; juice drops what doesn't fit
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

// ---------- 3. A few looks, each drawn with its own settings but limited to what fits, then the names of the rest ----------
const more = (names) => `<div class="card"><h3 style="margin-top:0">+ ${names.length} more</h3><p>${names.join(', ')}.</p></div>`;
const SOME_LOOKS = ['juice', 'basics', 'retro', 'easy'], SOME_SETS = ['claude', 'safe', 'midnight', 'candy'];
const lookCard = (l, n) => { const r = fits(line(busy, { ...l.set, show: ['session'], cost: 'off', refills: 'warnings' }), l.name); return `<div class="card"><div class="box term">${r.html}</div><h3><b class="num">${n + 1}</b>${l.name}</h3><p>${l.note}</p></div>`; };
const looks = doc('.num{flex:none;width:52px;height:52px;border-radius:12px;background:var(--clay);color:#141312;display:grid;place-items:center;font-size:33px}',
  `${LOOKS.length} <em>ready-made looks</em>`, 'One click in the customizer, or <span class="mono" style="color:var(--ink);font-size:25px">/juice look 7</span> in Claude Code.',
  LOOKS.map((l, n) => SOME_LOOKS.includes(l.id) ? lookCard(l, n) : '').join('') + more(LOOKS.filter((l) => !SOME_LOOKS.includes(l.id)).map((l) => l.name)));

// ---------- 4. A few colour sets on dark, each with a fine, an amber ! and a red !! battery, then the names of the rest ----------
const fine = withLimit(busy, 'session', 20), amber = withLimit(busy, 'session', 55), red = withLimit(busy, 'session', 96);
const setCard = ([id, p]) => {
  const ls = [fine, amber, red].map((d) => fits(line(d, { colors: id, show: ['session'], refills: 'warnings' }), p.name));
  return `<div class="card"><h3 style="margin-top:0">${p.name}</h3><p>${p.note}</p><div class="box term" style="margin-top:16px;display:grid;gap:8px">${ls.map((l) => `<div>${l.html}</div>`).join('')}</div></div>`;
};
const sets = doc('', `${Object.keys(PRESETS).length} <em>colour sets</em>`, 'Shown on a dark terminal. Each has a light-terminal version too, and you can make your own.',
  SOME_SETS.map((id) => setCard([id, PRESETS[id]])).join('') + more(Object.keys(PRESETS).filter((id) => !SOME_SETS.includes(id)).map((id) => PRESETS[id].name)));

const br = await browser();
await shoot(br, 'anatomy', anatomy);
await shoot(br, 'colours', colours);
await shoot(br, 'looks', looks);
await shoot(br, 'colour-sets', sets);
await br.close();
