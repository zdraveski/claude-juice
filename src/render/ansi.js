// Colour escapes, width counting, cutting and 256-colour mapping. No node: imports.
const E = '\x1b[';
const SGR = /\x1b\[[0-9;]*m/g;
const WIDE = /\p{Extended_Pictographic}|[\u1100-\u115F\u2329\u232A\u2E80-\u303E\u3040-\uA4CF\uA960-\uA97C\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6B\uFF00-\uFF60\uFFE0-\uFFE6\u{16FE0}-\u{18DFF}\u{1AFF0}-\u{1B2FF}\u{1F200}-\u{1F265}\u{20000}-\u{3FFFD}]/u;

const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// a blended t of the way toward b (t 0..1), as #rrggbb.
export const mix = (a, b, t) => { const y = rgbOf(b); return '#' + rgbOf(a).map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const fg = (h, s) => (s ? `${E}38;2;${rgbOf(h).join(';')}m${s}${E}39m` : '');
export const bg = (h, s) => `${E}48;2;${rgbOf(h).join(';')}m${s}${E}49m`;
export const bold = (s) => `${E}1m${s}${E}22m`;
export const dim = (s) => `${E}2m${s}${E}22m`;
// Every escape sequence (CSI, OSC ending in BEL or ESC \, other ESC x) and control character except \n,
// including C1 controls (\x80-\x9f), which some terminals treat as escapes and git allows in branch names.
// Also bidi overrides and zero-width marks, which reorder or hide neighbours (U+200C/D stay: emoji and some scripts need them),
// and other invisible ones: the Arabic letter mark, word joiners, soft hyphen, annotation marks and tag characters.
export const ESCAPES = /\x1b\[[0-?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\|$)|\x1b[^[\]]?|[\x00-\x09\x0b-\x1f\x7f-\x9f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029\ufeff\u00ad\u061c\u180e\u2060-\u2064\ufff9-\ufffb]|\udb40[\udc00-\udc7f]/g;
export const strip = (s) => s.replace(ESCAPES, '');

// ♥, ♡ and ▪ are pictographic (♡ only in older Node) but draw one column (text presentation by default); lives and outline use them bare.
// A character plus VS16 (U+FE0F) draws as a 2-column emoji; a lone VS16 draws nothing.
const width = (ch) => (ch === '\ufe0f' ? 0 : ch.endsWith('\ufe0f') ? 2 : !'♥♡▪'.includes(ch) && WIDE.test(ch) ? 2 : 1);
export const vis = (s) => { let n = 0; for (const m of strip(s).matchAll(/[\s\S]\ufe0f?/gu)) n += width(m[0]); return n; };

// Cut a coloured line to n visible columns without breaking its escape codes, or what draws as one character
// (a flag, a joined emoji, a skin tone, a letter and its accent): the cut goes between whole characters.
// Making a segmenter costs ~20 ms, a whole refresh's budget, so plain text (no mark, joiner, flag half, skin tone or
// Hangul part, Thai or Lao sara am) steps by code point and the segmenter is made only for text that needs it.
let SEG;
const JOINS = /[\p{M}\p{Cf}\p{RI}\p{Emoji_Modifier}\u1160-\u11ff\ud7b0-\ud7ff\u0e33\u0eb3]/u;
const chars = (t) => (JOINS.test(t) ? Array.from((SEG ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })).segment(t), (g) => g.segment) : Array.from(t));
export function cut(s, n) {
  if (vis(s) <= n) return s + `${E}0m`; // what fits is never segmented: a badge is cut on every refresh
  let out = '', seen = 0;
  for (const m of s.matchAll(/\x1b\[[0-9;]*m|[^\x1b]+|\x1b/g)) {
    if (/^\x1b\[[0-9;]*m$/.test(m[0])) { out += m[0]; continue; }
    for (const segment of chars(m[0])) {
      const w = vis(segment);
      if (seen + w > n) return out + `${E}0m`;
      seen += w;
      out += segment;
    }
  }
  return out + `${E}0m`;
}

const lumOf = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const lum = (h) => lumOf(rgbOf(h));
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const inkOn = (h) => (contrast(h, '#141312') >= contrast(h, '#ffffff') ? '#141312' : '#ffffff');
// c, pushed toward black or white only as far as it needs to read on `on` (4.5:1 is small text); a colour that already reads is unchanged.
export const readable = (c, on, min = 4.5) => {
  const to = contrast(on, '#000000') >= contrast(on, '#ffffff') ? '#000000' : '#ffffff';
  let x = c;
  for (let t = 0.05; contrast(x, on) < min && t <= 1.001; t += 0.05) x = mix(c, to, t);
  return x;
};

const LEVELS = [0, 95, 135, 175, 215, 255];
// The 240 colours of the xterm cube and grey ramp (0-15 are the terminal's own, so unknown). Made on first need.
let XTERM;
const xterm = () => (XTERM ??= Array.from({ length: 240 }, (_, i) => {
  const v = i < 216 ? [LEVELS[Math.floor(i / 36)], LEVELS[Math.floor(i / 6) % 6], LEVELS[i % 6]] : Array(3).fill(8 + (i - 216) * 10);
  return { n: 16 + i, v, y: lumOf(v) };
}));
// The nearest xterm colour. With away 1 (or -1) only one as light or lighter (as dark or darker), so a colour moved
// away from what it is read against never loses contrast to it. Remembered: a line repeats ~20 colours ~70 times.
const found = new Map();
function index256(rgb, away) {
  const key = `${rgb}/${away}`;
  if (found.has(key)) return found.get(key);
  const y = lumOf(rgb);
  let best = 16, d0 = Infinity;
  for (const c of xterm()) {
    const d = (c.v[0] - rgb[0]) ** 2 + (c.v[1] - rgb[1]) ** 2 + (c.v[2] - rgb[2]) ** 2;
    if (d < d0 && away * (c.y - y) >= 0) { d0 = d; best = c.n; }
  }
  found.set(key, best);
  return best;
}

// 38;2;r;g;b and 48;2;r;g;b can sit anywhere in one code (a badge may send bold and a colour together).
// With the terminal's background (bg), words move away from what they sit on (a fill drawn before them, else the
// background) and a fill moves away from its ink (inkOn), so neither reads worse than in full colour: the nearest of
// the 256 can be lighter on a light terminal (Claude's red fell to 3.7:1), and the pace tick fell below 3:1 on a fill.
const rgbAt = (p, i) => {
  const rgb = p.slice(i + 2, i + 5).map((v) => Math.min(255, Math.max(0, +v || 0)));
  while (rgb.length < 3) rgb.push(0);
  return rgb;
};
// The shapes a battery draws in its fill's colour: block cells (U+2580-U+259F, such as a full or part cell) and the
// round ends pieces.js draws (CAP_R, CAP_L).
const SHAPE = new RegExp('[' + String.fromCharCode(0x2580) + '-' + String.fromCharCode(0x259f, 0xe0b4, 0xe0b6) + ']');
export const to256 = (s, bg) => {
  const back = bg ? lum(bg) : 0;
  let under = back; // shortcut: a fill sent in the same code after its words counts from the next code on
  // A round end or a battery cell is drawn as a word in its battery's colour, so when the text also fills with that
  // colour the shape maps the fill's way: moving the two apart left a seam between them. Every other word still maps by
  // what it sits on, or a faint colour of your own that is also a fill would read worse.
  const fills = new Set();
  if (bg && SHAPE.test(s)) for (const [, ps] of s.matchAll(/\x1b\[([0-9;]*)m/g)) {
    const p = ps.split(';');
    for (let i = 0; i < p.length; i++) if ((p[i] === '38' || p[i] === '48') && (p[i + 1] === '2' || p[i + 1] === '5')) {
      if (p[i] === '48' && p[i + 1] === '2') fills.add(rgbAt(p, i).join());
      i += p[i + 1] === '2' ? 4 : 2;
    }
  }
  return s.replace(/\x1b\[([0-9;]*)m/g, (m, ps, at) => {
    const p = ps.split(';'), out = [], end = SHAPE.test(s[at + m.length] ?? '');
    for (let i = 0; i < p.length; i++) {
      if ((p[i] === '38' || p[i] === '48') && p[i + 1] === '2') {
        const rgb = rgbAt(p, i);
        const hex = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
        const asFill = p[i] === '48' || (end && fills.has(rgb.join()));
        const away = !bg ? 0 : asFill ? (inkOn(hex) === '#ffffff' ? -1 : 1) : Math.sign(lumOf(rgb) - under);
        const n = index256(rgb, away);
        if (bg && p[i] === '48') under = xterm()[n - 16].y;
        out.push(p[i], '5', n); i += 4;
      }
      else if ((p[i] === '38' || p[i] === '48') && p[i + 1] === '5') { out.push(p[i], '5', p[i + 2]); i += 2; } // its colour number is not a code
      else {
        if (p[i] === '0' || p[i] === '' || p[i] === '49') under = back; // the fill ends
        out.push(p[i]);
      }
    }
    return `${E}${out.join(';')}m`;
  });
};
