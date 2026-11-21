// Draws docs/images/before-after-*.png: a plain status line above juice's, for GitHub's dark and light themes.
// The juice line comes from juice's own renderer (VS Code's round ends; the README says how to turn them on elsewhere).
// Run: node scripts/pictures/before-after.mjs (needs Playwright installed globally, npm i -g playwright, ffmpeg and the network, for Google Fonts).
import { browser, shoot } from './shot.mjs';
import { demo, THEMES, line, page, WINDOW_CSS, winBar, prompt } from './common.mjs';

const frame = (label, tag, under) => `<div class="box win">${winBar(label, tag)}${prompt('')}<div class="under">${under}</div></div>`;
const ba = (theme) => page(theme, 1280, 4000, `${WINDOW_CSS}
body{padding:0}.stack{display:grid;gap:22px}.bar{font-size:24px}.bar em{font-size:22px}
.plain{color:var(--sub)}.under .term{font-size:21px}.prompt{font-size:26px;padding:18px 22px}`,
`<div class="stack">${frame('Before', 'a status line without limits', '<div class="term plain">Opus 5.5 · checkout-app</div>')}
${frame('After', 'with juice', `<div class="term">${line(demo, { show: ['memory', 'session', 'week', 'fable'], cost: 'off' }, 100, theme).html}</div>`)}</div>`);

const br = await browser();
for (const theme of THEMES) await shoot(br, `before-after-${theme}`, ba(theme));
await br.close();
