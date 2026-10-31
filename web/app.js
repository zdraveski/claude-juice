// The customizer page. All drawing of the status line is done by ../src/render; this file only builds controls and converts its ANSI to HTML.
import { render } from '../src/render/index.js';
import { LOOKS, sanitize, applySet, toCommand, encodeLink, parseLink } from '../src/schema.js';
import { PRESETS, NEUTRAL } from '../src/render/palette.js';
import { SAMPLES, withAccount } from '../src/samples.js';
import { contrast } from '../src/render/ansi.js';

const BATTERIES = ['memory', 'session', 'fable', 'week'];
const KEYS = ['plentyLeft', 'goingFast', 'almostEmpty', 'accent'];
const COLOR_NAMES = ['Plenty left', 'Going fast', 'Almost empty', 'Accent'];
const WIDTHS = { small: 80, medium: 120, wide: 400 };
const LAYOUTS = {
  bar: ['Status bar', 'Compact, number inside each battery'],
  segments: ['Classic segments', 'Five bars, like an old phone'],
  focus: ['Tightest first', 'The one to watch gets the spotlight'],
  panel: ['Panel', 'One row each, everything spelled out'],
};
const SHOW = {
  model: ['Model', 'Which Claude you are using'],
  effort: ['Effort', 'How hard Claude is thinking, from low to max'],
  memory: ['Memory', 'How much of the room in this chat is used'],
  session: ['Session', 'Your 5-hour limit'],
  week: ['Weekly', 'Your weekly limit'],
  fable: ['Fable weekly', 'The separate weekly limit for Fable'],
};
const NOT_ON = { session: { payg: 'API keys have no session limit' }, week: { payg: 'API keys have no weekly limit' }, fable: { payg: 'API keys have no Fable limit', pro: 'Only Max plans have this limit' } };
const DETAILS = [
  // The preview shows Automatic as rounded, so say plainly where it really is rounded.
  ['ends', 'Battery ends', 'Automatic is rounded in VS Code and plain in other terminals. Rounded needs a terminal that can draw them. Plain works everywhere', [['auto', 'Automatic'], ['round', 'Rounded'], ['plain', 'Plain']]],
  ['refills', 'Reset times', 'Always show them, or only when something needs attention', [['always', 'Always'], ['warnings', 'Only when needed']]],
  // Without this the copied command can't fix dark colours on a light terminal: the Dark/Light switch above only changes the preview.
  ['terminal', 'Terminal colour', 'Automatic follows Claude Code’s theme. Pick Light if the text is hard to read on a light background', [['auto', 'Automatic'], ['dark', 'Dark'], ['light', 'Light']]],
];

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
const drawn = (settings, columns) => render(sample(), settings, terminal(columns, settings));
const LOOK = Object.fromEntries(LOOKS.map((l) => [l.id, l]));
// What a hovered card previews: view.hover is 'look:<id>' or 'layout:<id>'.
const peek = (key) => { const [kind, id] = (key || '').split(':'); return kind === 'look' ? LOOK[id] : kind === 'layout' ? { name: LAYOUTS[id][0], set: { layout: id } } : null; };
const offered = (id) => id === 'memory' || (view.plan !== 'payg' && (id !== 'fable' || view.plan === 'max'));

// ---------- the page ----------
const $ = (id) => document.getElementById(id);
const segHtml = (key, opts, label) => `<div class="seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button type="button" data-key="${key}" data-v="${v}">${t}</button>`).join('')}</div>`;

function buildShow() {
  const fixedRow = (k) => `<div class="row"><span class="grip none"></span><div class="txt"><div class="t" id="lbl-${k}">${SHOW[k][0]}</div><div class="d">${SHOW[k][1]}</div></div><button class="sw" type="button" role="switch" data-show="${k}" aria-labelledby="lbl-${k}"></button></div>`;
  const batRow = (k, i) => `<div class="row" draggable="true" data-bat="${k}"><span class="grip" aria-hidden="true">⋮⋮</span><div class="txt"><div class="t" id="lbl-${k}">${SHOW[k][0]}</div><div class="d">${SHOW[k][1]}<em data-noton="${k}"></em></div></div>`
    + `<button class="mv" type="button" data-move="${k}" data-dir="-1" aria-label="Move ${SHOW[k][0]} up" ${i === 0 ? 'disabled' : ''}>▲</button><button class="mv" type="button" data-move="${k}" data-dir="1" aria-label="Move ${SHOW[k][0]} down" ${i === BATTERIES.length - 1 ? 'disabled' : ''}>▼</button>`
    + `<button class="sw" type="button" role="switch" data-show="${k}" aria-labelledby="lbl-${k}"></button></div>`;
  $('show').innerHTML = fixedRow('model') + fixedRow('effort') + order.map(batRow).join('')
    + `<div class="row"><span class="grip none"></span><div class="txt"><div class="t">Cost</div><div class="d">Auto shows it only on an API key, where you really pay it. On Pro and Max it's only what the chat would have cost.</div></div>${segHtml('cost', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], 'Cost')}</div>`;
}
$('looks').innerHTML = LOOKS.map((l) =>
  `<button class="opt" type="button" data-look="${l.id}"><div class="thumb" data-lookthumb="${l.id}"></div><strong>${l.name}</strong><span>${l.note}</span></button>`).join('');
