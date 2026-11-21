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
  console.log(`${process.env.CI_REQUIRE_PLAYWRIGHT ? 'Missing Playwright' : 'Skipped'}: these checks need Playwright. Install it with: npm i -g playwright`);
  process.exit(process.env.CI_REQUIRE_PLAYWRIGHT ? 1 : 0); // CI must fail, not skip
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

test('a screen reader hears each card by its name, not the whole preview drawn inside it', async () => {
  const { page } = await open();
  const name = await page.locator('[data-look=juice]').evaluate((b) => [...b.childNodes].filter((n) => !(n.getAttribute?.('aria-hidden') === 'true')).map((n) => n.textContent).join(' ').trim());
  assert.match(name, /^Juice /);
  assert.equal(await page.locator('.thumb:not([aria-hidden=true]), .chips:not([aria-hidden=true])').count(), 0);
});

test('loads with no errors: 15 looks, 6 layouts, 14 colour sets plus your own', async () => {
  const { page, errors } = await open();
  assert.equal(await page.locator('[data-look]').count(), 15);
  assert.equal(await page.locator('[data-layout]').count(), 6);
  assert.equal(await page.locator('[data-preset]').count(), 15);
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

// In a layout with its own shapes, picking a style left the preview unchanged with no word why (1.1.0).
test('the battery style says which layouts show it, only when a picked style is hidden', async () => {
  const { page } = await open();
  const hint = () => page.textContent('[data-hint=battery]');
  assert.doesNotMatch(await hint(), /keeps its own shapes/);
  await page.click('[data-layout=segments]');
  assert.doesNotMatch(await hint(), /keeps its own shapes/, 'the default style: nothing to warn about, as in /juice set');
  await page.click('[data-key=battery][data-v=pie]');
  assert.match(await hint(), /Classic segments keeps its own shapes/);
  await page.click('[data-layout=focus]');
  assert.doesNotMatch(await hint(), /keeps its own shapes/);
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

test('Copy buttons put exactly the shown text on the clipboard', async () => {
  const { page } = await open();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  const clip = () => page.evaluate(() => navigator.clipboard.readText());
  for (const id of ['install1', 'install2', 'install3', 'install4', 'cmd', 'stagecopy']) {
    await page.click(id === 'stagecopy' ? '#stagecopy' : `.c-apply [data-copy=${id}]`);
    assert.equal(await clip(), await page.textContent(id === 'stagecopy' ? '#cmd' : `#${id}`), id);
  }
  assert.match(await page.textContent('#toast'), /Copied/);
  await page.click('#link');
  assert.equal(await clip(), page.url());
});

test('dragging a battery row reorders it, and so do the arrow buttons', async () => {
  const { page } = await open();
  const order = () => page.$$eval('[data-bat]', (rows) => rows.map((r) => r.dataset.bat));
  assert.deepEqual(await order(), ['memory', 'session', 'fable', 'week']);
  await page.dragAndDrop('[data-bat=memory]', '[data-bat=memory]');
  assert.deepEqual(await order(), ['memory', 'session', 'fable', 'week'], 'dropped onto itself: nothing moves');
  await page.dragAndDrop('[data-bat=week]', '[data-bat=memory]');
  assert.deepEqual(await order(), ['week', 'memory', 'session', 'fable']);
  assert.match(await cmd(page), /show=model,effort,week,memory,session,fable,budget /);
  await page.click('[data-move=session][data-dir="-1"]');
  assert.deepEqual(await order(), ['week', 'session', 'memory', 'fable']);
  // Dragged down onto the last row, it takes the last place (1.4.0 stopped one short, so the bottom was unreachable).
  await page.dragAndDrop('[data-bat=week]', '[data-bat=fable]');
  assert.deepEqual(await order(), ['session', 'memory', 'fable', 'week']);
});

test('light terminal, and no sideways scrolling on a phone', async () => {
  const { page } = await open(390);
  await page.click('#popts summary'); // on a phone the preview's own options fold away under the preview
  await page.click('[data-view=term] [data-v=light]');
  assert.ok(await page.locator('#win.light').count());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // "My terminal is light" wins over the preview's Dark, as it does in the real line.
  await page.click('[data-key=terminal][data-v=light]');
  await page.click('[data-view=term] [data-v=dark]');
  assert.ok(await page.locator('#win.light').count(), 'still light: the real line would be');
  assert.equal(await page.getAttribute('[data-view=term] [data-v=light]', 'aria-pressed'), 'true');
});

test('a screen reader hears the live preview as words, and they follow every redraw', async () => {
  const { page } = await open();
  await page.click('#popts summary'); // the preview's options start folded away
  assert.equal(await page.getAttribute('#out', 'role'), 'img');
  const name = () => page.getAttribute('#out', 'aria-label');
  assert.match(await name(), /Memory 64%.*Session 47%.*resets in 2h 10m/);
  assert.doesNotMatch(await name(), /[▀▂▃▅▊■│◆]/u);
  const before = await name();
  await page.click('[data-view=state] [data-v=trouble]');
  assert.notEqual(await name(), before);
});

test('each Copy button says what it copies', async () => {
  const { page } = await open();
  const names = await page.$$eval('[data-copy]', (bs) => bs.map((b) => b.getAttribute('aria-label')));
  assert.equal(names.length, 6);
  assert.ok(names.every((n) => /^Copy /.test(n || '')), String(names));
  assert.equal(new Set(names).size, 6, 'no two alike');
});

test('no sideways scrolling at 320 px wide', async () => {
  const { page } = await open(320);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

// On a phone the preview sat 2,000 px above the looks, so tapping one showed nothing (1.4.0).
// Small (80 columns) still ran past a phone's edge and dropped the battery pictures, with no sign the line went on.
test('on a phone the preview starts at Wide, fades where the line goes on, and stays in view while you pick a look', async () => {
  const { page } = await open(390);
  assert.equal(await page.getAttribute('[data-view=width] [data-v=wide]', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('#fitnote'), '', 'nothing dropped');
  const more = () => page.evaluate(() => document.getElementById('out').classList.contains('more'));
  assert.ok(await more(), 'fades at the right edge');
  await page.evaluate(() => { const o = document.getElementById('out'); o.scrollLeft = o.scrollWidth; });
  await page.waitForFunction(() => !document.getElementById('out').classList.contains('more'));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'only the line scrolls');
  await page.click('[data-look=nightowl]');
  const box = await page.locator('#out').boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 900, `the preview is at ${box?.y}px`);
  assert.match(await cmd(page), /look=nightowl|layout=/);
});

test('on a phone every control is at least 44 px to tap', async () => {
  const { page } = await open(390);
  await page.click('#popts summary');
  const small = await page.evaluate(() => [...document.querySelectorAll('button,select,input,summary')]
    .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
    .map((e) => {
      const b = e.getBoundingClientRect();
      let h = b.height;
      if (e.classList.contains('sw')) { // a switch is drawn thinner than it taps: measure what a tap above and below it hits
        e.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = e.getBoundingClientRect(), x = r.left + r.width / 2, hit = (y) => document.elementFromPoint(x, y)?.closest('.sw') === e;
        let up = 0, down = 0;
        while (up < 30 && hit(r.top - up - 1)) up++;
        while (down < 30 && hit(r.bottom + down)) down++;
        h = r.height + up + down;
      }
      return Math.min(h, b.width) < 44 ? `${e.className || e.tagName} ${Math.round(b.width)}x${Math.round(h)}` : '';
    }).filter(Boolean));
  assert.deepEqual([...new Set(small)], []);
});

// Site review (1.4.1): the skip link moved focus by changing the address, and a new address re-reads the settings from it.
test('the skip link moves to the options and keeps every setting and the history', async () => {
  const { page } = await open();
  const r = await page.evaluate(async () => {
    document.querySelector('[data-look=nightowl]').click();
    document.querySelector('[data-layout=tank]').click(); // within 200 ms, so its address is still waiting to be written
    const before = document.querySelector('#cmd').textContent, h = history.length;
    document.querySelector('.skip').click();
    await new Promise((res) => setTimeout(res, 400));
    return { before, after: document.querySelector('#cmd').textContent, grew: history.length - h, focus: document.activeElement.id, hash: location.hash.slice(0, 3) };
  });
  assert.equal(r.after, r.before);
  assert.deepEqual([r.grew, r.focus, r.hash], [0, 'opts', '#c=']);
});

// Site review (1.4.1): on a phone "Copied" shortened the button and Reset slid under a second tap, wiping the settings.
test('tapping Copy link twice never lands on Reset', async () => {
  // Re-review: the toast's text wrapped the buttons onto a new row, so widths 400-690 and 1010-1100 and the bottom edge
  // still landed on Reset.
  for (const width of [360, 390, 430, 520, 600, 680, 1050]) for (const where of ['middle', 'end', 'bottom']) {
    const { page } = await open(width);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
    await page.click('[data-look=nightowl]');
    const want = await cmd(page);
    await page.locator('#link').scrollIntoViewIfNeeded();
    const b = await page.locator('#link').boundingBox(), x = where === 'end' ? b.x + b.width - 6 : b.x + b.width / 2, y = where === 'bottom' ? b.y + b.height - 4 : b.y + b.height / 2;
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    await page.mouse.click(x, y);
    assert.equal(await cmd(page), want, `${width} px, ${where}`);
    await page.context().close();
  }
});

// Site review (1.4.1): in forced colours the chosen Plan, Window, Terminal and Situation buttons lost their outline.
test('in forced colours every chosen button still shows it is chosen', async () => {
  const { page } = await open();
  await page.emulateMedia({ forcedColors: 'active' });
  const plain = await page.evaluate(() => [...document.querySelectorAll('[aria-pressed=true]')]
    .filter((e) => e.getClientRects().length && getComputedStyle(e).outlineStyle === 'none')
    .map((e) => e.textContent.trim().slice(0, 24)));
  assert.deepEqual(plain, []);
});

// Re-review (1.4.1): on a desktop the buttons have no box-sizing, so holding a width taken with the border and padding
// grew each Copy button by them, and again on every click.
test('a Copy button keeps its width while it says Copied, however often it is clicked', async () => {
  const { page } = await open(1280);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  for (const sel of ['#link', '.c-apply [data-copy=cmd]', '#stagecopy']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    const before = (await page.locator(sel).boundingBox()).width, seen = [];
    for (let i = 0; i < 3; i++) { await page.click(sel); await page.waitForTimeout(100); seen.push((await page.locator(sel).boundingBox()).width); }
    assert.ok(seen.every((w) => Math.abs(w - before) < 1), `${sel}: ${before} then ${seen}`);
  }
});

// Re-review (1.4.1): in forced colours a chosen button's outline is its "chosen" mark, so focus has to look different.
test('in forced colours focus on a chosen button still shows', async () => {
  const { page } = await open();
  await page.click('#popts summary'); // the preview's options start folded away
  await page.emulateMedia({ forcedColors: 'active' });
  const sel = '.seg button[aria-pressed=true]';
  const ring = () => page.evaluate((s) => { const e = document.querySelector(s), c = getComputedStyle(e); return `${c.outlineStyle} ${c.outlineWidth} ${c.outlineOffset}`; }, sel);
  const still = await ring();
  await page.focus(sel); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate((s) => document.activeElement === document.querySelector(s), sel), true);
  assert.notEqual(await ring(), still);
});

// Re-review (1.4.1): in forced colours focus and "chosen" were both a solid Highlight ring, so moving to Max while Pro
// was chosen showed two rings alike.
test('in forced colours a focused button that is not chosen does not look chosen', async () => {
  const { page } = await open();
  await page.click('#popts summary'); // the preview's options start folded away
  await page.emulateMedia({ forcedColors: 'active' });
  const style = (s) => page.evaluate((q) => getComputedStyle(document.querySelector(q)).outlineStyle, s);
  const chosen = await style('.seg button[aria-pressed=true]');
  const other = '.seg button:not([aria-pressed=true])';
  await page.focus(other); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate((q) => document.activeElement === document.querySelector(q), other), true);
  assert.notEqual(await style(other), chosen);
});

// Site review (1.4.1): the preview scrolls, so the keyboard stops on it, and the fade at its end hid the focus ring.
test('the keyboard reaches the preview and sees its focus ring', async () => {
  const { page } = await open(390);
  let id = '';
  for (let i = 0; i < 40 && id !== 'out'; i++) { await page.keyboard.press('Tab'); id = await page.evaluate(() => document.activeElement.id); }
  assert.equal(id, 'out');
  const s = await page.evaluate(() => {
    const o = document.getElementById('out'), c = getComputedStyle(o);
    return { more: o.classList.contains('more'), mask: c.maskImage, ring: c.outlineStyle };
  });
  assert.deepEqual(s, { more: true, mask: 'none', ring: 'solid' });
});

// Safari throws after 100 address changes in 10 s, and dragging a colour picker sends dozens a second.
test('dragging a colour picker changes the address at most 5 times a second, and the link still ends up right', async () => {
  const { page } = await open();
  const n = await page.evaluate(async () => {
    let calls = 0; const real = history.replaceState.bind(history);
    history.replaceState = (...a) => { calls++; return real(...a); };
    const inp = document.querySelector('[data-custom="0"]'), t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      inp.value = `#${(16 + i * 3).toString(16)}8040`;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
    }
    await new Promise((r) => setTimeout(r, 400));
    return { calls, ms: performance.now() - t0 };
  });
  assert.ok(n.calls <= Math.ceil(n.ms / 200) + 1, JSON.stringify(n));
  const want = await cmd(page), other = await open();
  await other.page.goto(page.url());
  assert.equal(await cmd(other.page), want);
});

test('a Copy button says Copied on itself, then goes back', async () => {
  const { page } = await open();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  await page.click('[data-copy=install1]');
  await page.waitForFunction(() => document.querySelector('[data-copy=install1]').textContent === 'Copied', null, { timeout: 2000 });
  await page.waitForFunction(() => document.querySelector('[data-copy=install1]').textContent === 'Copy', null, { timeout: 3000 });
});

test('a Content-Security-Policy is set, and the page still works under it', async () => {
  const { page, errors } = await open();
  assert.match(await page.getAttribute('meta[http-equiv=Content-Security-Policy]', 'content'), /default-src 'none'/);
  await page.click('[data-look=quiet]');
  assert.match(await cmd(page), /colors=calm/);
  assert.deepEqual(errors, []);
});

test('the fake window title is easy to read in both terminals', async () => {
  const { page } = await open();
  await page.click('#popts summary'); // the preview's options start folded away
  const ratio = () => page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const el = document.getElementById('wintitle'), a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(el.parentElement).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert.ok(await ratio() >= 4.5, 'dark');
  await page.click('[data-view=term] [data-v=light]');
  assert.ok(await ratio() >= 4.5, 'light');
});

// Final review (1.4.1): "A little faint" was styled like "Hard to read".
test('a faint colour is marked softly, a hard-to-read one strongly, an easy one not at all', async () => {
  const { page } = await open();
  const mark = async (hex) => {
    await page.fill('[data-custom="0"]', hex);
    return page.evaluate(() => { const el = document.querySelector('[data-ratio="0"]'); return `${el.className} ${el.textContent.split(' (')[0]}`; });
  };
  assert.equal(await mark('#707070'), 'ratio faint A little faint');
  assert.equal(await mark('#404040'), 'ratio bad Hard to read here');
  assert.equal(await mark('#ffffff'), 'ratio Easy to read');
});

// The switch does add fable to show=; what the page can't do is let juice read the login.
test('the Fable row reads as sentences, says it needs /juice set fable=on, and names no plan as the only one', async () => {
  const { page } = await open();
  await page.click('#popts summary'); // the preview's options start folded away
  const row = () => page.textContent('[data-bat=fable] .d');
  const tail = " Shows only after you run /juice set fable=on in Claude Code.";
  assert.equal(await row(), `The separate weekly limit for Fable.${tail}`);
  await page.click('[data-view=plan] [data-v=pro]');
  assert.equal(await row(), `The separate weekly limit for Fable · The preview hides it on Pro.${tail}`);
  assert.doesNotMatch(await row(), /Only Max|Preview only/);
  // Pro may have Fable, which the preview only hides; API keys have no Fable limit, so nothing to turn on.
  await page.click('[data-view=plan] [data-v=payg]');
  assert.equal(await row(), 'The separate weekly limit for Fable · API keys have no Fable limit');
});

test('the Motion choice reaches the copied command, once the person makes it', async () => {
  const { page } = await open();
  assert.doesNotMatch(await cmd(page), /motion=/, 'a page left at Still keeps the motion they set before');
  await page.click('[data-key=motion][data-v=on]');
  assert.match(await cmd(page), / motion=on$/);
  await page.click('[data-key=motion][data-v=off]');
  assert.match(await cmd(page), / motion=off$/);
});

test('the control cards keep a side gutter, and a short window lets the preview scroll', async () => {
  const { page } = await open(1024);
  assert.ok(await page.$eval('#opts', (el) => parseFloat(getComputedStyle(el).paddingLeft)) > 0);
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await page.$eval('.stage', (el) => getComputedStyle(el).position), 'static');
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await page.$eval('.stage', (el) => getComputedStyle(el).position), 'sticky');
});

