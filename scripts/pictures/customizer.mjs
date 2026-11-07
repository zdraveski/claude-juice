// Draws docs/images/customizer.png (the page down to the first row of looks) and customizer.gif (a short tour),
// from this checkout's web/ page. Run: node scripts/pictures/customizer.mjs (needs Playwright and ffmpeg).
import { createServer } from 'node:http';
import { OUT, IMG, browser as launch } from './shot.mjs';
import { execSync } from 'node:child_process';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const REPO = join(import.meta.dirname, '../../');
const FR = join(OUT, 'frames');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  let p = normalize(join(REPO, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (p.endsWith('\\') || p.endsWith('/')) p = join(p, 'index.html');
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/web/`;
const browser = await launch();
const PW = 390; // a phone: the page's smallest text is 10.5px, ~9.4px on a phone; passing 12px would need bigger text in web/
const open = async (w, h, scale) => {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  pg.on('dialog', (d) => d.dismiss());
  await pg.goto(base);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForSelector('[data-look]');
  return pg;
};

// ---------- PNG: page top through the first row of looks, then a dark margin ----------
{
  const pg = await open(PW, 1200, 2);
  const bottom = await pg.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-look]')], top = cards[0].getBoundingClientRect().top;
    cards.filter((c) => c.getBoundingClientRect().top > top + 1).forEach((c) => (c.style.display = 'none'));
    const sec = document.querySelector('.c-looks');
    let n = sec.nextElementSibling; while (n) { n.style.display = 'none'; n = n.nextElementSibling; }
    let m = sec.parentElement.nextElementSibling; while (m) { m.style.display = 'none'; m = m.nextElementSibling; }
    return Math.ceil(sec.getBoundingClientRect().bottom + scrollY);
  });
  await pg.setViewportSize({ width: PW, height: bottom + 60 });
  await pg.screenshot({ path: join(IMG, 'customizer.png'), clip: { x: 0, y: 0, width: PW, height: bottom + 60 } });
  console.log('customizer.png', `${PW}x${bottom + 60} @2x`);
  await pg.close();
}

// ---------- GIF frames: Juice -> Spotlight -> Colour-blind friendly -> Light -> Dark -> Juice ----------
const W = PW, H = 760, FPS = 10;
const pg = await open(W, H, 1);
await pg.addStyleTag({ content: '#fc{position:fixed;left:0;top:0;z-index:99999;pointer-events:none;width:26px;height:26px}#fr{position:fixed;z-index:99998;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #e2885f;opacity:0}' });
await pg.evaluate(() => {
  document.body.insertAdjacentHTML('beforeend', '<div id="fr"></div><svg id="fc" viewBox="0 0 26 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17 15 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>');
});
// Scroll so the sticky preview sits on top with the first looks under it.
const looksTop = await pg.evaluate(() => document.querySelector('.c-looks').getBoundingClientRect().top + scrollY);
const stageH = await pg.evaluate(() => document.querySelector('.stage').getBoundingClientRect().height);
const scroll0 = Math.round(looksTop - stageH - 20); // low enough that the intro sentence is fully off the top
const centre = async (sel, sy) => pg.evaluate(([s, y]) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + scrollY - y + r.height / 2]; }, [sel, sy]);
await pg.evaluate((y) => scrollTo(0, y), scroll0);
await pg.waitForTimeout(300);
const look = (id) => `[data-look="${id}"]`;
const juice = await centre(look('juice'), scroll0), spot = await centre(look('spotlight'), scroll0);
const cbY = await pg.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, look('colorblind'));
const scroll1 = Math.round(cbY - stageH - 30);
const cb = await centre(look('colorblind'), scroll1);
// The sticky preview only pins once scrolled far enough, so measure its buttons where they get clicked.
await pg.evaluate((y) => scrollTo(0, y), scroll1); await pg.waitForTimeout(200);
const light = await centre('[data-view="term"] [data-v="light"]', scroll1), dark = await centre('[data-view="term"] [data-v="dark"]', scroll1);
await pg.evaluate((y) => scrollTo(0, y), scroll0); await pg.waitForTimeout(200);

await pg.mouse.click(juice[0], juice[1]); await pg.waitForTimeout(200); // first frame = last frame (Juice chosen), so the loop is seamless
await rm(FR, { recursive: true, force: true }); await mkdir(FR);
let f = 0, cur = juice, sy = scroll0; // start and end on Juice so the loop is seamless
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const frame = async (ring = 0) => {
  await pg.evaluate(([x, y, y2, r]) => {
    if (Math.abs(scrollY - y2) > 0.5) scrollTo(0, y2);
    const c = document.getElementById('fc'); c.style.transform = `translate(${x - 2}px,${y - 2}px)`;
    const o = document.getElementById('fr'); o.style.left = x + 'px'; o.style.top = y + 'px'; o.style.opacity = r; o.style.transform = `scale(${1.6 - r * 0.6})`;
  }, [cur[0], cur[1], sy, ring]);
  await pg.mouse.move(cur[0], cur[1]);
  await pg.waitForTimeout(40);
  await pg.screenshot({ path: join(FR, `f${String(f++).padStart(3, '0')}.png`) });
};
const hold = async (s) => { for (let i = 0; i < Math.round(s * FPS); i++) await frame(); };
const move = async (to, s, toScroll = sy) => {
  const from = cur, s0 = sy, n = Math.round(s * FPS);
  for (let i = 1; i <= n; i++) { const t = ease(i / n); cur = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]; sy = s0 + (toScroll - s0) * t; await frame(); }
};
const click = async () => { await pg.mouse.click(cur[0], cur[1]); await pg.waitForTimeout(120); await frame(1); await frame(0.5); };

await hold(0.5);
await move(spot, 0.7); await click(); await hold(0.9);
await move(cb, 0.8, scroll1); await click(); await hold(0.9);
await move(light, 0.6); await click(); await hold(0.9);
await move(dark, 0.4); await click(); await hold(0.4);
await move(juice, 0.8, scroll0); await click(); await hold(0.5);
console.log('frames', f, `${W}x${H}`, (f / FPS).toFixed(1) + 's');
await browser.close();
server.close();
// One palette for the whole GIF, so colours don't shimmer between frames.
execSync(`ffmpeg -v error -y -framerate ${FPS} -i "${join(FR, 'f%03d.png')}" -filter_complex "[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a" -loop 0 "${join(IMG, 'customizer.gif')}"`);
console.log('customizer.gif written');
