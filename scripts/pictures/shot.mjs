// Shared by the picture scripts: saves a page as a PNG in docs/images (cropped to its content unless given a height),
// shrinks it to 256 colours with ffmpeg, and refuses a picture too small to read in a desktop README.
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OUT = join(import.meta.dirname, 'out'), IMG = join(import.meta.dirname, '../../docs/images');
// A desktop shows a README picture about 830px wide (the repo page; 1012px on the README alone), a phone about 350px.
// Every word and status line must come out at 12.5px or more on the desktop (GitHub's own code text is 13.6px).
// The phone size is printed, not enforced: desktop comes first, and a phone can zoom.
export const DESK = 830, PHONE = 350, MIN = 12.5;
const CODE = '.term,.code';

export async function browser() {
  const pw = createRequire(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js'))('playwright');
  return pw.chromium.launch();
}

// shown: how wide GitHub shows the picture on a desktop. height: a fixed size (the hero) instead of cropping to the content.
// scale: 2 keeps README pictures sharp on high-density screens; 1 for the social preview.
// clear: transparent where the page has no background (the button); such a picture keeps its full colours.
export async function shoot(br, name, html, { width = 1280, height = 0, pad = 0, shown = DESK, scale = 2, clear = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.html`), html);
  const pg = await br.newPage({ viewport: { width, height: height || 4000 }, deviceScaleFactor: scale });
  await pg.goto(pathToFileURL(join(OUT, `${name}.html`)).href);
  await pg.evaluate(() => document.fonts.ready);
  const r = await pg.evaluate((CODE) => {
    let code = 99, text = 99, bottom = 0;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode, el = t.parentElement;
      if (!t.textContent.trim() || !el.getClientRects().length) continue;
      const f = parseFloat(getComputedStyle(el).fontSize);
      if (el.closest(CODE)) code = Math.min(code, f); else text = Math.min(text, f);
    }
    for (const e of document.body.querySelectorAll('*')) bottom = Math.max(bottom, e.getBoundingClientRect().bottom);
    const over = [...document.body.querySelectorAll('*')].filter((e) => getComputedStyle(e).overflow !== 'visible' && e.scrollWidth > e.clientWidth + 1).length
      + (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0);
    return { code, text, over, bottom: Math.ceil(bottom) };
  }, CODE);
  const h = height || r.bottom + pad, over = r.over + (r.bottom > h ? 1 : 0);
  await pg.setViewportSize({ width, height: h }); // a clip below the window comes out cut off
  const raw = join(OUT, `${name}.png`), png = join(IMG, `${name}.png`);
  await pg.screenshot({ path: clear ? png : raw, clip: { x: 0, y: 0, width, height: h }, omitBackground: clear });
  await pg.close();
  // Text and batteries are flat colours, so 256 of them lose nothing visible and cut the file to about a third.
  if (!clear) execSync(`ffmpeg -v error -y -i "${raw}" -vf "split[a][b];[a]palettegen=max_colors=256:reserve_transparent=0:stats_mode=full[p];[b][p]paletteuse=dither=none" "${png}"`);
  const at = (f, px) => (f < 99 ? +(f * px / width).toFixed(1) : '-'), small = (f) => f < 99 && f * shown / width < MIN;
  const bad = [small(r.code) && `code ${at(r.code, shown)}px`, small(r.text) && `text ${at(r.text, shown)}px`, over && `${over} boxes overflow`].filter(Boolean);
  console.log(name, `${width}x${h} @${scale}x`, `${Math.round(statSync(png).size / 1024)} KB`, `desktop: code ${at(r.code, shown)}px, text ${at(r.text, shown)}px`,
    `(phone: ${at(r.code, Math.min(shown, PHONE))}, ${at(r.text, Math.min(shown, PHONE))})`, bad.length ? 'FAIL' : 'ok');
  if (bad.length) throw new Error(`${name}: too small on a desktop or cut off (${bad.join(', ')})`);
}
