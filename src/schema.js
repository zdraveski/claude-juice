// The one definition of a valid setting. Files, /juice set and share links all pass through here.
import { PRESETS, NEUTRAL } from './render/palette.js';
import { contrast } from './render/ansi.js';
export const LAYOUT_IDS = ['bar', 'segments', 'focus', 'panel', 'pills', 'tank'];
// The layouts that draw the battery style; the others keep their own shapes.
export const STYLE_LAYOUTS = ['bar', 'focus'];
// What each choice is called, on the customizer's buttons and in juice's own messages (one name per id in CHOICES).
export const NAMES = {
  layout: { bar: 'Status bar', segments: 'Classic segments', focus: 'Tightest first', panel: 'Panel', pills: 'Capsules', tank: 'Fuel tank' },
  order: { yours: 'As above', urgent: 'Needs you first', fullest: 'Fullest first' },
  cost: { auto: 'Auto', on: 'On', off: 'Off' },
  ends: { auto: 'Automatic', round: 'Rounded', plain: 'Plain' },
  battery: { glossy: 'Glossy', classic: 'Classic', outline: 'Outline', hot: 'Hot tip', liquid: 'Liquid edge', pace: 'Pace glow',
    pie: 'Pie', sand: 'Sand', slider: 'Slider', race: 'Pace race', lives: 'Lives', dots: 'Dots', chevrons: 'Chevrons', ruler: 'Ruler' },
  refills: { always: 'Always', warnings: 'Only when needed' },
  motion: { off: 'Still', on: 'Animated' },
  terminal: { auto: 'Automatic', dark: 'Dark', light: 'Light' },
};
// yours: the order of show; urgent: the one that needs you most first; fullest: the most used first.
export const ORDER_IDS = ['yours', 'urgent', 'fullest'];
export const PRESET_IDS = Object.keys(PRESETS);
// How the bar and focus batteries are drawn; classic is the flat look juice started with.
// The forms draw a shape instead of a battery (see FORMS in render/pieces.js).
export const FORM_IDS = ['pie', 'sand', 'slider', 'race', 'lives', 'dots', 'chevrons', 'ruler'];
export const BATTERY_IDS = ['glossy', 'classic', 'outline', 'hot', 'liquid', 'pace', ...FORM_IDS];
export const SHOW_IDS = Object.freeze(['model', 'effort', 'memory', 'session', 'fable', 'week', 'budget']);
// Said by set, setup and the doctor alike, with the one fix the /juice skill knows.
export const NOTHING_SHOWN = 'Your juice settings choose nothing to show, so the line stays empty. Type /juice show all the batteries to bring them back.';
export const CUSTOMIZER_URL = 'https://zdraveski.github.io/claude-juice/web/';

export const DEFAULTS = Object.freeze({
  layout: 'bar', show: SHOW_IDS, order: 'yours', cost: 'auto', colors: 'claude',
  ends: 'auto', battery: 'glossy', terminal: 'auto', truecolor: 'auto', refills: 'always', fable: 'auto', badges: [],
  // Off: the line stands at its true fill and refreshes once a minute. On: it climbs, refreshing every second.
  motion: 'off',
});

// A look sets these seven in one go; terminal, fable and badges stay the person's own, and so does battery, except that Sand sets it and any other look then puts sand back to glossy (see applySet).
const LOOK_BASE = { layout: 'bar', show: SHOW_IDS, order: 'yours', colors: 'claude', cost: 'auto', refills: 'always', ends: 'auto' };
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
  look('colorblind', 'Colour-blind friendly', 'Blue, amber and red that every kind of colour blindness tells apart', { colors: 'safe' }),
  look('anywhere', 'Works everywhere', 'For older terminals that show boxes instead of rounded ends', { layout: 'segments', ends: 'plain' }),
  look('costwatch', 'Cost watcher', 'Shows what this chat would have cost', { show: ['model', 'memory', 'session', 'week', 'budget'], colors: 'ocean', cost: 'on' }),
  look('fablefirst', 'Fable first', 'The Fable battery leads and lights up while you use Fable', { show: ['model', 'effort', 'fable', 'memory', 'session', 'week', 'budget'], colors: 'candy' }),
  look('capsule', 'Capsule', 'Each battery a rounded capsule that fills with colour when it needs you', { layout: 'pills', colors: 'candy' }),
  look('roadtrip', 'Road trip', 'A fuel gauge: shows what is left, not what is used', { layout: 'tank', colors: 'forest' }),
  look('sand', 'Sand', 'Batteries that fill like an hourglass, in bold colours', { colors: 'bold', battery: 'sand' }),
]);

export const COLOR_KEYS = ['plentyLeft', 'goingFast', 'almostEmpty', 'accent'];
const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const oneOf = (ids) => Object.assign((v) => (ids.includes(v) ? v : undefined), { ids });

const palette = (p) => (isObj(p) && COLOR_KEYS.every((k) => typeof p[k] === 'string' && HEX.test(p[k]))
  ? Object.fromEntries(COLOR_KEYS.map((k) => [k, p[k]])) : undefined);

