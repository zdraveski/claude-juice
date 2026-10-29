// Browser checks for the web customizer: `node scripts/check-customizer.js`.
// Needs Playwright (npm i -g playwright), which juice itself never uses, so this is not part of `npm test`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.json': 'application/json' };
const VIOLET = 'rgb(167,139,250)'; // Fable's bar while fine, as the preview writes it

function playwright() {
  const roots = [root];
  try { roots.push(execSync('npm root -g', { encoding: 'utf8' }).trim()); } catch {}
  for (const r of roots) for (const name of ['playwright', 'playwright-core']) {
    try { return createRequire(join(r, 'x.js'))(name); } catch {}
  }
  return null;
}
const pw = playwright();
if (!pw) {
  console.log('Skipped: these checks need Playwright. Install it with: npm i -g playwright');
  process.exit(0);
}

// Serves only files inside this repo.
const server = createServer(async (req, res) => {
  let path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  if (path.endsWith(sep)) path = join(path, 'index.html');
  try { res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(await readFile(path)); } catch { res.writeHead(404).end(); }
});
let browser, url;
before(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${server.address().port}/web/`;
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { browser = await pw.chromium.launch(channel ? { channel } : {}); break; } catch {}
  }
  assert.ok(browser, 'no browser found: run npx playwright install chromium');
});
after(async () => { await browser?.close(); server.close(); });

// A fresh page with nothing remembered from earlier visits; collects page errors.
async function open(width = 1280) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
  page.setDefaultTimeout(5000); // a missing element fails in seconds, not Playwright's 30
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  return { page, errors };
}
const cmd = (page) => page.textContent('#cmd');
const lines = (page) => page.locator('#out .ln').count();

test('loads with no errors: 12 looks, 4 layouts, 13 colour sets plus your own', async () => {
  const { page, errors } = await open();
  assert.equal(await page.locator('[data-look]').count(), 12);
  assert.equal(await page.locator('[data-layout]').count(), 4);
  assert.equal(await page.locator('[data-preset]').count(), 14);
  assert.deepEqual(errors, []);
});

test('the preview reads like the status line: used %, countdowns, violet Fable', async () => {
  const { page } = await open();
  assert.match(await page.textContent('#out'), /Session.*47%.*resets in 2h 10m/);
  assert.ok((await page.innerHTML('#out')).includes(VIOLET));
});

test('clicking a look applies and highlights it; changing anything clears the highlight', async () => {
  const { page } = await open();
  await page.click('[data-look=quiet]');
  assert.match(await cmd(page), /colors=calm .*refills=warnings/);
  assert.equal(await page.getAttribute('[data-look=quiet]', 'aria-pressed'), 'true');
  await page.click('[data-show=memory]');
  assert.equal(await page.locator('[data-look][aria-pressed=true]').count(), 0);
});

test('hovering a look previews it without choosing it', async () => {
  const { page } = await open();
  const before = await cmd(page);
  await page.hover('[data-look=everything]');
  assert.equal(await lines(page), 5);
  assert.match(await page.textContent('#fitnote'), /Previewing Everything/);
  await page.mouse.move(5, 5);
  await page.locator('#out .ln').nth(1).waitFor({ state: 'detached' });
  assert.equal(await cmd(page), before);
});

test('a share link brings the same settings back', async () => {
  const { page } = await open();
  await page.click('[data-look=nightowl]');
  const want = await cmd(page);
  const other = await open();
  await other.page.goto(page.url());
  assert.equal(await cmd(other.page), want);
});

test('light terminal, and no sideways scrolling on a phone', async () => {
  const { page } = await open(390);
  await page.click('[data-view=term] [data-v=light]');
  assert.ok(await page.locator('#win.light').count());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
