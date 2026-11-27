// The customizer page. All drawing of the status line is done by ../plugin/src/render; this file only builds controls and converts its ANSI to HTML.
import { render } from '../plugin/src/render/index.js';
import { STYLE_LAYOUTS, STYLE_WHERE, LOOKS, NAMES, CHOICES, DEFAULTS, applySet, toCommand, encodeLink, hidesStyle, readability } from '../plugin/src/schema.js';
import { FIXED, BATTERIES, startFrom, reset, chooseLook, choose, toggleBattery, moveBattery, dropBattery, choosePreset, setCustom, termOf, terminalOf, sampleOf, offered, previewOf } from './state.js';
import { PRESETS, NEUTRAL } from '../plugin/src/render/palette.js';
import { ansiToHtml } from '../plugin/src/render/html.js';
import { LABELS } from '../plugin/src/render/words.js';

// Model and effort stay on top and budget at the bottom (FIXED); the batteries between them can be reordered.
const COLOR_NAMES = ['Plenty left', 'Going fast', 'Almost empty', 'Accent'];
// Each choice's buttons come from the settings rules (plugin/src/schema.js), so a new value shows up here by itself.
const opts = (key) => CHOICES[key].map((id) => [id, NAMES[key][id]]);
const LAYOUT_NOTES = {
  bar: 'Compact, the number with each battery',
  segments: 'Five bars, like an old phone',
  focus: 'The one to watch gets the spotlight',
  panel: 'One row each, everything spelled out',
  pills: 'Rounded capsules that fill with colour when they need you',
  tank: 'Shows what is left, like a fuel gauge',
  fuse: 'When each limit runs out, and how long the wait is',
};
// Battery names as the panel layout spells them, so the page and the line never disagree.
const SHOW = {
  model: ['Model', 'Which Claude you are using'],
  effort: ['Effort', 'How hard Claude is thinking, from low to max'],
  memory: [LABELS.memory[1], 'How much of the room in this chat is used'],
  session: [LABELS.session[1], 'Your 5-hour limit'],
  week: [LABELS.week[1], 'Your weekly limit'],
  fable: [LABELS.fable[1], 'The separate weekly limit for Fable'],
  budget: [LABELS.budget[1], "Your company's spending limit. Shows only if you have one, so the preview can't show it."],
};
const NOT_ON = { session: { payg: 'API keys have no session limit' }, week: { payg: 'API keys have no weekly limit' }, fable: { payg: 'API keys have no Fable limit', pro: 'The preview hides it on Pro' } };
const DETAILS = [
  ['order', 'Battery order', 'Keep the order above, or let the batteries move as things change'],
  // The preview shows Automatic as rounded, so say plainly where it really is rounded.
  ['ends', 'Battery ends', 'Rounded ends need a terminal that can draw them. Automatic picks Rounded in VS Code and Plain elsewhere.'],
  ['battery', 'Battery style', 'How the batteries are drawn, or a shape instead. Classic is the old flat look'],
  ['refills', 'Reset times', 'Always show them, or only when something needs attention'],
  ['motion', 'Motion', 'Still draws once. Animated redraws every second and uses about one sixth of a CPU core per open window. The preview stays still; the real line climbs.'],
  // Without this the copied command can't fix dark colours on a light terminal: the Dark/Light switch above only changes the preview.
  ['terminal', "Your terminal's theme", 'Automatic follows Claude Code’s theme. Pick Light if the text is hard to read on a light background'],
];

const phone = matchMedia('(max-width:700px)');
// Wide on a phone too: Small still ran past a phone's edge and dropped the battery pictures. The line scrolls sideways instead.
const view = { state: 'busy', term: 'dark', width: 'wide', plan: 'max', model: 'Opus 5.5', hover: null };
// The page's state (state.js); s, order and customs are read from it everywhere below, and changed only through apply.
let st, s, order, customs;
const apply = (next) => { st = next; ({ s, order, customs } = st); };
const SAVED = 'juice-settings';

// ---------- preview ----------
// The terminal colour the page shows: preview, chips, colour pickers and ratios (state.js termOf: a chosen one beats the Dark/Light switch).
const term = () => termOf(s, view);
const LOOK = Object.fromEntries(LOOKS.map((l) => [l.id, l]));

