// The one definition of a valid setting. Files, /juice set and share links all pass through here.
import { PRESETS } from './render/palette.js';
export const LAYOUT_IDS = ['bar', 'segments', 'focus', 'panel'];
export const PRESET_IDS = Object.keys(PRESETS);
export const SHOW_IDS = Object.freeze(['model', 'effort', 'memory', 'session', 'fable', 'week', 'budget']);
// Said by set, setup and the doctor alike, with the one fix the /juice skill knows.
export const NOTHING_SHOWN = 'Your juice settings choose nothing to show, so the line stays empty. Type /juice show all the batteries to bring them back.';
export const CUSTOMIZER_URL = 'https://zdraveski.github.io/claude-juice/web/';
// Lives here, not in fable.js, so the status line can check it without loading child_process.
export const fableEnabled = (setting, platform) => setting === 'on' || (setting === 'auto' && platform !== 'darwin');

export const DEFAULTS = Object.freeze({
  layout: 'bar', show: SHOW_IDS, cost: 'auto', colors: 'claude',
  ends: 'auto', terminal: 'auto', refills: 'always', fable: 'auto', badges: [],
});

// A look sets these six in one go; terminal, fable and badges stay the person's own.
const LOOK_BASE = { layout: 'bar', show: SHOW_IDS, colors: 'claude', cost: 'auto', refills: 'always', ends: 'auto' };
const look = (id, name, note, o = {}) => Object.freeze({ id, name, note, set: Object.freeze({ ...LOOK_BASE, ...o }) });
export const LOOKS = Object.freeze([
  look('juice', 'Juice', 'The standard look, what you get out of the box'),
  look('basics', 'Just the basics', 'Two batteries and nothing else', { show: ['memory', 'session', 'budget'], colors: 'calm', refills: 'warnings' }),
  look('spotlight', 'Spotlight', 'The battery that needs you most is big, the rest stay small', { layout: 'focus' }),
  look('everything', 'Everything', 'One row per battery, every detail spelled out', { layout: 'panel', colors: 'bold', cost: 'on' }),
  look('retro', 'Retro phone', 'Signal bars like an old phone, cool colours', { layout: 'segments', colors: 'frost' }),
  look('quiet', 'Quiet', 'Grey and silent until something needs you', { show: ['model', 'memory', 'session', 'week', 'budget'], colors: 'calm', refills: 'warnings' }),
  look('nightowl', 'Night owl', 'Neon bars for dark terminals', { layout: 'segments', colors: 'vampire' }),
  look('easy', 'Easy to see', 'Big, bright and high contrast', { layout: 'focus', colors: 'bold', ends: 'plain' }),
  look('colorblind', 'Colour-blind friendly', 'Blue, yellow and orange instead of green and red', { colors: 'safe' }),
  look('anywhere', 'Works everywhere', 'For older terminals that show boxes instead of rounded ends', { layout: 'segments', ends: 'plain' }),
  look('costwatch', 'Cost watcher', 'Shows what this chat would have cost', { show: ['model', 'memory', 'session', 'week', 'budget'], colors: 'ocean', cost: 'on' }),
  look('fablefirst', 'Fable first', 'The Fable battery leads and lights up while you use Fable', { show: ['model', 'effort', 'fable', 'memory', 'session', 'week', 'budget'], colors: 'candy' }),
]);

export const COLOR_KEYS = ['plentyLeft', 'goingFast', 'almostEmpty', 'accent'];
const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const oneOf = (ids) => (v) => (ids.includes(v) ? v : undefined);

const palette = (p) => (isObj(p) && COLOR_KEYS.every((k) => typeof p[k] === 'string' && HEX.test(p[k]))
  ? Object.fromEntries(COLOR_KEYS.map((k) => [k, p[k]])) : undefined);

// Each checker returns the clean value, or undefined when the input is not acceptable.
const CHECK = {
  layout: oneOf(LAYOUT_IDS),
  cost: oneOf(['auto', 'on', 'off']),
  ends: oneOf(['auto', 'round', 'plain']),
  terminal: oneOf(['auto', 'dark', 'light']),
  refills: oneOf(['always', 'warnings']),
  fable: oneOf(['auto', 'on', 'off']),
  show(v) {
    if (!Array.isArray(v)) return undefined;
    const ids = [...new Set(v.filter((id) => SHOW_IDS.includes(id)))];
    return v.length && !ids.length ? undefined : ids;
  },
  colors(v) {
    if (PRESET_IDS.includes(v)) return v;
    const dark = isObj(v) && palette(v.dark);
    const light = isObj(v) && palette(v.light);
    return dark && light ? { dark, light } : undefined;
  },
};

const show = (v) => (typeof v === 'string' ? `'${v}'` : JSON.stringify(v));
// A misspelt battery name is dropped, but never silently: "sesion" would otherwise just make Session vanish.
const unknownShow = (v) => (Array.isArray(v) ? v.filter((id) => !SHOW_IDS.includes(id)) : []);
const showWarning = (bad, then = 'so it was left out') => `show: ${bad.map(show).join(', ')} isn't a battery name (they are ${SHOW_IDS.join(', ')}; Weekly is "week"), ${then}`;