// Each checker returns the clean value, or undefined when the input is not acceptable.
const CHECK = {
  layout: oneOf(LAYOUT_IDS),
  order: oneOf(ORDER_IDS),
  cost: oneOf(['auto', 'on', 'off']),
  ends: oneOf(['auto', 'round', 'plain']),
  battery: oneOf(BATTERY_IDS),
  terminal: oneOf(['auto', 'dark', 'light']),
  truecolor: oneOf(['auto', 'on', 'off']),
  refills: oneOf(['always', 'warnings']),
  fable: oneOf(['auto', 'on', 'off']),
  motion: oneOf(['off', 'on']),
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
// The values each one-of setting takes, in the order the customizer offers them.
export const CHOICES = Object.fromEntries(Object.entries(CHECK).filter(([, c]) => c.ids).map(([k, c]) => [k, c.ids]));

// A warning reaches Claude's context: a value from a file can't carry a sentence in, so it is one short line.
const short = (s) => { const t = String(s).replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, ' ').trim(); return t.length > 30 ? `${t.slice(0, 30)}...` : t; };
const show = (v) => (typeof v === 'string' ? `'${short(v)}'` : isObj(v) ? 'your own colours' : short(JSON.stringify(v))); // only colours is an object
// The right values, from the same table that checks them (show has its own, longer warning).
const valid = (key) => key === 'colors' ? `Use one of: ${PRESET_IDS.join(', ')}. Or your own: dark:a,b,c,d/light:a,b,c,d, each a 6-digit hex colour like #22c55e (${COLOR_KEYS.join(', ')} in that order).`
  : CHECK[key].ids ? `Use one of: ${CHECK[key].ids.join(', ')}.` : '';
// A misspelt battery name is dropped, but never silently: "sesion" would otherwise just make Session vanish.
const unknownShow = (v) => (Array.isArray(v) ? v.filter((id) => !SHOW_IDS.includes(id)) : []);
// A value from a newer juice looks invalid to an older one.
const NEWER = " If it's new, update juice: type /plugin, update juice, restart Claude Code.";
const showWarning = (bad, then = 'so it was left out') => `show: ${bad.map(show).join(', ')} isn't a battery name (they are ${SHOW_IDS.join(', ')}; Weekly is "week"), ${then}`;

// The name of an extra environment variable a badge may see (badges.js).
export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/, MAX_ENV = 20;

export function sanitize(x, { allowBadges }) {
  const src = isObj(x) ? x : {};
  const settings = { ...DEFAULTS, show: [...SHOW_IDS], badges: [] };
  const warnings = [];
  for (const k of Object.keys(CHECK)) {
    if (!(k in src)) continue;
    const v = CHECK[k](src[k]);
    // A mistyped fable was most likely a no: auto could read the login on a guess.
    if (v === undefined && k === 'fable') settings.fable = 'off';
    if (v === undefined) warnings.push(`${k}: ${show(src[k])} isn't valid, using ${show(settings[k])}${k === 'show' ? '' : `. ${valid(k)}`}`);
    else settings[k] = v;
    if (k === 'show' && v !== undefined && unknownShow(src.show).length) warnings.push(showWarning(unknownShow(src.show)));
  }
  if (allowBadges && Array.isArray(src.badges)) {
    // sig: this computer's approval of the command (badges.js), so a copied juice.json can't run anything.
    settings.badges = src.badges
      .filter((b) => isObj(b) && typeof b.command === 'string' && b.command.length >= 1 && b.command.length <= 500)
      .map((b) => {
        const env = Array.isArray(b.env) ? [...new Set(b.env.filter((n) => typeof n === 'string' && ENV_NAME.test(n)))].slice(0, MAX_ENV) : [];
        return { command: b.command, ...(typeof b.sig === 'string' && /^[0-9a-f]{64}$/.test(b.sig) ? { sig: b.sig } : {}), ...(env.length ? { env } : {}) };
      });
  }
  return { settings, warnings };
}

const parseColors = (text) => {
  if (PRESET_IDS.includes(text)) return text;
  const o = {};
  for (const part of text.split('/')) {
    const m = /^\s*(dark|light)\s*:(.*)$/i.exec(part);
    if (!m) return undefined;
    o[m[1].toLowerCase()] = Object.fromEntries(m[2].split(',').map((c, i) => [COLOR_KEYS[i], c.trim()]));
  }
  return o;
};

const PARSE = { show: (t) => t.split(',').filter(Boolean), colors: parseColors };

