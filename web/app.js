// The customizer page. All drawing of the status line is done by ../src/render; this file only builds controls and converts its ANSI to HTML.
import { render } from '../src/render/index.js';
import { RESERVE } from '../src/render/fit.js';
import { DEFAULTS, STYLE_LAYOUTS, LOOKS, COLOR_KEYS as KEYS, sanitize, applySet, toCommand, encodeLink, parseLink } from '../src/schema.js';
import { PRESETS, NEUTRAL } from '../src/render/palette.js';
import { SAMPLES, withAccount } from '../src/samples.js';
import { contrast } from '../src/render/ansi.js';

const BATTERIES = ['memory', 'session', 'fable', 'week'];
const COLOR_NAMES = ['Plenty left', 'Going fast', 'Almost empty', 'Accent'];
const WIDTHS = { small: 80, medium: 120, wide: 400 };
const LAYOUTS = {
  bar: ['Status bar', 'Compact, the number with each battery'],
  segments: ['Classic segments', 'Five bars, like an old phone'],
  focus: ['Tightest first', 'The one to watch gets the spotlight'],
  panel: ['Panel', 'One row each, everything spelled out'],
  pills: ['Capsules', 'Rounded capsules that fill with colour when they need you'],
  tank: ['Fuel tank', 'Shows what is left, like a fuel gauge'],
};
const SHOW = {
  model: ['Model', 'Which Claude you are using'],
  effort: ['Effort', 'How hard Claude is thinking, from low to max'],
  memory: ['Memory', 'How much of the room in this chat is used'],
  session: ['Session', 'Your 5-hour limit'],
  week: ['Weekly', 'Your weekly limit'],
  fable: ['Fable weekly', 'The separate weekly limit for Fable'],
  budget: ['Budget', "Your company's spending limit. Shows only if you have one, so the preview can't show it."],
};
const NOT_ON = { session: { payg: 'API keys have no session limit' }, week: { payg: 'API keys have no weekly limit' }, fable: { payg: 'API keys have no Fable limit', pro: 'The preview hides it on Pro' } };
const DETAILS = [
  ['order', 'Battery order', 'Keep the order above, or let the batteries move as things change', [['yours', 'As above'], ['urgent', 'Needs you first'], ['fullest', 'Fullest first']]],
  // The preview shows Automatic as rounded, so say plainly where it really is rounded.
  ['ends', 'Battery ends', 'Rounded ends need a terminal that can draw them. Automatic picks Rounded in VS Code and Plain elsewhere.', [['auto', 'Automatic'], ['round', 'Rounded'], ['plain', 'Plain']]],
  ['battery', 'Battery style', 'How the batteries are drawn, or a shape instead. Classic is the old flat look', [['glossy', 'Glossy'], ['classic', 'Classic'], ['outline', 'Outline'], ['hot', 'Hot tip'], ['liquid', 'Liquid edge'], ['pace', 'Pace glow'],
    ['pie', 'Pie'], ['sand', 'Sand'], ['slider', 'Slider'], ['race', 'Pace race'], ['lives', 'Lives'], ['dots', 'Dots'], ['chevrons', 'Chevrons'], ['ruler', 'Ruler']]],
  ['refills', 'Reset times', 'Always show them, or only when something needs attention', [['always', 'Always'], ['warnings', 'Only when needed']]],
  ['motion', 'Motion', 'Still draws once. Animated redraws every second and uses about one sixth of a CPU core per open window.', [['off', 'Still'], ['on', 'Animated']]],
  // Without this the copied command can't fix dark colours on a light terminal: the Dark/Light switch above only changes the preview.
  ['terminal', "Your terminal's theme", 'Automatic follows Claude Code’s theme. Pick Light if the text is hard to read on a light background', [['auto', 'Automatic'], ['dark', 'Dark'], ['light', 'Light']]],
];

const phone = matchMedia('(max-width:700px)');
// Wide on a phone too: Small still ran past a phone's edge and dropped the battery pictures. The line scrolls sideways instead.
const view = { state: 'busy', term: 'dark', width: 'wide', plan: 'max', model: 'Opus 5.5', hover: null };
let s, order, customs; // settings, full row order (hidden ones too), colour-picker values per terminal

