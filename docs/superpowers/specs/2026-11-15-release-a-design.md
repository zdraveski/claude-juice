# Release A: safe for strangers (juice 1.4.0)

Short design, agreed with KIRE on 2026-11-15.

## Why

juice is public code for the general public. Strangers install it from main, on their own laptops, and judge it in the first five minutes. Three things in 1.3.1 could hurt or scare them:

- The default animation costs 16–19% of a CPU core per open Claude window. Idle windows refresh too.
- On Windows and Linux, juice reads the Claude login token without asking.
- Anything that reaches main is installed by everyone.

This release fixes those three, and adds a hint for when juice breaks. It comes before anything that brings more people in (releases B, C and D).

## Goals

1. **Still by default.** The batteries stand at their true fill and the line refreshes once a minute. `motion=on` brings back the climb.
2. **Ask before reading the token.** `/juice setup` asks once, on every system, before juice reads anything.
3. **Protect main.** Nothing lands on main without a pull request and passing tests. This turned out to be in place already (see part 3), so the release only checks it.
4. **Show when juice breaks.** A failing run shows `juice: /juice doctor`.

## Non-goals

These are later releases:

- climbing only when a number changes
- the launcher fast path
- Node 22 support
- the 24-hour clock
- the warning hook
- the one-line install
- freshness hints
- getting listed

## Anti-goals

The release fails, even if it technically works, if any of these happen:

- A new user's token is read before they say yes.
- A current Windows or Linux user loses the Fable battery after updating.
- juice loses or damages anything in a person's Claude `settings.json`.
- A refresh value the person chose by hand gets changed.

## Approaches considered

**Motion default.** KIRE picked **Still**.

| Option | Cost per open window | Trade-off |
|---|---|---|
| **Still** | ~0.3% of a core | New users don't see the climb unless they turn it on |
| Climb on news | ~11% (estimated) | Needs a launcher fast path and more code |
| Today's loop | 16–19% | Never stops; the picture shows less than you've used for 6 of every 12 seconds |

**Current Fable users.** KIRE picked **Keep it**.

| Option | What happens | Trade-off |
|---|---|---|
| **Keep it** | Anyone whose computer already has a Fable reading keeps the battery; everyone else is asked | Current users never formally agreed, though the README told them |
| Stop it | Off for everyone until they say yes | Current users silently lose the battery after an update |
| Tell, don't ask | Setup only mentions it | New users' tokens are still read without a yes |

**Main protection.** My call: require a pull request and passing tests, with no review. A required review would block KIRE, since nobody else can approve.

**Error hint.** My call: a dim hint after the model name, rather than a separate line or a file the person never sees.

## The design

### 1. Motion

- **New setting:** `motion`, either `on` or `off`. The default is `off`. It goes in `src/schema.js` beside the other settings.
- **Drawing:** `src/statusline.js:45` passes `animate: true` today. It becomes `animate: settings.motion === 'on'`. With motion off, the picture is always the full true fill, and the even-pace tick always shows.
- **Refresh rate:** `/juice setup` writes `refreshInterval` 1 when motion is on, and 60 when it is off. `/juice set motion=...` updates it the same way. Both follow setup's existing rule: change only a value juice wrote itself (1, 30 or 60), never one chosen by hand.
- **Current 1.3.x users:** their `settings.json` holds the 1 that juice wrote, and they won't rerun setup. juice moves that 1 to 60 once, on its own, using setup's existing safe write. That write aborts on anything unreadable or unparseable, and it only acts when the status line command runs juice's launcher.
- **Doctor:** `src/doctor.js:58` stops telling motion-off users to refresh every second. It says so only when motion is on and the refresh isn't 1.
- **Elsewhere:** the README and the customizer mention `motion=on` and its cost ("about a sixth of a CPU core per open window").

### 2. Token question

- **What `auto` means:** `fable: 'auto'` (`fableEnabled`, `src/schema.js:19`) now means on only when the computer is not a Mac and a Fable reading already exists (`juice-cache/fable.json`). Otherwise it is off. New installs therefore read nothing until the person answers. Current Windows and Linux users keep their battery. Macs behave as today.
- **The question:** `skills/juice/SKILL.md` asks it before running `JUICE setup`, whenever `fable` is `auto` and there's no Fable reading yet. It says, in plain words:
  - juice reads your Claude login token from this computer
  - it sends the token only to Anthropic, about every 5 minutes, and never stores it
  - you get the Fable battery and up-to-date numbers in windows you're not using
  - saying no keeps Session, Weekly and Memory working
  - on a Mac only: macOS will ask once for Keychain access

  The answer is saved as `fable=on` or `fable=off`. The person can change it later with `/juice set fable=...`.
- **Callers:** `src/cli.js:107`, `src/doctor.js:106` and `src/statusline.js:32` all use `fableEnabled`, so all three get the new rule.
- **Docs:** README Install and Privacy say that setup asks.

### 3. Protect main

- **Already done.** Found while planning on 2026-11-15: the repository ruleset `main` (id 26291212, set up at 1.2.1) is active, and nobody can bypass it. It already covers everything this part asked for:
  - a pull request is required, with 0 approvals
  - all 7 checks must pass: `test` on 3 systems × Node 24 and 26, plus `customizer`
  - no force pushes, no deletion
- The older "branch protection" setting reads as off because the ruleset replaces it. Check the ruleset, not that setting.
- **Left to do:** the release checks the ruleset, and the checklist says to update its required checks whenever the test matrix changes. A required check that no longer runs blocks every merge.

### 4. Error hint

- **Where:** the `catch` in `src/statusline.js:60` already writes `last-error.json` and prints the model name. It now also prints `juice: /juice doctor`, dimmed, or plain when colours are off.
- **No new state:** each run draws fresh, so the hint disappears on the next run that works.

## Release

- **Version:** 1.4.0. It's a minor release: a new setting, and a changed default.
- **Process:** follow `docs/release/checklist.md` line by line.
- **Changelog:** say plainly that the climb is now opt-in, and that setup asks about the token.

## Left to the builder

- Whether the one-time move from 1 to 60 runs from the status line run or the launcher upgrade step. Either way it happens once, through setup's safe write.
- Whether Claude Code picks up a changed `refreshInterval` without a restart. Check it, and if it doesn't, mention it in the `set motion` reply.
- The exact wording of the token question, within the points above.
- Tests: an automated check for each new rule, in particular for `fableEnabled` with and without a reading, for the hand-picked refresh being left alone, for the error hint, and for `motion` in settings. Follow the project's usual test style.
