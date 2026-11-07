# Battery styles and the new default look: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make idea 9 from `reports/juice look ideas.html` ("Best of": glossy batteries with coloured glass, a model chip, warming effort steps and quiet dividers) the default look, and add a `battery` setting that offers the other styles KIRE picked: outline (6), hot tip (5), liquid edge (4) and pace glow (3).

**Architecture:** One new setting, `battery`, picks how `battery()` and `batteryPct()` in `src/render/pieces.js` paint their cells. Each style is a small painter that both functions share, so the digit placement, pace tick and fit logic stay as they are. The chip and warming steps change `head()` for every layout. The quiet dividers change only the bar layout's joiner.

**Tech Stack:** Node ≥18, ES modules, `node --test`, no dependencies.

**Spec:** Nothing separate. The decisions are below, and the prototype that drew the chosen ideas is `reports/juice look ideas.mjs`. It's untracked: read it for the exact colour mixes, but don't import it.

## Decisions (the spec)

- Setting `battery`: `glossy` (default) | `classic` | `outline` | `hot` | `liquid` | `pace`. `classic` is today's battery, byte for byte.
- `glossy`: a full cell is `▀`, with fg = `mix(c, '#ffffff', 0.38)` and bg = c. An empty cell is `▀` with fg = `mix(casing, '#ffffff', dark ? 0.07 : 0.45)` and bg = casing. A part-filled cell is drawn as in classic. **Glass:** in glossy, casing = `mix(P.casing, c, dark ? 0.16 : 0.22)` and nub = `mix(P.nub, c, 0.35)`.
- `outline`: no casing background. Walls are `▕` before the cells and `▏` after, in `P.mute`. Empty cells are `·` in `P.groove`, the nub is `▪` in `P.mute`, and there are no round caps even when `ctx.round`. Digits inside `batteryPct` are drawn with no background.
- `hot`: only while the level is `warn` or `crit`. Filled cell i gets the colour `mix(P.good, c, (i + 0.5) / cells)`, so the tip is the warning colour. At `ok` (and Fable's `fable`) it looks exactly like classic.
- `liquid`: the last lit cell is `mix(c, dark ? '#ffffff' : '#000000', dark ? 0.45 : 0.25)`.
- `pace`: filled cells left of the even-pace point `elapsed * w` are `mix(c, casing, 0.55)`, and the rest are full c. No `│` tick is drawn. With no `elapsed` it looks like classic.
- **No colour (`ctx.mono`): every style draws as classic.** Lit and unlit cells must differ by shape (rule in `pieces.js:6`), and glossy's `▀` breaks that.
- Styles apply to `battery()` (focus) and `batteryPct()` (bar). Segments, panel, capsules and fuel tank keep their own shapes.
- **Chip:** in every layout, the model shows as `◆ <name>` on bg `mix(P.bg, P.accent, dark ? 0.22 : 0.14)`, with `◆` in accent and the name bold in `P.text`. Round caps `` `` when `ctx.round`, else one padding space on each side.
- **Warming effort:** lit step i (0-based) is `mix(P.sub, P.accent, (i + 1) / 5)`. Unlit steps are unchanged.
- **Quiet dividers (bar only):** items are joined by `fg(P.groove, '  │  ')`, or by `fg(P.groove, ' │ ')` when `fit.tight`.
- Looks don't set `battery`: like `terminal`, it stays the person's own. `LOOK_BASE` and the "seven look keys" test stay as they are.

## Global Constraints

- No new dependencies. No `node:` imports in `src/render/*` (the web customizer imports it; `test/web.test.js` checks this).
- Plain words for users: name the setting "Battery style" in the customizer and docs. Style names: Glossy, Classic, Outline, Hot tip, Liquid edge, Pace glow.
- One piece per commit. Stage explicit paths, never `git add -A`.
- Work on a branch `feat/battery-styles` from `main`, not on `main`.

## Review Focus

1. **NO_COLOR / plain previews** (`/juice looks`): glossy would show `▀` for full and empty cells alike. Expect classic shapes. *Test in Task 2.*
2. **256-colour terminals:** shine and glass can round to the same palette index and lose the effect, but nothing should break. Expect output that passes through `to256` with no truecolor escapes left. *Test in Task 2.*
3. **Light theme:** glossy's empty-cell shine and liquid's edge must still differ from their neighbours. Expect `contrast(edge, c) > 1.15` in light and dark for every preset. *Test in Task 2.*
4. **Narrow windows:** the chip adds 2 columns and the bar dividers add 1 per gap. Expect the fit steps to still drop in order, and the last-resort cut not to split a number (`wholeItems` already treats ` │ ` as a gap). *Test in Task 4.*
5. **Outline with round ends and digits on the fill:** no caps, no background on digits. Expect `strip()` to show `▕`, then w cells, then `▏▪`, and no `48;2` before the first digit. *Test in Task 2.*

---

### Task 1: The `battery` setting

**Files:**
- Modify: `src/schema.js` (`DEFAULTS`, `CHECK`, `COMMAND_KEYS`; add `BATTERY_IDS`)
- Modify: `src/render/palette.js:35-37` (`makeCtx`)
- Test: `test/schema.test.js`, `test/pieces.test.js`

**Interfaces:**
- Produces: `BATTERY_IDS = ['glossy', 'classic', 'outline', 'hot', 'liquid', 'pace']` exported from `src/schema.js`; `DEFAULTS.battery === 'glossy'`; `ctx.style` (string, one of `BATTERY_IDS`, `'classic'` when `ctx.mono`); `ctx.dark` (boolean, `terminal.theme === 'dark'`).

- [ ] **Step 1: Write the failing tests.** In `test/schema.test.js`, add a test named `battery setting: default glossy, all six ids accepted, junk falls back with a warning`: `sanitize({}, {}).settings.battery === 'glossy'`; for each id in `BATTERY_IDS`, `sanitize({ battery: id }, {})` keeps it; `sanitize({ battery: 'shiny' }, {})` gives `'glossy'` and one warning containing `battery`; `applySet(DEFAULTS, ['battery=outline']).settings.battery === 'outline'`; `toCommand(DEFAULTS)` includes `battery=glossy`; `applySet(DEFAULTS, ['look=retro']).settings.battery === DEFAULTS.battery`. In `test/pieces.test.js`, add `makeCtx: style follows the setting, classic without colour`: `makeCtx(SAMPLES.busy, { ...DEFAULTS, battery: 'hot' }, { theme: 'dark' }).style === 'hot'` and `.dark === true`; with `colorDepth: 'none'`, `.style === 'classic'`.
- [ ] **Step 2: Run** `node --test test/schema.test.js test/pieces.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Add `battery: 'glossy'` to `DEFAULTS`, `battery: oneOf(BATTERY_IDS)` to `CHECK`, and `'battery'` to `COMMAND_KEYS` (after `'ends'`). In `makeCtx`, add `style: terminal.colorDepth === 'none' ? 'classic' : settings.battery || 'glossy'` and `dark: terminal.theme === 'dark'`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. If `toCommand` and link tests assert the exact command string, update their expected strings to include `battery=glossy`. That's the only change allowed to existing tests in this task.
- [ ] **Step 5: Commit.** `git add src/schema.js src/render/palette.js test/schema.test.js test/pieces.test.js` (plus any test file updated in step 4), message `feat: battery style setting`.

### Task 2: The five battery styles

**Files:**
- Modify: `src/render/pieces.js` (`cell`, `tick`, `shell`, `battery`, `batteryPct`)
- Create: `test/fixtures/battery-classic.json` (golden output, made in step 1)
- Test: `test/pieces.test.js`

**Interfaces:**
- Consumes: `ctx.style`, `ctx.dark` (Task 1).
- Produces: unchanged signatures `battery(ctx, pct, level, w = 8, elapsed)` and `batteryPct(ctx, pct, level, w = 7, elapsed)`. Internally, one painter per style: `skin(ctx, c, level, cells, w, elapsed) -> { casing: string|null, nub: string, nubGlyph: string, caps: boolean, cell(i) -> string, tickShown: boolean }`. `casing: null` means no background (outline), so wrap background calls as `back = (s) => casing ? bg(casing, s) : s`.

- [ ] **Step 1: Capture the classic golden output before touching code.** Write a one-off script (keep it out of the repo) that, on the current `main` code, records `battery()` and `batteryPct()` output for every combination of pct ∈ {0, 3, 36, 45, 50, 82, 99, 100}, level ∈ {ok, warn, crit, fable}, w ∈ {5, 7, 8, 12}, elapsed ∈ {undefined, 0.3, 0.9}, round ∈ {true, false} and theme ∈ {dark, light}. Save it as `test/fixtures/battery-classic.json`.
- [ ] **Step 2: Write the failing tests** in `test/pieces.test.js`:
  - `classic style matches the old output byte for byte`: every fixture entry, rendered with `battery: 'classic'`, equals the stored string.
  - `no colour draws every style as classic`: for each style, a ctx built with `colorDepth: 'none'` gives the same `strip()` text as classic.
  - `glossy: full cells are ▀ on the fill, glass casing is tinted`: at 100% every cell is `▀` with bg = c. At 0% the casing bg is `mix(P.casing, c, 0.16)` in dark.
  - `outline: walls, dots, no background, no caps`: `strip(battery(ctxOutlineRound, 36, 'ok'))` matches `/^▕.{8}▏▪$/u`. `batteryPct` at 82% has no `48;2` escape at all.
  - `hot: heats only when warning`: at `ok`, the same as classic. At `crit` and 88%, the last lit cell's fg is `P.bad` and the first cell's fg is close to `P.good`.
  - `liquid: last lit cell differs`, and `contrast(edge, c) > 1.15` for every preset in both themes.
  - `pace: soft before the pace point, no tick`: at elapsed 0.5, used 80, w 8, cells 0–3 are `mix(c, casing, 0.55)`, cells 4–5 are c, and there's no `│`.
  - `glossy light: the empty shine differs from the casing`: `contrast(shine, casing) > 1.05`.
  - `every style survives 256 colours`: `to256(batteryPct(...))` contains no `38;2` or `48;2`.
  - Existing `batteryPct` digit tests run for each of the six styles (wrap the existing loop in `for (const style of BATTERY_IDS)`).
- [ ] **Step 3: Run** `node --test test/pieces.test.js`. Expected: the new style tests FAIL and the classic golden test passes.
- [ ] **Step 4: Implement** the painters in `pieces.js` using the values in **Decisions**. Add a local `mix(a, b, t)` next to them (the same as the prototype's). `battery`/`batteryPct` get casing, cell, tick and caps from `skin()`. The digit logic in `batteryPct` doesn't change, except that digits on the casing use `back`. `batterySeg` and `batteryLow` are untouched.
- [ ] **Step 5: Run** `npm test`. Expected: all pass. Layout or fit tests that assert exact escape strings for the default look may need `battery: 'classic'` added to their settings. Do that rather than changing what they expect.
- [ ] **Step 6: Commit.** `git add src/render/pieces.js test/pieces.test.js test/fixtures/battery-classic.json` (plus the adjusted tests), message `feat: glossy, outline, hot tip, liquid edge and pace glow batteries`.

### Task 3: Model chip and warming effort steps

**Files:**
- Modify: `src/render/layouts.js:14-21` (`head`), `src/render/pieces.js:10-15` (`ramp`)
- Test: `test/layouts.test.js`, `test/pieces.test.js`

**Interfaces:**
- Consumes: `ctx.dark` (Task 1). Produces: `chip(ctx, text) -> string`, exported from `pieces.js`.

- [ ] **Step 1: Write the failing tests.** `chip: model on a tinted tag, round caps only when round`: `strip(chip(roundCtx, 'Opus 5.5')) === '◆ Opus 5.5'` and `strip(chip(plainCtx, 'Opus 5.5')) === ' ◆ Opus 5.5 '`, and the bg escape equals `mix(P.bg, P.accent, 0.22)` in dark and `0.14` in light. `ramp: lit steps warm toward the accent`: for `max`, the five fg colours are all different and the 5th equals `P.accent`. `head: noModel still hides the chip`: a bar render with `fit.noModel` has no `◆`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `chip` in `pieces.js`, use it in `head()` in place of `fg(P.accent, '◆') + ' ' + fg(P.text, name)`, and colour `ramp`'s lit steps as in **Decisions**.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Update width-sensitive fit expectations only where the chip's extra columns move a cut point, and say in the commit message which ones moved.
- [ ] **Step 5: Commit.** Message `feat: model chip and warming effort steps`.

### Task 4: Quiet dividers in the bar layout

**Files:**
- Modify: `src/render/layouts.js:101-104` (`bar`)
- Test: `test/layouts.test.js`, `test/fit.test.js`

- [ ] **Step 1: Write the failing tests.** `bar: items divided by a dim │`: `strip(render(SAMPLES.busy, DEFAULTS, term(200)).text)` contains `'  │  Session'`, and the divider's fg is `P.groove`. With `fit.tight`, the divider is `' │ '`. **Review Focus 4:** for every width from 30 to 160, the default bar on `SAMPLES.trouble` never ends its line in the middle of a number (the existing "never a split number" style of check in `test/fit.test.js`, run for `layout: 'bar'` at each width), and the fit steps still drop in `FIT_STEPS` order.
- [ ] **Step 2: Run** them. Expected: the divider tests FAIL.
- [ ] **Step 3: Implement.** In `bar`, pass `fg(ctx.P.groove, ctx.fit.tight ? ' │ ' : '  │  ')` as the `join` gap.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** Message `feat: quiet dividers in the bar layout`.

### Task 5: Customizer, /juice skill, README and changelog

**Files:**
- Modify: `web/app.js:32` (settings rows), `skills/juice/SKILL.md:41`, `README.md` ("Change how it looks" section), `CHANGELOG.md` ("Not released yet")
- Test: `test/web.test.js` (already checks browser-safe imports); `node scripts/check-customizer.js`

- [ ] **Step 1: Customizer.** Add a row after `ends`: `['battery', 'Battery style', 'How the batteries are drawn. Classic is the old flat look', [['glossy', 'Glossy'], ['classic', 'Classic'], ['outline', 'Outline'], ['hot', 'Hot tip'], ['liquid', 'Liquid edge'], ['pace', 'Pace glow']]]`.
- [ ] **Step 2: Skill.** After the `ends` line, add `- battery: glossy, classic, outline, hot, liquid, pace ("the old look" -> battery=classic, "thin lines" -> battery=outline, "show when I'm going fast" -> battery=pace)`.
- [ ] **Step 3: README.** In "Change how it looks", add a short "Battery style" paragraph: one sentence per style, in plain words, plus `/juice set battery=classic` to go back. Note that the styles change the Status bar and Tightest first layouts.
- [ ] **Step 4: Changelog.** Under "Not released yet → New": the new glossy default with the model tag and dividers, and that `/juice set battery=classic` brings the old bars back. Then the five styles in one line.
- [ ] **Step 5: Verify.** Run `npm test` and `node scripts/check-customizer.js`. Expected: both pass. Open the customizer with playwright-cli at 1280 and 420 wide, in dark and light, pick each battery style, and read the computed backgrounds of the preview's cells. Each style must change the preview.
- [ ] **Step 6: Commit.** Message `docs: battery styles in the customizer, skill, README and changelog`.

### Task 6: Whole-branch check

- [ ] **Step 1:** Run `npm test` on the branch. Expected: all pass, about 288 + the new tests.
- [ ] **Step 2:** Run a ponytail review of the whole range `main..feat/battery-styles` on Opus, and fix every finding.
- [ ] **Step 3:** Ask KIRE to look at the real status line in VS Code and Windows Terminal, dark and light, with `battery=glossy` and then each other style, using `CLAUDE_CONFIG_DIR` on a copy, never the real juice cache.
- [ ] **Step 4:** Stop. Pushing, the PR and the release follow `docs/release/checklist.md` only when KIRE asks.

## Not in this plan

- Redrawing the README pictures (`hero.png`, `anatomy.png`, `looks.png`, `layout-bar.png`, `features.png`). They show the old flat bars and the generator wasn't kept. That needs its own small plan once KIRE has seen the new look in a real terminal.
- Styles for segments, panel, capsules and fuel tank.