test('Reset puts the preview and the command back to the default', async () => {
  const { page } = await open();
  await page.click('[data-key=terminal][data-v=light]');
  await page.click('[data-key=motion][data-v=on]');
  await page.click('#reset');
  assert.doesNotMatch(await cmd(page), /terminal=|motion=/);
  assert.equal(await page.$eval('#win', (el) => el.classList.contains('light')), false);
});

test('choosing another look afterwards undoes Sand, and only Sand', async () => {
  const { page } = await open();
  await page.click('[data-look=sand]');
  assert.match(await cmd(page), /battery=sand/);
  await page.click('[data-look=juice]');
  assert.doesNotMatch(await cmd(page), /battery=sand/);
  assert.equal(await page.getAttribute('[data-key=battery][data-v=glossy]', 'aria-pressed'), 'true');
  await page.click('[data-key=battery][data-v=pie]');
  await page.click('[data-look=juice]');
  assert.match(await cmd(page), /battery=pie/, 'a style the person picked stays');
});

test('with nothing switched on the page says the status line would be empty', async () => {
  const { page } = await open();
  for (const k of ['model', 'effort', 'budget', ...(await page.$$eval('[data-bat]', (r) => r.map((x) => x.dataset.bat)))]) {
    if ((await page.getAttribute(`[data-show=${k}]`, 'aria-checked')) === 'true') await page.click(`[data-show=${k}]`);
  }
  assert.match(await page.textContent('#fitnote'), /Nothing is switched on/);
});

test('a switch the plan does not offer stays put when clicked, and Sand lights up its colour card', async () => {
  const { page } = await open();
  await page.click('#popts summary');
  await page.click('[data-view=plan] [data-v=payg]');
  const state = () => page.evaluate(() => [document.querySelector('[data-show=fable]').getAttribute('aria-checked'), document.getElementById('cmd').textContent]);
  const before = await state();
  await page.click('[data-show=fable]', { force: true });
  assert.deepEqual(await state(), before);
  await page.click('[data-look=sand]');
  assert.equal(await page.getAttribute('[data-preset=bold]', 'aria-pressed'), 'true');
});

test('the sticky preview stays small: the options start folded away', async () => {
  const { page } = await open(1024);
  const h = await page.evaluate(() => document.querySelector('.stage').getBoundingClientRect().height);
  assert.ok(h < 330, `the sticky preview is ${h}px tall`);
});