const arr = (c, t) => KEYS.map((k) => c[t][k]);
const obj = (a) => Object.fromEntries(KEYS.map((k, i) => [k, a[i]]));
const presetArrs = (id) => ({ dark: PRESETS[id].dark.slice(), light: PRESETS[id].light.slice() });
const SAVED = 'juice-settings';
function adopt(next) {
  s = next;
  const shown = s.show.filter((id) => BATTERIES.includes(id));
  order = [...shown, ...BATTERIES.filter((id) => !shown.includes(id))];
  customs = typeof s.colors === 'string' ? presetArrs(s.colors) : { dark: arr(s.colors, 'dark'), light: arr(s.colors, 'light') };
}
const setShow = (id, on) => {
  const want = new Set(on ? [...s.show, id] : s.show.filter((x) => x !== id));
  s = { ...s, show: ['model', 'effort', ...order, 'budget'].filter((x) => want.has(x)) };
};
const reorder = () => { s = { ...s, show: ['model', 'effort', ...order, 'budget'].filter((x) => s.show.includes(x)) }; };

// ---------- ANSI -> HTML (only the codes src/render/ansi.js emits); block and pill glyphs are drawn per cell like VS Code ----------
const LEFTS = '▏▎▍▌▋▊▉█', LOWERS = '▁▂▃▄▅▆▇';
function glyph(ch, f, b0) {
  const b = b0 || 'transparent';
  let i = LEFTS.indexOf(ch);
  if (i >= 0) { const p = ((i + 1) / 8) * 100; return `linear-gradient(90deg,${f} ${p}%,${b} ${p}%)`; }
  i = LOWERS.indexOf(ch);
  if (i >= 0) { const p = ((i + 1) / 8) * 100; return `linear-gradient(0deg,${f} ${p}%,${b} ${p}%)`; }
  // At least 1.5px wide, so the even-pace tick stays visible at normal zoom.
  if (ch === '│') return `linear-gradient(90deg,${b} calc(50% - .75px),${f} calc(50% - .75px),${f} calc(50% + .75px),${b} calc(50% + .75px))`;
  if (ch === '') return `radial-gradient(ellipse 100% 50% at 100% 50%,${f} 97%,transparent 100%) ${b}`;
  if (ch === '') return `radial-gradient(ellipse 100% 50% at 0% 50%,${f} 97%,transparent 100%) ${b}`;
  return null;
}
const esc = (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] || c;
// A browser has no terminal palette, so colors=terminal previews in VS Code's default 16.
const ANSI16 = ['#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5', '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff'];
function ansiToHtml(text, termFg) {
  return text.split('\n').map((ln) => {
    let f0 = null, b0 = null, bo = false, out = '', run = '', runStyle = '';
    const flush = () => { if (run) out += `<span style="${runStyle}">${run}</span>`; run = ''; };
    for (const m of ln.matchAll(/\x1b\[([0-9;]*)m|[\s\S]/gu)) {
      if (m[1] !== undefined) {
        const p = (m[1] || '0').split(';').map(Number);
        for (let i = 0; i < p.length; i++) {
          const c = p[i];
          if (c === 0) { f0 = b0 = null; bo = false; } else if (c === 1) bo = true; else if (c === 22) bo = false;
          else if (c === 39) f0 = null; else if (c === 49) b0 = null;
          else if (c >= 30 && c <= 37 || c >= 90 && c <= 97) f0 = ANSI16[c < 90 ? c - 30 : c - 82];
          else if (c >= 40 && c <= 47 || c >= 100 && c <= 107) b0 = ANSI16[c < 100 ? c - 40 : c - 92];
          else if ((c === 38 || c === 48) && p[i + 1] === 2) { const col = `rgb(${p[i + 2]},${p[i + 3]},${p[i + 4]})`; i += 4; if (c === 38) f0 = col; else b0 = col; }
        }
        continue;
      }
      const ch = m[0], f = f0 || termFg, g = glyph(ch, f, b0);
      const style = `color:${f}${b0 ? `;background:${b0}` : ''}${bo ? ';font-weight:700' : ''}`;
      if (g) { flush(); out += `<span class="cell" style="background:${g}"></span>`; }
      else { if (style !== runStyle) { flush(); runStyle = style; } run += esc(ch); }
    }
    flush();
    return `<div class="ln">${out}</div>`;
  }).join('');
}

// ---------- preview ----------
const terminal = (columns, st = s) => ({ columns, theme: view.term, ends: st.ends === 'plain' ? 'plain' : 'round', colorDepth: 'truecolor' });
const sample = () => withAccount({ ...SAMPLES[view.state], model: { name: view.model, isFable: view.model.startsWith('Fable') } }, view.plan);
// A real status line keeps a few columns free for Claude Code's indent, so the preview of an 80-column window does too.
const drawn = (settings, columns) => render(sample(), settings, terminal(columns - RESERVE, settings));
const LOOK = Object.fromEntries(LOOKS.map((l) => [l.id, l]));
// What a hovered card previews: view.hover is 'look:<id>' or 'layout:<id>'.
const peek = (key) => { const [kind, id] = (key || '').split(':'); return kind === 'look' ? LOOK[id] : kind === 'layout' ? { name: LAYOUTS[id][0], set: { layout: id } } : null; };
const offered = (id) => id === 'memory' || (view.plan !== 'payg' && (id !== 'fable' || view.plan === 'max'));

// ---------- the page ----------
const $ = (id) => document.getElementById(id);
const segHtml = (key, opts, label) => `<div class="seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button type="button" data-key="${key}" data-v="${v}">${t}</button>`).join('')}</div>`;

function buildShow() {
  const fixedRow = (k) => `<div class="row"><span class="grip none"></span><div class="txt"><div class="t" id="lbl-${k}">${SHOW[k][0]}</div><div class="d">${SHOW[k][1]}</div></div><button class="sw" type="button" role="switch" data-show="${k}" aria-labelledby="lbl-${k}"></button></div>`;
  const batRow = (k, i) => `<div class="row" draggable="true" data-bat="${k}"><span class="grip" aria-hidden="true">⋮⋮</span><div class="txt"><div class="t" id="lbl-${k}">${SHOW[k][0]}</div><div class="d" id="d-${k}">${SHOW[k][1]}<em data-noton="${k}"></em>${k === 'fable' ? '<span id="fabletail"></span>' : ''}</div></div>`
    + `<button class="mv" type="button" data-move="${k}" data-dir="-1" aria-label="Move ${SHOW[k][0]} up" ${i === 0 ? 'disabled' : ''}>▲</button><button class="mv" type="button" data-move="${k}" data-dir="1" aria-label="Move ${SHOW[k][0]} down" ${i === BATTERIES.length - 1 ? 'disabled' : ''}>▼</button>`
    + `<button class="sw" type="button" role="switch" data-show="${k}" aria-labelledby="lbl-${k}" aria-describedby="d-${k}"></button></div>`;
  $('show').innerHTML = fixedRow('model') + fixedRow('effort') + order.map(batRow).join('') + fixedRow('budget')
    + `<div class="row"><span class="grip none"></span><div class="txt"><div class="t">Cost</div><div class="d">Auto shows it only on an API key, where you really pay it. On Pro and Max it's only what the chat would have cost.</div></div>${segHtml('cost', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], 'Cost')}</div>`;
}
$('looks').innerHTML = LOOKS.map((l) =>
  `<button class="opt" type="button" data-look="${l.id}"><div class="thumb" aria-hidden="true" data-lookthumb="${l.id}"></div><strong>${l.name}</strong><span>${l.note}</span></button>`).join('');