// ---------- the page ----------
const $ = (id) => document.getElementById(id);
const segHtml = (key, opts, label) => `<div class="seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button type="button" data-key="${key}" data-v="${v}">${t}</button>`).join('')}</div>`;

function buildShow() {
  const fixedRow = (k) => `<div class="row"><span class="grip none"></span><div class="txt"><div class="t" id="lbl-${k}">${SHOW[k][0]}</div><div class="d">${SHOW[k][1]}</div></div><button class="sw" type="button" role="switch" data-show="${k}" aria-labelledby="lbl-${k}"></button></div>`;
  const batRow = (k, i) => `<div class="row" draggable="true" data-bat="${k}"><span class="grip" aria-hidden="true">⋮⋮</span><div class="txt"><div class="t" id="lbl-${k}">${SHOW[k][0]}</div><div class="d" id="d-${k}">${SHOW[k][1]}<em data-noton="${k}"></em>${k === 'fable' ? '<span id="fabletail"></span>' : ''}</div></div>`
    + `<button class="mv" type="button" data-move="${k}" data-dir="-1" aria-label="Move ${SHOW[k][0]} up" ${i === 0 ? 'disabled' : ''}>▲</button><button class="mv" type="button" data-move="${k}" data-dir="1" aria-label="Move ${SHOW[k][0]} down" ${i === BATTERIES.length - 1 ? 'disabled' : ''}>▼</button>`
    + `<button class="sw" type="button" role="switch" data-show="${k}" aria-labelledby="lbl-${k}" aria-describedby="d-${k}"></button></div>`;
  $('show').innerHTML = fixedRow('model') + fixedRow('effort') + order.map(batRow).join('') + fixedRow('budget')
    + `<div class="row"><span class="grip none"></span><div class="txt"><div class="t">Cost</div><div class="d">Auto shows it only on an API key, where you really pay it. On Pro and Max it's only what the chat would have cost.</div></div>${segHtml('cost', opts('cost'), 'Cost')}</div>`;
}
$('looks').innerHTML = LOOKS.map((l) =>
  `<button class="opt" type="button" data-look="${l.id}"><div class="thumb" aria-hidden="true" data-lookthumb="${l.id}"></div><strong>${l.name}</strong><span>${l.note}</span></button>`).join('');
$('layouts').innerHTML = CHOICES.layout.map((id) =>
  `<button class="opt" type="button" data-layout="${id}"><div class="thumb" aria-hidden="true" data-thumb="${id}"></div><strong>${NAMES.layout[id]}${id === DEFAULTS.layout ? '<span class="badge">Default</span>' : ''}</strong><span>${LAYOUT_NOTES[id]}</span></button>`).join('');
$('presets').innerHTML = Object.entries(PRESETS).map(([id, p]) =>
  `<button class="opt preset" type="button" data-preset="${id}"><div class="chips" aria-hidden="true" data-chips="${id}"></div><strong>${p.name}</strong><span>${p.note}</span></button>`).join('')
  + `<button class="opt preset" type="button" data-preset="custom"><div class="chips" aria-hidden="true" data-chips="custom"></div><strong>Your own</strong><span>Pick below</span></button>`;
$('custom').innerHTML = COLOR_NAMES.map((t, i) => `<label>${t}<input type="color" data-custom="${i}"><span class="ratio" data-ratio="${i}"></span></label>`).join('');
$('details').innerHTML = DETAILS.map(([k, t, d]) => `<div class="drow"><div><div class="t">${t}</div><div class="d" data-hint="${k}">${d}</div></div>${segHtml(k, opts(k), t)}</div>`).join('');

// The Fuse layout says some things with a glyph alone; give a screen reader the words before the glyphs are dropped.
const FUSE_WORDS = [[/%»/g, '%!!'], [/%›/g, '%!'], [/►/g, ' runs out '], [/○(?=[\dA-Z])/g, ' refills '],
  [/ ([+-])(\d+)(?= |$)/gm, (_, sign, n) => ` ${n} points ${sign === '+' ? 'ahead of' : 'behind'} an even pace`]];