export function applySet(settings, pairs) {
  const next = { ...settings };
  const warnings = [];
  const chosen = []; // every setting given a valid value, changed or not (a file may hold another value for it)
  const put = (key, v) => {
    if (!chosen.includes(key)) chosen.push(key);
    next[key] = Array.isArray(v) ? [...v] : v;
  };
  for (const pair of pairs) {
    const i = pair.indexOf('=');
    if (i < 1) { warnings.push(`${pair}: not a setting`); continue; }
    // Every name juice knows is lower case, so Layout=Tank is layout=tank; your own colours keep their hex as typed.
    // Warnings quote it as typed.
    const key = pair.slice(0, i).toLowerCase();
    const typed = pair.slice(i + 1), text = key === 'colors' && typed.includes(':') ? typed : typed.toLowerCase();
    if (key === 'badges') throw new Error('Badges can only be added with /juice badges add');
    if (key === 'look') {
      const l = LOOKS.find((x) => x.id === text);
      if (l) {
        Object.entries(l.set).forEach(([k, v]) => put(k, v));
        // A look without a battery undoes any battery a look can set (sand), even one picked by hand; every other battery style stays.
        if (!('battery' in l.set) && LOOKS.some((x) => x.set.battery === next.battery)) put('battery', DEFAULTS.battery);
      }
      else warnings.push(`look: ${show(typed)} isn't a look. Use one of: ${LOOKS.map((x) => x.id).join(', ')}.`);
      continue;
    }
    if (!Object.hasOwn(CHECK, key)) { warnings.push(`${pair}: not a setting`); continue; }
    const parsed = (Object.hasOwn(PARSE, key) ? PARSE[key] : (t) => t)(text);
    const v = CHECK[key](parsed);
    if (v === undefined) {
      // Plain words, not JSON: "sesion,weekly" gets the list of right names (Weekly is "week").
      warnings.push(key === 'show' ? showWarning(unknownShow(parsed), 'so nothing changed') : `${key}: ${show(typed)} isn't valid, keeping ${show(next[key])}. ${valid(key)}${key === 'colors' && text.includes(':') ? '' : NEWER}`);
      continue;
    }
    if (key === 'show' && unknownShow(parsed).length) warnings.push(showWarning(unknownShow(parsed)));
    if (key === 'colors' && isObj(v)) warnings.push(...faint(v));
    put(key, v);
  }
  // Compared at the end, so a key set twice back to where it was has not changed.
  const changed = chosen.filter((k) => JSON.stringify(settings[k]) !== JSON.stringify(next[k]));
  // Only Status bar and Tightest first draw the battery style; in the others a style picked shows nothing.
  // Warn only when this command hides a style that showed or is new: not for the default, not for one already hidden.
  // Changed, not chosen: the customizer's command always carries battery=, picked or not.
  const draws = (s) => STYLE_LAYOUTS.includes(s.layout);
  if (next.battery !== DEFAULTS.battery && !draws(next) && (changed.includes('battery') || draws(settings))) {
    const where = `the ${NAMES.layout[next.layout] ?? 'current'} layout keeps its own shapes; styles show in Status bar and Tightest first (layout=bar or layout=focus)`;
    warnings.push(changed.includes('battery') ? `battery: saved, but ${where}` : `battery: your '${next.battery}' style won't show, as ${where}`);
  }
  return { settings: next, warnings, changed, chosen };
}

// Your own colours are saved as typed, but a colour that fades into the background is said out loud: juice's own sets
// all read at 4.5:1 or more, the usual bar for small text.
const COLOR_WORDS = { plentyLeft: 'plenty left', goingFast: 'going fast', almostEmpty: 'almost empty', accent: 'accent' };
const faint = (c) => ['dark', 'light'].flatMap((t) => COLOR_KEYS.map((k) => [k, c[t][k], contrast(c[t][k], NEUTRAL[t].bg)])
  .filter(([, , r]) => r < 4.5)
  .map(([k, hex, r]) => `colors: your ${t} '${COLOR_WORDS[k]}' colour ${hex} is ${r < 3 ? 'hard to read' : 'a little faint'} on a ${t} terminal (${r.toFixed(1)}:1; 4.5:1 or more reads well). It's saved anyway.`));

const colorWord = (c) => (typeof c === 'string' ? c
  : ['dark', 'light'].map((t) => `${t}:${COLOR_KEYS.map((k) => c[t][k]).join(',')}`).join('/'));

// Everything the customizer has a control for. Not fable: switching it on reads the person's login (from the
// Keychain on a Mac), which only they should decide, with /juice set, never a pasted command or a shared link.
const COMMAND_KEYS = ['layout', 'show', 'order', 'cost', 'colors', 'ends', 'battery', 'terminal', 'refills', 'motion'];

// terminal=auto and motion=off go in only when the person chose them on the page: the public page starts there,
// and pasting a look from it must not undo the "/juice set terminal=light" or "motion=on" they chose earlier.
const UNLESS_CHOSEN = { terminal: 'auto', motion: 'off' };
export function toCommand(s, { terminalChosen = false, motionChosen = false } = {}) {
  const v = { ...s, show: s.show.join(','), colors: colorWord(s.colors) };
  const chosen = { terminal: terminalChosen, motion: motionChosen };
  return '/juice set ' + COMMAND_KEYS.filter((k) => v[k] !== UNLESS_CHOSEN[k] || chosen[k]).map((k) => `${k}=${v[k]}`).join(' ');
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