$('layouts').innerHTML = Object.entries(LAYOUTS).map(([id, [name, note]]) =>
  `<button class="opt" type="button" data-layout="${id}"><div class="thumb" aria-hidden="true" data-thumb="${id}"></div><strong>${name}${id === 'bar' ? '<span class="badge">Default</span>' : ''}</strong><span>${note}</span></button>`).join('');
$('presets').innerHTML = Object.entries(PRESETS).map(([id, p]) =>
  `<button class="opt preset" type="button" data-preset="${id}"><div class="chips" aria-hidden="true" data-chips="${id}"></div><strong>${p.name}</strong><span>${p.note}</span></button>`).join('')
  + `<button class="opt preset" type="button" data-preset="custom"><div class="chips" aria-hidden="true" data-chips="custom"></div><strong>Your own</strong><span>Pick below</span></button>`;
$('custom').innerHTML = COLOR_NAMES.map((t, i) => `<label>${t}<input type="color" data-custom="${i}"><span class="ratio" data-ratio="${i}"></span></label>`).join('');
$('details').innerHTML = DETAILS.map(([k, t, d, opts]) => `<div class="drow"><div><div class="t">${t}</div><div class="d" data-hint="${k}">${d}</div></div>${segHtml(k, opts, t)}</div>`).join('');