// The preview alone. Hovering a card redraws only this, since nothing chosen has changed.
function preview() {
  const fixed = s.terminal !== 'auto'; // so the Dark/Light switch says why it does nothing
  document.querySelectorAll('[data-view=term] button').forEach((b) => { b.disabled = fixed; b.setAttribute('aria-disabled', fixed); });
  $('termfixed').textContent = fixed ? "Fixed by Your terminal's theme below" : '';
  const { text, dropped, columns: cols, term: shown, previewing, blank } = previewOf(s, view);
  $('out').innerHTML = ansiToHtml(text, NEUTRAL[shown].fg);
  // The glyph bars read as noise to a screen reader, so name the preview by its words only.
  $('out').setAttribute('aria-label', FUSE_WORDS.reduce((t, [a, b]) => t.replace(a, b), text.replace(/\x1b\[[0-9;]*m/g, '')).replace(/\s+│\s+/g, ', ').replace(/[^\p{L}\p{N}%!:.,$\-+\/~ \n]/gu, ' ').split('\n').map((l) => l.replace(/\s+/g, ' ').replace(/ ,/g, ',').trim()).join('. '));
  $('win').classList.toggle('light', shown === 'light');
  $('win').style.maxWidth = view.width === 'wide' ? '100%' : `calc(${cols}ch * 13.5 / 15 + 40px)`;
  $('cols').textContent = view.width === 'wide' ? '' : `${cols} columns`;
  $('fitnote').innerHTML = (blank ? 'Nothing is switched on, so the status line would be <b>empty</b>. ' : '') + (previewing ? `Previewing <b>${previewing}</b>. ${view.hoverBy === 'focus' ? 'Press Enter' : 'Click it'} to use it. ` : '')
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
    el.innerHTML = `<div>${ansiToHtml(render(full ? sampleOf(view) : { ...sampleOf(view), model: null }, t, terminalOf(t, view, 999)).text, NEUTRAL[term()].fg)}</div>`;
    el.classList.toggle('light', term() === 'light');
  };
  document.querySelectorAll('[data-thumb]').forEach((el) => thumb(el, { layout: el.dataset.thumb }));
  document.querySelectorAll('[data-lookthumb]').forEach((el) => thumb(el, applySet(s, [`look=${el.dataset.lookthumb}`]).settings, true));
  document.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', Object.entries(LOOK[b.dataset.look].set).every(([k, v]) => JSON.stringify(s[k]) === JSON.stringify(v))));
  document.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.layout === s.layout));
  document.querySelectorAll('[data-show]').forEach((b) => {
    const k = b.dataset.show;
    b.setAttribute('aria-checked', s.show.includes(k)); b.setAttribute('aria-disabled', BATTERIES.includes(k) && !offered(view, k));
  });
  document.querySelectorAll('[data-noton]').forEach((el) => { const why = (NOT_ON[el.dataset.noton] || {})[view.plan]; el.textContent = why ? ` · ${why}` : ''; });
  // Pro may have Fable, which the preview only hides; API keys have no Fable limit, so there is nothing to turn on.
  const tail = $('fabletail');
  if (tail) tail.textContent = view.plan === 'payg' ? '' : ". Shows only after you run /juice set fable=on in Claude Code.";
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.preset === (typeof s.colors === 'string' ? s.colors : 'custom')));
  document.querySelectorAll('[data-chips]').forEach((el) => { const set = el.dataset.chips === 'custom' ? customs[term()] : PRESETS[el.dataset.chips][term()]; el.innerHTML = set.map((c) => `<i style="background:${c}"></i>`).join(''); });
  document.querySelectorAll('[data-key]').forEach((b) => b.setAttribute('aria-pressed', s[b.dataset.key] === b.dataset.v));
  // Only Status bar and Tightest first draw the style; say so in the others once one is picked, as /juice set does.
  $('details').querySelector('[data-hint=battery]').textContent = DETAILS.find(([k]) => k === 'battery')[2]
    + (hidesStyle(s) ? `. ${NAMES.layout[s.layout]} keeps its own shapes: ${STYLE_WHERE}` : '');
  $('details').querySelector('[data-key=battery]').closest('.seg').classList.toggle('dim', !STYLE_LAYOUTS.includes(s.layout));
  document.querySelectorAll('[data-view]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', (seg.dataset.view === 'term' ? term() : view[seg.dataset.view]) === b.dataset.v)));
  $('model').value = view.model;
  // Custom colours: one set per terminal colour, each checked against that terminal's background.
  const set = customs[term()];
  $('customfor').textContent = `Your own colours for the ${term()} terminal`;
  document.querySelectorAll('[data-custom]').forEach((inp) => { inp.value = set[inp.dataset.custom]; });
  document.querySelectorAll('[data-ratio]').forEach((el) => {
    // The same bar juice holds its own colours to, and /juice set warns below.
    const { ratio, level } = readability(set[el.dataset.ratio], term());
    el.textContent = `${{ hard: 'Hard to read here', faint: 'A little faint', ok: 'Easy to read' }[level]} (${ratio.toFixed(1)}:1)`;
    el.title = ratio.toFixed(1) + ':1';
    el.classList.toggle('bad', level === 'hard');
    el.classList.toggle('faint', level === 'faint');
  });
  $('cmd').textContent = toCommand(s, st);
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
const copy = (t, ok, b, fail = 'Could not copy. Select the command and copy it by hand.') => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { toast(ok); done(b); }, () => toast(fail));
function move(k, dir) {
  const next = moveBattery(st, k, dir);
  if (next === st) return;
  apply(next); buildShow(); update(); say(`${SHOW[k][0]} moved ${dir < 0 ? 'up' : 'down'}`);
  const btn = document.querySelector(`[data-move="${k}"][data-dir="${dir}"]`);
  (btn && !btn.disabled ? btn : document.querySelector(`[data-move="${k}"]:not([disabled])`))?.focus();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.look) {
    apply(chooseLook(st, t.dataset.look)); buildShow(); view.hover = null;
    say(`${LOOK[t.dataset.look].name} chosen`); }
  else if (t.dataset.layout) { apply(choose(st, 'layout', t.dataset.layout)); view.hover = null; say(`${NAMES.layout[t.dataset.layout]} chosen`); }
  else if (t.dataset.show) { if (t.getAttribute('aria-disabled') !== 'true') apply(toggleBattery(st, t.dataset.show)); }
  else if (t.dataset.move) return move(t.dataset.move, Number(t.dataset.dir));
  else if (t.dataset.preset) {
    say(`${t.querySelector('strong').textContent.trim()} chosen`);
    apply(choosePreset(st, t.dataset.preset));
  } else if (t.dataset.key) {
    apply(choose(st, t.dataset.key, t.dataset.v)); say(`${t.textContent.trim()} chosen`);
  }
  else if (t.closest('[data-view]')) { view[t.closest('[data-view]').dataset.view] = t.dataset.v; say(`${t.textContent.trim()} chosen`); }
  else if (t.dataset.copy) return copy($(t.dataset.copy).textContent, 'Copied. Paste it into Claude Code and press Enter.', t);
  else if (t.id === 'link') { flush(); return copy(location.href, 'Link copied. Anyone who opens it gets these settings.', t, 'Could not copy. Copy the address from the address bar.'); }
  else if (t.id === 'reset') { apply(reset()); buildShow(); view.term = 'dark'; view.hover = null; toast('Back to the default look.'); say('Back to the default look'); }
  else return;
  update();
});
$('model').addEventListener('change', (e) => { view.model = e.target.value; update(); });
document.addEventListener('input', (e) => {
  if (e.target.dataset.custom === undefined) return;
  apply(setCustom(st, term(), Number(e.target.dataset.custom), e.target.value)); update();
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
  apply(dropBattery(st, dragged, r.dataset.bat));
  say(`${SHOW[dragged][0]} moved`);
  dragged = null; buildShow(); update();
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

// On load and whenever the hash changes; state.js startFrom decides where the page starts.
const fromHash = () => {
  let savedText = null;
  try { savedText = localStorage.getItem(SAVED); } catch {}
  const { st: next, damaged } = startFrom(location.hash, savedText, st);
  // A link that was cut short or mangled in a chat app should say so, not quietly show something else.
  $('linknote').textContent = damaged ? 'This settings link is damaged, so the page opened with your last settings instead.' : '';
  $('linknote').hidden = !damaged;
  apply(next); buildShow(); update();
};
addEventListener('hashchange', fromHash);
fromHash();
