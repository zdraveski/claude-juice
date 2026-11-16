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
h3{font-size:44px;letter-spacing:-.01em;line-height:1.1;margin:20px 0 8px;display:flex;align-items:center;gap:14px}
p{color:var(--sub);font-size:33px;line-height:1.3}p b{color:var(--ink);font-weight:600}
.nowrap{white-space:nowrap}.cmd{color:var(--ink);font-size:25px}
.n{flex:none;width:44px;height:44px;border-radius:50%;background:var(--clay);color:#141312;display:grid;place-items:center;font-size:25px;font-weight:700}`;
const head = (title, sub) => `<div class="top">${logo(33)}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const doc = (css, title, sub, body) => page(W, TALL, COMMON + css, `<div class="wrap">${head(title, sub)}${body}</div>`);
const lines = (ls) => ls.map((l) => l.html).join('');

// ---------- 1. Anatomy: the whole line once, each part numbered, then what each number means ----------
// The real full line, cut at its dividers; the model and effort share a group, split at the space between them.
const GROOVE = /<span style="[^"]*"> {2}<\/span><span class="cell" style="[^"]*"><\/span><span style="[^"]*"> {2}<\/span>/;
const SPACE = '<span style="color:#cccccc">  </span>';
const [modelEffort, ...groups] = lineAt(busy, {}).html.replace(/^<div class="ln">|<\/div>$/g, '').split(GROOVE);
const cut = modelEffort.indexOf(SPACE);
const pieces = [modelEffort.slice(0, cut), modelEffort.slice(cut + SPACE.length), ...groups];
const KEY = [['Model', 'the model Claude is using.'], ['Effort', 'how hard Claude is thinking: more bars, more effort.'],
  ['Memory', 'how full this chat is. It has no reset time.'], ['Session', 'the 5-hour limit: used so far, and the time left before it resets.'],
  ['Fable', 'its own limit, in its own violet battery.'], ['Weekly', 'the weekly limit, with its reset day and time. A ! or !! warns you.']];
if (cut < 0 || pieces.length !== KEY.length) throw new Error(`anatomy: the line split into ${pieces.length} parts, expected ${KEY.length}`);
const anatomy = doc(`.whole{display:flex;flex-wrap:wrap;gap:22px 30px;align-items:flex-start;padding:20px}
.part{display:flex;flex-direction:column;align-items:center;gap:12px}
.key{display:grid;gap:22px;margin-top:8px}.key div{display:flex;gap:18px;align-items:flex-start}.key .n{margin-top:2px}`,
'Reading the <em>status line</em>', 'The whole line, wrapped to fit, with each part numbered.',
`<div class="box term whole">${pieces.map((h, i) => `<div class="part"><div class="ln">${h}</div><b class="n">${i + 1}</b></div>`).join('')}</div>
<div class="key">${KEY.map(([name, text], i) => `<div><b class="n mono">${i + 1}</b><p><b>${name}:</b> ${text}</p></div>`).join('')}</div>`);

// ---------- 2. Colours: fine, going fast, nearly out, Fable ----------
// Where the pace marker sits, in characters from the start of the line (each drawn cell is one character).
const markAt = (html) => { const b = html.slice(0, html.indexOf('<span class="cell" style="background:linear-gradient(90deg,rgb(')); return (b.match(/class="cell"/g) || []).length + b.split(/<[^>]+>/).join('').length; }; // counts text, cleans nothing
const tell = (accent, lead, text, l, what, call = false) => `<div class="card"><div class="box term${call ? ' pace' : ''}">${call ? `<div class="call" style="left:calc(16px + ${markAt(l.html) + 0.5}ch)">even pace<i></i></div>` : ''}${fits(l, what).html}</div>
<p style="margin-top:18px"><i class="dot" style="background:${accent}"></i><b>${lead}</b> ${text}</p></div>`;
const colours = doc(`.dot{display:inline-block;width:18px;height:18px;border-radius:5px;margin-right:14px;vertical-align:.04em}
.pace{position:relative;padding-top:80px}
.call{position:absolute;top:14px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;color:var(--ink);line-height:1;white-space:nowrap}
.call i{position:relative;display:block;width:3px;height:14px;margin-top:6px;background:var(--ink)}
.call i::after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:8px solid transparent;border-top:10px solid var(--ink);border-bottom:0}`,
'Colours tell you <em>how it\'s going</em>', 'Not only how much is used, but how fast you are going.',
  tell('var(--green)', 'Green: plenty left.', 'At this pace you\'ll be fine until it resets. The thin line marks an even pace.', one('session'), 'green', true) +
  tell('var(--amber)', 'Amber with !: a bit fast.', 'At this pace you will use most of it before it resets.', one('week'), 'amber') +
  tell('var(--violet)', 'Violet: Fable, while fine.', 'Fable has its own colour, then warns like the others.', one('fable'), 'violet') +
  tell('var(--red)', 'Red with !!: nearly out.', 'Almost empty, or on track to run out before it resets. It tells you when.', one('session', low), 'red'));

// ---------- 3. Four looks that differ, numbered as /juice look takes them, then the rest by number ----------
const SOME_LOOKS = ['juice', 'retro', 'easy', 'roadtrip'], SOME_SETS = ['claude', 'safe', 'midnight', 'candy'];
const lookCard = (l, n) => {
  const rs = ['session', 'week'].map((id) => fits(line(busy, { ...l.set, show: [id], cost: 'off' }), `${l.name} ${id}`));
  return `<div class="card"><div class="box term" style="display:grid;gap:8px">${lines(rs)}</div><h3><b class="num">${n + 1}</b>${l.name}</h3><p>${l.note}</p></div>`;
};
const rest = LOOKS.map((l, n) => [l, n]).filter(([l]) => !SOME_LOOKS.includes(l.id));
const looks = doc('.num{flex:none;width:52px;height:52px;border-radius:12px;background:var(--clay);color:#141312;display:grid;place-items:center;font-size:33px}.more b{color:var(--clay)}',
  `${LOOKS.length} <em>ready-made looks</em>`, 'Pick one in the customizer, or type <span class="mono cmd nowrap">/juice look 5</span> in Claude Code.',
  LOOKS.map((l, n) => SOME_LOOKS.includes(l.id) ? lookCard(l, n) : '').join('') +
  `<div class="card more"><h3 style="margin-top:0">+ ${rest.length} more</h3><p>${rest.map(([l, n]) => `<b>${n + 1}</b>&nbsp;${l.name.replaceAll(' ', '&nbsp;')}`).join(', ')}.</p></div>`);

// ---------- 4. A few colour sets on dark: a fine, a fast and a nearly-out battery, named in words too; then chips for the rest ----------
const fine = withLimit(busy, 'session', 20), amber = withLimit(busy, 'session', 55), red = withLimit(busy, 'session', 96);
const LEVELS = [[fine, 'fine'], [amber, 'fast !'], [red, 'nearly out !!']];
const pill = (html) => html.match(/<span class="cell"[\s\S]*?■<\/span>/)[0]; // the battery alone, without its name
const setCard = (id) => {
  const p = PRESETS[id];
  const bs = LEVELS.map(([d, word], i) => { const l = fits(line(d, { colors: id, show: ['session'], refills: 'warnings' }), `${p.name} ${word}`); return `<div class="lv"><div class="ln">${pill(l.html)}</div><span style="color:${p.dark[i]}">${word}</span></div>`; });
  return `<div class="card"><h3 style="margin-top:0">${p.name}</h3><p>${p.note}</p><div class="box term trio">${bs.join('')}</div></div>`;
};
const others = Object.keys(PRESETS).filter((id) => !SOME_SETS.includes(id));
const chip = (id) => `<span class="chip"><span class="sw">${PRESETS[id].dark.slice(0, 3).map((c) => `<i style="background:${c}"></i>`).join('')}</span>${PRESETS[id].name}</span>`;
const sets = doc(`.trio{display:flex;gap:28px;margin-top:18px}.lv{display:flex;flex-direction:column;gap:6px}
.chips{display:flex;flex-wrap:wrap;gap:14px 28px;margin-top:6px}.chip{display:inline-flex;align-items:center;gap:12px;font-size:33px;color:var(--sub)}
.sw{display:inline-flex;gap:3px}.sw i{width:18px;height:28px;border-radius:4px}`,
  `${Object.keys(PRESETS).length} <em>colour sets</em>`, 'Shown on a dark terminal. Each has a light-terminal version too, and you can make your own.',
  SOME_SETS.map(setCard).join('') + `<div class="card"><h3 style="margin-top:0">+ ${others.length} more</h3><div class="chips">${others.map(chip).join('')}</div></div>`);

const br = await browser();
await shoot(br, 'anatomy', anatomy);
await shoot(br, 'colours', colours);
await shoot(br, 'looks', looks);
await shoot(br, 'colour-sets', sets);
await br.close();