// The preview alone. Hovering a card redraws only this, since nothing chosen has changed.
function preview() {
  // A chosen terminal colour wins, as in the real line (terminal.js): the preview's Dark/Light only stands in for Automatic.
  if (s.terminal !== 'auto') view.term = s.terminal;
  const cols = WIDTHS[view.width], p = peek(view.hover);
  const { text, dropped } = drawn(p?.id && LOOK[p.id] === p ? applySet(s, [`look=${p.id}`]).settings : { ...s, ...p?.set }, cols);
  $('out').innerHTML = ansiToHtml(text, NEUTRAL[view.term].fg);
  // The glyph bars read as noise to a screen reader, so name the preview by its words only.
  $('out').setAttribute('aria-label', text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+│\s+/g, ', ').replace(/[^\p{L}\p{N}%!:.,$\-+\/~ \n]/gu, ' ').split('\n').map((l) => l.replace(/\s+/g, ' ').replace(/ ,/g, ',').trim()).join('. '));
  $('win').classList.toggle('light', view.term === 'light');
  $('win').style.maxWidth = view.width === 'wide' ? '100%' : `calc(${cols}ch * 13.5 / 15 + 40px)`;
  $('cols').textContent = view.width === 'wide' ? '' : `${cols} columns`;
  const blank = !text.replace(/\x1b\[[0-9;]*m/g, '').trim();
  $('fitnote').innerHTML = (blank ? 'Nothing is switched on, so the status line would be <b>empty</b>. ' : '') + (p ? `Previewing <b>${p.name}</b>. ${view.hoverBy === 'focus' ? 'Press Enter' : 'Click it'} to use it. ` : '')
    + (dropped.length ? `Too narrow for everything, so it drops or shrinks <b>${dropped.join(', ')}</b>.` : view.width === 'wide' ? '' : 'Everything fits at this width.');
  edge();
}

// The line fades at the right edge while more of it is out of view.
function edge() {
  const o = $('out');
  o.classList.toggle('more', o.scrollWidth - o.clientWidth - o.scrollLeft > 1);
}
$('out').addEventListener('scroll', edge, { passive: true });
addEventListener('resize', edge);
$('win').addEventListener('transitionend', edge);

