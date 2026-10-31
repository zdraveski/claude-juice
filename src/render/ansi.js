// Colour escapes, width counting, cutting and 256-colour mapping. No node: imports.
const E = '\x1b[';
const SGR = /\x1b\[[0-9;]*m/g;
const WIDE = /\p{Extended_Pictographic}|[\u1100-\u115F\u2E80-\u303E\u3040-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{20000}-\u{3FFFD}]/u;

const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const fg = (h, s) => `${E}38;2;${rgbOf(h).join(';')}m${s}${E}39m`;
export const bg = (h, s) => `${E}48;2;${rgbOf(h).join(';')}m${s}${E}49m`;
export const bold = (s) => `${E}1m${s}${E}22m`;
// Every escape sequence (CSI, OSC ending in BEL or ESC \, other ESC x) and control character except \n,
// including C1 controls (\x80-\x9f), which some terminals treat as escapes and git allows in branch names.
export const ESCAPES = /\x1b\[[0-?]*[ -\/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\|$)|\x1b[^[\]]?|[\x00-\x09\x0b-\x1f\x7f-\x9f]/g;
export const strip = (s) => s.replace(ESCAPES, '');

const width = (ch) => (ch === '️' ? 0 : WIDE.test(ch) ? 2 : 1);
export const vis = (s) => { let n = 0; for (const ch of strip(s)) n += width(ch); return n; };

// Cut a coloured line to n visible columns without breaking its escape codes.
export function cut(s, n) {
  let out = '', seen = 0;
  for (const m of s.matchAll(/\x1b\[[0-9;]*m|[\s\S]/gu)) {
    if (m[0].startsWith('\x1b')) { out += m[0]; continue; }
    const w = width(m[0]);
    if (seen + w > n) break;
    seen += w;
    out += m[0];
  }
  return out + `${E}0m`;
}

const lum = (h) => { const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const inkOn = (h) => (contrast(h, '#141312') >= contrast(h, '#ffffff') ? '#141312' : '#ffffff');

const LEVELS = [0, 95, 135, 175, 215, 255];
const nearestLevel = (v) => LEVELS.reduce((best, l, i) => (Math.abs(l - v) < Math.abs(LEVELS[best] - v) ? i : best), 0);

function index256(r, g, b) {
  const [ri, gi, bi] = [r, g, b].map(nearestLevel);
  const cube = [LEVELS[ri], LEVELS[gi], LEVELS[bi]];
  const grey = Math.min(23, Math.max(0, Math.round((((r + g + b) / 3) - 8) / 10)));
  const gv = 8 + grey * 10;
  const dist = (c) => (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
  return dist([gv, gv, gv]) < dist(cube) ? 232 + grey : 16 + 36 * ri + 6 * gi + bi;
}

export const to256 = (s) => s.replace(/\x1b\[([34]8);2;(\d+);(\d+);(\d+)m/g, (_, k, r, g, b) => `${E}${k};5;${index256(+r, +g, +b)}m`);
