// A drawn line as HTML, for the customizer and the README pictures. Reads only the codes ansi.js emits.
// Block and round-end glyphs are drawn per cell like VS Code, so a browser font's own shapes never show. No node: imports.
const seq = (from, n, step) => Array.from({ length: n }, (_, i) => String.fromCharCode(from + i * step)).join('');
const LEFTS = seq(0x258f, 8, -1), LOWERS = seq(0x2581, 7, 1); // one eighth to full, from the left / from the bottom
const TICK = String.fromCharCode(0x2502), CAP_L = String.fromCharCode(0xe0b6), CAP_R = String.fromCharCode(0xe0b4);
function glyph(ch, f, b0) {
  const b = b0 || 'transparent';
  let i = LEFTS.indexOf(ch);
  if (i >= 0) { const p = ((i + 1) / 8) * 100; return `linear-gradient(90deg,${f} ${p}%,${b} ${p}%)`; }
  i = LOWERS.indexOf(ch);
  if (i >= 0) { const p = ((i + 1) / 8) * 100; return `linear-gradient(0deg,${f} ${p}%,${b} ${p}%)`; }
  // At least 1.5px wide, so the even-pace tick stays visible at normal zoom.
  if (ch === TICK) return `linear-gradient(90deg,${b} calc(50% - .75px),${f} calc(50% - .75px),${f} calc(50% + .75px),${b} calc(50% + .75px))`;
  if (ch === CAP_L) return `radial-gradient(ellipse 100% 50% at 100% 50%,${f} 97%,transparent 100%) ${b}`;
  if (ch === CAP_R) return `radial-gradient(ellipse 100% 50% at 0% 50%,${f} 97%,transparent 100%) ${b}`;
  return null;
}
const esc = (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] || c;
// A browser has no terminal palette, so colors=terminal previews in VS Code's default 16.
const ANSI16 = ['#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5', '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff'];
// Each line becomes <div class="ln">; termFg is the ink for words with no colour of their own.
export function ansiToHtml(text, termFg) {
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