function update() {
  preview();

  // Layout cards show just the batteries; look cards show the whole look, because what shows is part of it.
  const thumb = (el, over, whole) => {
    const m = { ...s, ...over }, full = whole && !phone.matches, t = full ? m : { ...m, cost: 'off', show: m.show.filter((id) => id !== 'model' && id !== 'effort') };
    el.innerHTML = `<div>${ansiToHtml(render(full ? sample() : { ...sample(), model: null }, t, terminal(999, t)).text, NEUTRAL[view.term].fg)}</div>`;
    el.classList.toggle('light', view.term === 'light');
  };
  document.querySelectorAll('[data-thumb]').forEach((el) => thumb(el, { layout: el.dataset.thumb }));
  document.querySelectorAll('[data-lookthumb]').forEach((el) => thumb(el, applySet(s, [`look=${el.dataset.lookthumb}`]).settings, true));
  document.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', Object.entries(LOOK[b.dataset.look].set).every(([k, v]) => JSON.stringify(s[k]) === JSON.stringify(v))));
  document.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.layout === s.layout));
  document.querySelectorAll('[data-show]').forEach((b) => {
    const k = b.dataset.show;
    b.setAttribute('aria-checked', s.show.includes(k)); b.setAttribute('aria-disabled', BATTERIES.includes(k) && !offered(k));
  });
  document.querySelectorAll('[data-noton]').forEach((el) => { const why = (NOT_ON[el.dataset.noton] || {})[view.plan]; el.textContent = why ? ` · ${why}` : ''; });
  // Pro may have Fable, which the preview only hides; API keys have no Fable limit, so there is nothing to turn on.
  const tail = $('fabletail');
  if (tail) tail.textContent = view.plan === 'payg' ? '' : ". Shows only after you run /juice set fable=on in Claude Code.";
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.preset === (typeof s.colors === 'string' ? s.colors : 'custom')));
  document.querySelectorAll('[data-chips]').forEach((el) => { const set = el.dataset.chips === 'custom' ? customs[view.term] : PRESETS[el.dataset.chips][view.term]; el.innerHTML = set.map((c) => `<i style="background:${c}"></i>`).join(''); });
  document.querySelectorAll('[data-key]').forEach((b) => b.setAttribute('aria-pressed', s[b.dataset.key] === b.dataset.v));
  // Only Status bar and Tightest first draw the style; say so in the others once one is picked, as /juice set does.
  $('details').querySelector('[data-hint=battery]').textContent = DETAILS.find(([k]) => k === 'battery')[2]
    + (STYLE_LAYOUTS.includes(s.layout) || s.battery === DEFAULTS.battery ? '' : `. ${LAYOUTS[s.layout][0]} keeps its own shapes: styles show in Status bar and Tightest first`);
  $('details').querySelector('[data-key=battery]').closest('.seg').classList.toggle('dim', !STYLE_LAYOUTS.includes(s.layout));
  document.querySelectorAll('[data-view]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', view[seg.dataset.view] === b.dataset.v)));
  $('model').value = view.model;
  // Custom colours: one set per terminal colour, each checked against that terminal's background.
  const set = customs[view.term];
  $('customfor').textContent = `Your own colours for the ${view.term} terminal`;
  document.querySelectorAll('[data-custom]').forEach((inp) => { inp.value = set[inp.dataset.custom]; });
  document.querySelectorAll('[data-ratio]').forEach((el) => {
    const r = contrast(set[el.dataset.ratio], NEUTRAL[view.term].bg);
    // The same bar juice holds its own colours to, and /juice set warns below.
    el.textContent = `${r < 3 ? 'Hard to read here' : r < 4.5 ? 'A little faint' : 'Easy to read'} (${r.toFixed(1)}:1)`;
    el.title = r.toFixed(1) + ':1';
    el.classList.toggle('bad', r < 3);
    el.classList.toggle('faint', r >= 3 && r < 4.5);
  });
  $('cmd').textContent = toCommand(s, { terminalChosen: !!view.terminalChosen, motionChosen: !!view.motionChosen });
  $('json').textContent = JSON.stringify(s, null, 2);
  save();
}
// The address and the saved copy follow the settings at most 5 times a second: dragging a colour picker sends dozens of
// changes a second, and Safari throws after 100 address changes in 10 seconds.
let saved = 0, pending = 0;
function write() {
  pending = 0; saved = performance.now();
  try { history.replaceState(null, '', '#c=' + encodeLink(s)); } catch {}
  try { localStorage.setItem(SAVED, JSON.stringify(s)); } catch {} // remembered for the next visit
}
function save() {
  if (pending) return; // the write already waiting takes the newest settings
  const wait = saved + 200 - performance.now();
  if (wait <= 0) write(); else pending = setTimeout(write, wait);
}
const flush = () => { if (pending) { clearTimeout(pending); write(); } };
addEventListener('pagehide', flush);
let toastTimer;
const toast = (t) => { $('toast').textContent = t; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 4000); };
let sayTimer;
const say = (t) => { $('say').textContent = ''; clearTimeout(sayTimer); sayTimer = setTimeout(() => { $('say').textContent = t; }, 60); }; // cleared first so a repeat is read again
// The button itself says Copied for a moment, where the eye already is. It keeps its width meanwhile, so a second
// tap lands on it again and not on the button that slid in beside it (Reset, next to Copy link).
const done = (b) => {
  b.style.minWidth ||= getComputedStyle(b).width; // the content width: on a desktop the border and padding come on top
  b.dataset.label ??= b.textContent; b.textContent = 'Copied'; b.dataset.done = '';
  clearTimeout(b.timer); b.timer = setTimeout(() => { b.textContent = b.dataset.label; delete b.dataset.done; b.style.minWidth = ''; }, 1600);
};
const copy = (t, ok, b) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { toast(ok); done(b); }, () => toast('Could not copy. Select the command and copy it by hand.'));
function move(k, dir) {
  const i = order.indexOf(k), j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  reorder(); buildShow(); update(); say(`${SHOW[k][0]} moved ${dir < 0 ? 'up' : 'down'}`);
  const btn = document.querySelector(`[data-move="${k}"][data-dir="${dir}"]`);
  (btn && !btn.disabled ? btn : document.querySelector(`[data-move="${k}"]:not([disabled])`))?.focus();
}
const customColors = () => ({ dark: obj(customs.dark), light: obj(customs.light) });
document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.look) {
    adopt(applySet(s, [`look=${t.dataset.look}`]).settings); buildShow(); view.hover = null;
    say(`${LOOK[t.dataset.look].name} chosen`); }
  else if (t.dataset.layout) { s = { ...s, layout: t.dataset.layout }; view.hover = null; say(`${LAYOUTS[t.dataset.layout][0]} chosen`); }
  else if (t.dataset.show) { if (t.getAttribute('aria-disabled') !== 'true') setShow(t.dataset.show, !s.show.includes(t.dataset.show)); }
  else if (t.dataset.move) return move(t.dataset.move, Number(t.dataset.dir));
  else if (t.dataset.preset) {
    say(`${t.querySelector('strong').textContent.trim()} chosen`);
    if (t.dataset.preset === 'custom') s = { ...s, colors: customColors() };
    else { customs = presetArrs(t.dataset.preset); s = { ...s, colors: t.dataset.preset }; }
  } else if (t.dataset.key) {
    s = { ...s, [t.dataset.key]: t.dataset.v }; say(`${t.textContent.trim()} chosen`);
    if (t.dataset.key === 'motion') view.motionChosen = true; // from now on the command says motion=, even Still
    if (t.dataset.key === 'terminal') {
      view.terminalChosen = true; // from now on the command says terminal=, even Automatic
      if (t.dataset.v !== 'auto') view.term = t.dataset.v; // preview what was just chosen
    }
  }
  else if (t.closest('[data-view]')) { view[t.closest('[data-view]').dataset.view] = t.dataset.v; say(`${t.textContent.trim()} chosen`); }
  else if (t.dataset.copy) return copy($(t.dataset.copy).textContent, 'Copied. Paste it into Claude Code and press Enter.', t);
  else if (t.id === 'link') { flush(); return copy(location.href, 'Link copied. Anyone who opens it gets these settings.', t); }
  else if (t.id === 'reset') { adopt(sanitize({}, { allowBadges: false }).settings); buildShow(); view.terminalChosen = view.motionChosen = false; view.term = 'dark'; view.hover = null; toast('Back to the default look.'); say('Back to the default look'); }
  else return;
  update();
});
$('model').addEventListener('change', (e) => { view.model = e.target.value; update(); });
document.addEventListener('input', (e) => {
  if (e.target.dataset.custom === undefined) return;
  customs[view.term][e.target.dataset.custom] = e.target.value;
  s = { ...s, colors: customColors() }; update();
});
// Hovering a look or layout card with a mouse, or reaching it with the keyboard, previews it without choosing it.
// A tap on a phone sends a fake hover first, so touch screens skip the preview and the tap simply chooses.
const mouse = matchMedia('(hover:hover)');
for (const box of [$('looks'), $('layouts')]) {
  const hover = (e, by) => {
    const b = e.target.closest('[data-look],[data-layout]');
    const key = b ? (b.dataset.look ? `look:${b.dataset.look}` : `layout:${b.dataset.layout}`) : null;
    if (key === view.hover) return;
    // While you hover from card to card the preview only grows, so the cards under the mouse never jump.
    if (!view.hover) $('out').style.minHeight = '';
    else $('out').style.minHeight = `${$('out').offsetHeight}px`;
    view.hover = key; view.hoverBy = by; preview();
  };
  const leave = () => { view.hover = null; $('out').style.minHeight = ''; preview(); };
  box.addEventListener('mouseover', (e) => { if (mouse.matches) hover(e, 'mouse'); });
  box.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) hover(e, 'focus'); });
  box.addEventListener('mouseleave', () => { if (view.hoverBy === 'mouse') leave(); });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget) && view.hoverBy === 'focus') leave(); });
}
// Drag the battery rows to reorder them (the ▲▼ buttons do the same from the keyboard).
let dragged = null;
$('show').addEventListener('dragstart', (e) => { const r = e.target.closest('[data-bat]'); if (!r) return; dragged = r.dataset.bat; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
$('show').addEventListener('dragover', (e) => {
  const r = e.target.closest('[data-bat]'); if (!r || !dragged) return; e.preventDefault();
  document.querySelectorAll('.row.over').forEach((x) => x.classList.remove('over', 'below'));
  // Dropped on a row, the battery takes that row's place: the line shows above it going up, below it going down.
  r.classList.add('over'); r.classList.toggle('below', order.indexOf(r.dataset.bat) > order.indexOf(dragged));
});
$('show').addEventListener('drop', (e) => {
  const r = e.target.closest('[data-bat]'); if (!r || !dragged) return; e.preventDefault();
  if (r.dataset.bat === dragged) return; // dropped where it was: nothing moves
  const to = order.indexOf(r.dataset.bat);
  order.splice(order.indexOf(dragged), 1); order.splice(to, 0, dragged);
  say(`${SHOW[dragged][0]} moved`);
  dragged = null; reorder(); buildShow(); update();
});
$('show').addEventListener('dragend', () => { dragged = null; document.querySelectorAll('.row.dragging,.row.over').forEach((x) => x.classList.remove('dragging', 'over', 'below')); });

// The cards' pictures show fewer things on a phone, so they redraw when the window crosses that width.
phone.addEventListener('change', update);

// The skip link moves focus itself: following its #opts would change the address, and a new address re-reads the
// settings from it, throwing away what the person just picked.
document.querySelector('.skip').addEventListener('click', (e) => { e.preventDefault(); $('opts').focus(); });
document.querySelector('.skip2').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.c-apply .cmd.big .btn').focus(); });

// The sticky preview would hide whatever a link or the skip link scrolls to, so scrolling leaves room for it.
new ResizeObserver(() => {
  const st = document.querySelector('.stage');
  document.documentElement.style.scrollPaddingTop = getComputedStyle(st).position === 'sticky' ? `${st.offsetHeight + 8}px` : '0px';
}).observe(document.querySelector('.stage'));

// On load and whenever the hash changes: a valid shared link wins, then the settings saved last time, then the defaults.
const fromHash = () => {
  let next;
  $('linknote').hidden = true;
  try { next = parseLink(location.hash); } catch {
    // A link that was cut short or mangled in a chat app should say so, not quietly show something else.
    if (location.hash.startsWith('#c=')) { $('linknote').textContent = 'This settings link is damaged, so the page opened with your last settings instead.'; $('linknote').hidden = false; }
    try { next = sanitize(JSON.parse(localStorage.getItem(SAVED)), { allowBadges: false }).settings; } catch { next = sanitize({}, { allowBadges: false }).settings; }
  }
  if (next.terminal !== 'auto') view.term = next.terminal; // a link made for a light terminal previews as light
  adopt(next); buildShow(); update();
};
addEventListener('hashchange', fromHash);
fromHash();