$('layouts').innerHTML = Object.entries(LAYOUTS).map(([id, [name, note]]) =>
  `<button class="opt" type="button" data-layout="${id}"><div class="thumb" data-thumb="${id}"></div><strong>${name}${id === 'bar' ? '<span class="badge">Default</span>' : ''}</strong><span>${note}</span></button>`).join('');
$('presets').innerHTML = Object.entries(PRESETS).map(([id, p]) =>
  `<button class="opt preset" type="button" data-preset="${id}"><div class="chips" data-chips="${id}"></div><strong>${p.name}</strong><span>${p.note}</span></button>`).join('')
  + `<button class="opt preset" type="button" data-preset="custom"><div class="chips" data-chips="custom"></div><strong>Your own</strong><span>Pick below</span></button>`;
$('custom').innerHTML = COLOR_NAMES.map((t, i) => `<label>${t}<input type="color" data-custom="${i}"><span class="ratio" data-ratio="${i}"></span></label>`).join('');
$('details').innerHTML = DETAILS.map(([k, t, d, opts]) => `<div class="drow"><div><div class="t">${t}</div><div class="d">${d}</div></div>${segHtml(k, opts, t)}</div>`).join('');

function update() {
  const cols = WIDTHS[view.width], p = peek(view.hover);
  const { text, dropped } = drawn({ ...s, ...p?.set }, cols);
  $('out').innerHTML = ansiToHtml(text, NEUTRAL[view.term].fg);
  $('win').classList.toggle('light', view.term === 'light');
  $('win').style.maxWidth = view.width === 'wide' ? '100%' : `calc(${cols}ch * 13.5 / 15 + 40px)`;
  $('cols').textContent = view.width === 'wide' ? '' : `${cols} columns`;
  $('fitnote').innerHTML = (p ? `Previewing <b>${p.name}</b>. Click it to use it. ` : '')
    + (dropped.length ? `Too narrow for everything, so it drops or shrinks <b>${dropped.join(', ')}</b>.` : view.width === 'wide' ? '' : 'Everything fits at this width.');

  // Layout cards show just the batteries; look cards show the whole look, because what shows is part of it.
  const thumb = (el, over, whole) => {
    const t = whole ? { ...s, ...over } : { ...s, ...over, cost: 'off', show: s.show.filter((id) => id !== 'model' && id !== 'effort') };
    el.innerHTML = `<div>${ansiToHtml(render(whole ? sample() : { ...sample(), model: null }, t, terminal(999, t)).text, NEUTRAL[view.term].fg)}</div>`;
    el.classList.toggle('light', view.term === 'light');
  };
  document.querySelectorAll('[data-thumb]').forEach((el) => thumb(el, { layout: el.dataset.thumb }));
  document.querySelectorAll('[data-lookthumb]').forEach((el) => thumb(el, LOOK[el.dataset.lookthumb].set, true));
  document.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', Object.entries(LOOK[b.dataset.look].set).every(([k, v]) => JSON.stringify(s[k]) === JSON.stringify(v))));
  document.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.layout === s.layout));
  document.querySelectorAll('[data-show]').forEach((b) => {
    const k = b.dataset.show;
    b.setAttribute('aria-checked', s.show.includes(k)); b.disabled = BATTERIES.includes(k) && !offered(k);
  });
  document.querySelectorAll('[data-noton]').forEach((el) => { const why = (NOT_ON[el.dataset.noton] || {})[view.plan]; el.textContent = why ? ` · ${why}` : ''; });
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.preset === (typeof s.colors === 'string' ? s.colors : 'custom')));
  document.querySelectorAll('[data-chips]').forEach((el) => { const set = el.dataset.chips === 'custom' ? customs[view.term] : PRESETS[el.dataset.chips][view.term]; el.innerHTML = set.map((c) => `<i style="background:${c}"></i>`).join(''); });
  document.querySelectorAll('[data-key]').forEach((b) => b.setAttribute('aria-pressed', s[b.dataset.key] === b.dataset.v));
  document.querySelectorAll('[data-view]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', view[seg.dataset.view] === b.dataset.v)));
  $('model').value = view.model;
  // Custom colours: one set per terminal colour, each checked against that terminal's background.
  const set = customs[view.term];
  $('customfor').textContent = `Your own colours for the ${view.term} terminal`;
  document.querySelectorAll('[data-custom]').forEach((inp) => { inp.value = set[inp.dataset.custom]; });
  document.querySelectorAll('[data-ratio]').forEach((el) => {
    const r = contrast(set[el.dataset.ratio], NEUTRAL[view.term].bg);
    el.textContent = r < 3 ? `Hard to read here (${r.toFixed(1)}:1)` : `Easy to read (${r.toFixed(1)}:1)`;
    el.classList.toggle('bad', r < 3);
  });
  $('install1').textContent = '/plugin marketplace add zdraveski/claude-juice';
  $('install2').textContent = '/plugin install juice@juice';
  $('install3').textContent = '/juice setup';
  $('cmd').textContent = toCommand(s);
  $('json').textContent = JSON.stringify(s, null, 2);
  history.replaceState(null, '', '#c=' + encodeLink(s));
  try { localStorage.setItem(SAVED, JSON.stringify(s)); } catch {} // remembered for the next visit
}
const toast = (t) => { $('toast').textContent = t; };
const copy = (t, ok) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(ok), () => toast('Couldn’t copy automatically. Select the text and copy it.'));
function move(k, dir) {
  const i = order.indexOf(k), j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  reorder(); buildShow(); update();
  const btn = document.querySelector(`[data-move="${k}"][data-dir="${dir}"]`);
  (btn && !btn.disabled ? btn : document.querySelector(`[data-move="${k}"]:not([disabled])`))?.focus();
}
const customColors = () => ({ dark: obj(customs.dark), light: obj(customs.light) });
document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.look) { adopt(applySet(s, [`look=${t.dataset.look}`]).settings); buildShow(); view.hover = null; }
  else if (t.dataset.layout) { s = { ...s, layout: t.dataset.layout }; view.hover = null; }
  else if (t.dataset.show) setShow(t.dataset.show, !s.show.includes(t.dataset.show));
  else if (t.dataset.move) return move(t.dataset.move, Number(t.dataset.dir));
  else if (t.dataset.preset) {
    if (t.dataset.preset === 'custom') s = { ...s, colors: customColors() };
    else { customs = presetArrs(t.dataset.preset); s = { ...s, colors: t.dataset.preset }; }
  } else if (t.dataset.key) {
    s = { ...s, [t.dataset.key]: t.dataset.v };
    if (t.dataset.key === 'terminal' && t.dataset.v !== 'auto') view.term = t.dataset.v; // preview what was just chosen
  }
  else if (t.closest('[data-view]')) view[t.closest('[data-view]').dataset.view] = t.dataset.v;
  else if (t.dataset.copy) return copy($(t.dataset.copy).textContent, 'Copied. Paste it into Claude Code.');
  else if (t.id === 'link') return copy(location.href, 'Link copied. Anyone who opens it gets these settings.');
  else if (t.id === 'reset') { adopt(sanitize({}, { allowBadges: false }).settings); buildShow(); toast('Back to the default.'); }
  else return;
  update();
});
$('model').addEventListener('change', (e) => { view.model = e.target.value; update(); });
document.addEventListener('input', (e) => {
  if (e.target.dataset.custom === undefined) return;
  customs[view.term][e.target.dataset.custom] = e.target.value;
  s = { ...s, colors: customColors() }; update();
});
// Hovering or focusing a look or layout card previews it without choosing it.
for (const box of [$('looks'), $('layouts')]) {
  const hover = (e) => {
    const b = e.target.closest('[data-look],[data-layout]');
    const key = b ? (b.dataset.look ? `look:${b.dataset.look}` : `layout:${b.dataset.layout}`) : null;
    if (key !== view.hover) { view.hover = key; update(); }
  };
  box.addEventListener('mouseover', hover); box.addEventListener('focusin', hover);
  box.addEventListener('mouseleave', () => { view.hover = null; update(); });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) { view.hover = null; update(); } });
}
// Drag the battery rows to reorder them (the ▲▼ buttons do the same from the keyboard).
let dragged = null;
$('show').addEventListener('dragstart', (e) => { const r = e.target.closest('[data-bat]'); if (!r) return; dragged = r.dataset.bat; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
$('show').addEventListener('dragover', (e) => { const r = e.target.closest('[data-bat]'); if (!r || !dragged) return; e.preventDefault(); document.querySelectorAll('.row.over').forEach((x) => x.classList.remove('over')); r.classList.add('over'); });
$('show').addEventListener('drop', (e) => {
  const r = e.target.closest('[data-bat]'); if (!r || !dragged) return; e.preventDefault();
  order = order.filter((k) => k !== dragged); order.splice(order.indexOf(r.dataset.bat), 0, dragged);
  dragged = null; reorder(); buildShow(); update();
});
$('show').addEventListener('dragend', () => { dragged = null; document.querySelectorAll('.row.dragging,.row.over').forEach((x) => x.classList.remove('dragging', 'over')); });

// On load and whenever the hash changes: a valid shared link wins, then the settings saved last time, then the defaults.
const fromHash = () => {
  let next;
  try { next = parseLink(location.hash); } catch {
    try { next = sanitize(JSON.parse(localStorage.getItem(SAVED)), { allowBadges: false }).settings; } catch { next = sanitize({}, { allowBadges: false }).settings; }
  }
  if (next.terminal !== 'auto') view.term = next.terminal; // a link made for a light terminal previews as light
  adopt(next); buildShow(); update();
};
addEventListener('hashchange', fromHash);
fromHash();
