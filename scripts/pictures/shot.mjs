// Shared by the picture scripts: saves a page as a PNG in docs/images, cropped to its content,
// and refuses a picture that would be unreadable once GitHub shrinks it onto a phone.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OUT = join(import.meta.dirname, 'out'), IMG = join(import.meta.dirname, '../../docs/images');
// A phone shows a README picture about 350px wide. There, code (status lines, commands) must be 12px or more
// and other text 16px or more; on a 720px canvas that is 25px and 33px.
export const PHONE = 350, MIN_CODE = 12, MIN_TEXT = 16;
const CODE = '.term,.mono,.cta,code';

export async function browser() {
  const pw = createRequire(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js'))('playwright');
  return pw.chromium.launch();
}

export async function shoot(br, name, html, width = 720, pad = 48) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.html`), html);
  const pg = await br.newPage({ viewport: { width, height: 4000 }, deviceScaleFactor: 2 });
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
  const h = r.bottom + pad, ph = (f) => +(f * PHONE / width).toFixed(1);
  await pg.screenshot({ path: join(IMG, `${name}.png`), clip: { x: 0, y: 0, width, height: h } });
  await pg.close();
  const bad = [ph(r.code) < MIN_CODE && `code ${ph(r.code)}px`, r.text < 99 && ph(r.text) < MIN_TEXT && `text ${ph(r.text)}px`, r.over && `${r.over} boxes overflow`].filter(Boolean);
  console.log(name, `${width}x${h} @2x`, `phone: code ${ph(r.code)}px, text ${r.text < 99 ? ph(r.text) : '-'}px`, bad.length ? 'FAIL' : 'ok');
  if (bad.length) throw new Error(`${name}: unreadable on a phone or cut off (${bad.join(', ')})`);
}
