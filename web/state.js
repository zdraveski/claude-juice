// The customizer's state without the page: the settings chosen, the battery order (hidden ones too, so one switched
// back on returns to its place), the colour-picker values per terminal, and whether the command must name terminal=
// and motion= even at their defaults. Each change returns a new state; every setting goes through schema's applySet,
// so the page follows the same rules as /juice set. app.js draws it.
import { SHOW_IDS, COLOR_KEYS as KEYS, sanitize, applySet, toPair } from '../plugin/src/schema.js';
import { PRESETS } from '../plugin/src/render/palette.js';

export const FIXED = ['model', 'effort', 'budget'];
export const BATTERIES = SHOW_IDS.filter((id) => !FIXED.includes(id));

const presetColors = (id) => ({ dark: PRESETS[id].dark.slice(), light: PRESETS[id].light.slice() });
const asColors = (customs) => Object.fromEntries(['dark', 'light'].map((t) => [t, Object.fromEntries(KEYS.map((k, i) => [k, customs[t][i]]))]));
const put = (st, key, value) => ({ ...st, s: applySet(st.s, [toPair(key, value)]).settings });

export function fromSettings(s, { terminalChosen = false, motionChosen = false } = {}) {
  const shown = s.show.filter((id) => BATTERIES.includes(id));
  return {
    s, terminalChosen, motionChosen,
    order: [...shown, ...BATTERIES.filter((id) => !shown.includes(id))],
    customs: typeof s.colors === 'string' ? presetColors(s.colors) : Object.fromEntries(['dark', 'light'].map((t) => [t, KEYS.map((k) => s.colors[t][k])])),
  };
}
export const reset = () => fromSettings(sanitize({}, { allowBadges: false }).settings);

// A look sets several things at once, and the order and colour pickers follow it; what was chosen stays chosen.
export const chooseLook = (st, id) => fromSettings(applySet(st.s, [`look=${id}`]).settings, st);

// One of the page's single choices (layout, cost, ends, battery, terminal, motion, order, refills).
export function choose(st, key, value) {
  const next = put(st, key, value);
  if (key === 'motion') next.motionChosen = true; // from now on the command says motion=, even Still
  if (key === 'terminal') next.terminalChosen = true; // and terminal=, even Automatic
  return next;
}

// show in the page's order: model and effort, the batteries as ordered, then budget.
const showOnly = (st, want) => put(st, 'show', [FIXED[0], FIXED[1], ...st.order, FIXED[2]].filter((x) => want.includes(x)));
export const toggleBattery = (st, id) => showOnly(st, st.s.show.includes(id) ? st.s.show.filter((x) => x !== id) : [...st.s.show, id]);

const reordered = (st, order) => showOnly({ ...st, order }, st.s.show);
// One step up (-1) or down (1); past either end nothing moves.
export function moveBattery(st, id, dir) {
  const i = st.order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= st.order.length) return st;
  const order = [...st.order];
  [order[i], order[j]] = [order[j], order[i]];
  return reordered(st, order);
}
// Dropped on another battery's row, it takes that row's place.
export function dropBattery(st, id, onto) {
  if (id === onto || !st.order.includes(id) || !st.order.includes(onto)) return st;
  const order = st.order.filter((x) => x !== id);
  order.splice(st.order.indexOf(onto), 0, id);
  return reordered(st, order);
}

// A colour set by name, or 'custom' for the pickers' own colours.
export function choosePreset(st, id) {
  if (id === 'custom') return put(st, 'colors', asColors(st.customs));
  return put({ ...st, customs: presetColors(id) }, 'colors', id);
}
// One colour picker (i: plentyLeft, goingFast, almostEmpty, accent) for one terminal's background.
export function setCustom(st, term, i, hex) {
  const customs = { ...st.customs, [term]: st.customs[term].map((c, n) => (n === i ? hex : c)) };
  return put({ ...st, customs }, 'colors', asColors(customs));
}
