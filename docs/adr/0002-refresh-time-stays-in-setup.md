# The refresh-time rules stay in setup.js

Date: 2026-11-25. Status: accepted.

## Context

Two architecture reviews in a row suggested moving the refresh-time rules out of `plugin/src/setup.js` into their own module. The rules are `JUICE_REFRESH`, `keepsRefresh`, `refreshFor`, `refreshWords` and `matchRefresh`. They are used by `doctor.js`, `cli.js` (`/juice set`) and `statusline.js`, and the reviews said this spread their meaning over four modules. They also said the drawing path loads all of `setup.js` just to call `matchRefresh`.

## Decision

Keep them in `setup.js`.

- Moving them would only relocate the code. The deletion test finds nothing that gets simpler: every caller would ask the new module the same questions it asks `setup.js` today.
- `statusline.js` imports `setup.js` only once per juice update, when the launcher is upgraded. It does not do this on every draw, so the drawing-path cost the reviews named is not there.
- The real gaps were fixed in 1.5.7 instead. A test ties `CLIMB_MS` to the motion-on refresh time, and the doctor reads `juice.json` once.

## Consequences

A new refresh value is still an edit to `setup.js`, plus the words in `doctor.js` and `cli.js` that describe it. `test/cli.test.js`, `test/doctor.test.js` and `test/pieces.test.js` cover them.