export function sanitize(x, { allowBadges }) {
  const src = isObj(x) ? x : {};
  const settings = { ...DEFAULTS, show: [...SHOW_IDS], badges: [] };
  const warnings = [];
  for (const k of Object.keys(CHECK)) {
    if (!(k in src)) continue;
    const v = CHECK[k](src[k]);
    if (v === undefined) warnings.push(`${k}: ${show(src[k])} isn't valid, using ${show(DEFAULTS[k])}`);
    else settings[k] = v;
    if (k === 'show' && v !== undefined && unknownShow(src.show).length) warnings.push(showWarning(unknownShow(src.show)));
  }
  if (allowBadges && Array.isArray(src.badges)) {
    // sig: this computer's approval of the command (badges.js), so a copied juice.json can't run anything.
    settings.badges = src.badges
      .filter((b) => isObj(b) && typeof b.command === 'string' && b.command.length >= 1 && b.command.length <= 500)
      .map((b) => (typeof b.sig === 'string' && /^[0-9a-f]{64}$/.test(b.sig) ? { command: b.command, sig: b.sig } : { command: b.command }));
  }
  return { settings, warnings };
}

const parseColors = (text) => {
  if (PRESET_IDS.includes(text)) return text;
  const o = {};
  for (const part of text.split('/')) {
    const m = /^(dark|light):(.*)$/.exec(part);
    if (!m) return undefined;
    o[m[1]] = Object.fromEntries(m[2].split(',').map((c, i) => [COLOR_KEYS[i], c]));
  }
  return o;
};

const PARSE = { show: (t) => t.split(',').filter(Boolean), colors: parseColors };

export function applySet(settings, pairs) {
  const next = { ...settings };
  const warnings = [];
  const changed = [];
  const put = (key, v) => {
    if (JSON.stringify(v) !== JSON.stringify(next[key]) && !changed.includes(key)) changed.push(key);
    next[key] = Array.isArray(v) ? [...v] : v;
  };
  for (const pair of pairs) {
    const i = pair.indexOf('=');
    if (i < 1) { warnings.push(`${pair}: not a setting`); continue; }
    const key = pair.slice(0, i);
    const text = pair.slice(i + 1);
    if (key === 'badges') throw new Error('Badges can only be added with /juice badges add');
    if (key === 'look') {
      const l = LOOKS.find((x) => x.id === text);
      if (l) Object.entries(l.set).forEach(([k, v]) => put(k, v));
      else warnings.push(`look: '${text}' isn't a look`);
      continue;
    }
    if (!Object.hasOwn(CHECK, key)) { warnings.push(`${pair}: not a setting`); continue; }
    const parsed = (Object.hasOwn(PARSE, key) ? PARSE[key] : (t) => t)(text);
    const v = CHECK[key](parsed);
    if (v === undefined) {
      // Plain words, not JSON: "sesion,weekly" gets the list of right names (Weekly is "week").
      warnings.push(key === 'show' ? showWarning(unknownShow(parsed), 'so nothing changed') : `${key}: '${text}' isn't valid, keeping ${show(next[key])}`);
      continue;
    }
    if (key === 'show' && unknownShow(parsed).length) warnings.push(showWarning(unknownShow(parsed)));
    put(key, v);
  }
  return { settings: next, warnings, changed };
}

const colorWord = (c) => (typeof c === 'string' ? c
  : ['dark', 'light'].map((t) => `${t}:${COLOR_KEYS.map((k) => c[t][k]).join(',')}`).join('/'));

// Everything the customizer has a control for. Not fable: switching it on reads the person's login (from the
// Keychain on a Mac), which only they should decide, with /juice set, never a pasted command or a shared link.
const COMMAND_KEYS = ['layout', 'show', 'cost', 'colors', 'ends', 'terminal', 'refills'];

// terminal=auto goes in only when the person chose Automatic on the page: the public page starts at auto,
// and pasting a look from it must not undo the "/juice set terminal=light" they chose earlier.
export function toCommand(s, { terminalChosen = false } = {}) {
  const v = { ...s, show: s.show.join(','), colors: colorWord(s.colors) };
  return '/juice set ' + COMMAND_KEYS.filter((k) => k !== 'terminal' || v.terminal !== 'auto' || terminalChosen).map((k) => `${k}=${v[k]}`).join(' ');
}

// Badges run shell commands and fable reads the login, so neither travels in a link.
export function encodeLink(s) {
  const { badges, fable, ...rest } = s;
  const bytes = new TextEncoder().encode(JSON.stringify(rest));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Throws when the hash isn't a link juice made.
export function parseLink(hash) {
  const payload = String(hash).replace(/^#?c=/, '').replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(payload);
  const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  const parsed = JSON.parse(json);
  // A link whose data is a number, text or list is broken, not "all defaults": throwing keeps the saved settings.
  if (!isObj(parsed)) throw new Error('not a settings link');
  const { fable, ...rest } = parsed;
  return sanitize(rest, { allowBadges: false }).settings;
}
