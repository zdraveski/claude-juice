# Release checklist

These checks need what GitHub's tests don't have: a real Claude Code, a real Mac and real terminals. GitHub already
runs every test and the end-to-end check (install, the real command through bash and sh, a hung badge killed with
its child, restore) on Windows, macOS and Linux with Node 24 and 26 on every push.

## 0. main is what people install

The plugin store serves whatever is newest on `main` (the marketplace entry is `"source": "./"`), to new installs at
once and under whatever version number `main` says. So:

- `main` is protected by the ruleset `main` (id 26291212): a change reaches it only through a pull request whose 7 GitHub checks pass (3 systems × Node 24 and 26, plus `customizer`, the browser checks), docs included.
  Work on a branch; GitHub runs the tests on every branch.
- When the test matrix changes, change the ruleset's required checks in the same pull request: a required check that no longer runs blocks every merge.
- Code reaches `main` only at a release: merge the pull request with the version raised and its CHANGELOG entry in one go
  (then tag it, step 1 below).
- Docs-only pull requests (README, the pages in `docs/`, CHANGELOG) can be merged between releases; code can't.
- Never run a checkout's `bin/juice-statusline.js` without `CLAUDE_CONFIG_DIR` set to a throwaway folder: a refresh
  points your real status line at the juice it ran from, and it goes blank once that folder is deleted.

## 1. Run here before every release

- [ ] `node --test` passes, and GitHub's run for the release commit is green on all 7.
- [ ] `node scripts/e2e.mjs` passes (GitHub runs it after the tests; it uses a fake home and never touches yours). A changed default, message or step it checks needs it changed too.
- [ ] `node scripts/check-customizer.js` passes every browser check and does not print SKIPPED (needs Playwright: `npm i -g playwright`; GitHub runs it too, as `customizer`).
- [ ] `node scripts/bench.js` prints OK: juice adds at most 75 ms to Node starting.
- [ ] The pinned Playwright in `.github/workflows/test.yml` (`npm i -g playwright@...`) is bumped when it ages (dependabot can't see it): bump it, and check the customizer job is still green.
- [ ] If a look, layout, colour set, the drawing in `src/render`, the sample numbers in `src/samples.js` or the customizer page in `web/` changed since the last release, rebuild the pictures in `docs/images` (`node scripts/pictures/readme.mjs`, plus `hero-features.mjs` and `customizer.mjs` there for the hero, features, button and customizer; they need Playwright, ffmpeg and the network, for Google Fonts) so the README and `docs/guide.md` show what juice draws now. Their alt texts spell out those numbers (64%, 47%, 50%, Road trip's 36% and 53%, Sat 7:20 PM, ~2:33 PM): check they still match the new pictures. If the hero changed, upload `docs/images/hero.png` as the repo's social preview too (Settings, General).
- [ ] `version` is raised in both `.claude-plugin/plugin.json` and `package.json` (tests fail if they differ; Claude Code uses plugin.json's version to find updates).
- [ ] `CHANGELOG.md` has a `## X.Y.Z` section for the new version (tests fail if it is missing), in plain words for users, with `[Changes since <previous>](https://github.com/zdraveski/claude-juice/compare/v<previous>...v<version>)` under its heading (every version from 1.0.1 on has one; earlier ones have no tags).
- [ ] After merging: pull `main`, then `git tag v<version> && git push origin v<version>`. The release workflow (`.github/workflows/release.yml`) runs every test, checks the tag matches `package.json`, `plugin.json` and a changelog section, and publishes the GitHub release titled with the bare version and that section as its notes. Watch it on the Actions tab; if it fails, fix the cause, delete the tag (`git push --delete origin v<version>`, `git tag -d v<version>`) and tag again.

## 2. Inside Claude Code, on each system you have

Use a normal session, not auto mode: auto mode approves on its own, so permission prompts can't be checked there.

1. **Install.** `/plugin marketplace add zdraveski/claude-juice`, `/plugin install juice@juice`, `/reload-plugins`, `/juice setup` (restart Claude Code only if `/juice` is still unknown).
   Pass: the batteries appear within a minute, and `~/.claude/juice-backup.json` holds your previous status line (its `statusLine` is `null` if you had none).
2. **Permissions.** `/juice get` and `/juice doctor` run without a permission prompt. `/juice badges add 'echo hi'` shows the
   command and waits; after you say yes, Claude Code asks permission. Fail on any other order.
3. **PowerShell and `set` (Windows).** Ask `/juice` to set `show=$(whoami)`. Pass: Claude Code asks before running it, or
   juice answers that the value isn't valid. Fail if `whoami` runs.
4. **Setup asks first.** Change `statusLine` in `~/.claude/settings.json` by hand, then `/juice setup`.
   Pass: it explains and asks, and runs `setup --yes` only after you agree.
5. **Doctor.** `/juice doctor`. Pass: it ends with "Everything looks fine." Then break something (delete
   `~/.claude/juice-statusline.mjs`, or ask `/juice` to show nothing) and run it again. Pass: a `!` line names the problem
   and the fix, in plain words, and nothing in the report shows your user name (your home folder reads `~`).
6. **Reset wording.** Look at the status line. Pass: Session says how long ("resets in 2h 10m"); Weekly says the day and
   time ("resets Sat 7:20 PM", or "resets next Wed 2:19 PM" right after a reset) in your time zone, matching Anthropic's usage page. In a narrow window Weekly may say "resets 3d 5h".
7. **Restore.** `/juice restore`. Pass: your old status line is back, and `juice-statusline.mjs` and `juice-backup.json` are gone.
8. **Update.** After publishing a version bump, `/plugin update`. Pass: the old version's folder gets `.orphaned_at`, and the
   line keeps drawing with the new version (`/juice doctor` names it). From 1.3.x: the `refreshInterval` of 1 that juice
   wrote in `settings.json` is 60 after the first refresh. A 30 becomes 60 too; any other number you typed there yourself is left alone.
9. **Turn off and uninstall.** Turn juice off in `/plugin`. Pass: the line reads "juice is turned off…". Uninstall.
   Pass: "juice is not installed…".
10. **No flashing windows (Windows).** Add the badge `git branch --show-current`, then work for 2 minutes.
    Pass: no console window ever flashes.
11. **Fable numbers.** On a Max account, the Fable battery matches Anthropic's usage page.
12. **Desktop app.** Open a Code tab in the Claude desktop app. Write down whether the status line shows there at all.
    It showed at 1.0.0 but not on 2026-11-08 (Windows). If the answer changes, update "Where juice shows" in the README.
13. **Motion.** After a fresh `/juice setup`, the batteries stand still and `settings.json` has `refreshInterval` 60.
    `/juice set motion=on`. Pass: the batteries climb within 10 seconds, with no restart. `/juice set motion=off`. Pass: they stand still again.
14. **Token.** Start Claude Code with `CLAUDE_CONFIG_DIR` set to an empty folder, sign in, then `/juice setup`.
    Pass: it asks before juice reads anything. Answer no. Pass: after Claude's first reply, `juice-cache/fable.json` does not exist.
    On a Mac, answering yes brings the Keychain prompt.
15. **Copied badge.** Copy a `juice.json` with a badge in it from another computer (or another `CLAUDE_CONFIG_DIR`).
    Pass: `/juice badges list` marks it not approved, and after you say yes to `/juice badges add` with the same command, it is approved as the same badge number and shows on the line.

## 3. On a Mac

GitHub's Mac runs these on every push, so they need no Mac here:
- the Keychain names (`scripts/mac-keychain.mjs`: a fake sign-in in a throwaway keychain, read through the real `security` tool, with and without `CLAUDE_CONFIG_DIR`, the accent typed either way);
- Claude Code started from an app (`scripts/e2e.mjs`: `sh` with a bare `PATH`);
- a Node upgrade (`scripts/e2e.mjs`: the Node setup pinned is removed and the line still draws, as long as another Node is on PATH; with none, `/juice doctor` says the Node is gone and to run `/juice setup`);
- `/juice doctor` (`scripts/e2e.mjs`, including "Fable battery: off on a Mac until you type /juice set fable=on").

Only a person can do this one. The Fable battery is off on a Mac until someone turns it on, so it can wait for a Mac user:
- [ ] **Keychain prompt** (Mac with a Max login). `/juice set fable=on`. If macOS asks, wait 10 seconds, then click Always Allow.
  Pass: the Fable battery shows within 5 minutes, no second prompt comes in the next 30 minutes, and `/juice doctor` says "last checked".

## 4. Terminal matrix (needs real terminals)

For each, check dark and light: "rounded ends OK" and "truecolor OK". Save no screenshots.
Run `node scripts/terminal-check.js` in the terminal and answer its five questions; it also prints what juice picks there on its own.

- [x] VS Code on Windows: all five yes (1.0.0)
- [ ] VS Code on macOS: dark / light, rounded ends OK / truecolor OK
- [x] Windows Terminal: all five yes (1.0.0)
- [ ] iTerm2: dark / light, rounded ends OK / truecolor OK
- [ ] macOS Terminal: dark / light, rounded ends OK / truecolor OK
- [ ] One Linux terminal (name it here): dark / light, rounded ends OK / truecolor OK

## History (not a to-do)

What was checked and decided before, kept for the record.

## Results for 1.0.0 (2026-10-31, Windows 10, Claude Code 2.1.316)

- Section 1: 282 tests, GitHub 9/9 with e2e and the Mac Keychain check, 9 browser checks, bench 65 ms of 75.
- Section 2: steps 1-7 and 9-12 pass. Step 12: the Claude desktop app's Code tab shows the batteries.
  Step 8 (update) is checked right after publishing, from 0.2.6 to 1.0.0.
- Section 3: everything GitHub's Mac can check passes; the Keychain prompt waits for a Mac user.
- Section 4: Windows Terminal and VS Code on Windows, all five questions yes. macOS and Linux terminals wait for users there.
- Before release: a full audit of the whole repo (three reviewers), all 20 findings fixed.

## Done before 1.0.0 (kept for the record)

- [x] Install from the marketplace works, and `/juice` resolves to this plugin's skill (2026-10-29, Windows).
- [x] `/juice make it the panel layout` changes `juice.json` and the line (2026-10-29).
- [x] `/juice badges add …` shows the exact command and waits for a yes (2026-10-29).
- [x] Fable battery matches Anthropic's usage page on a Max account (24% = 24%, 2026-10-29).
- [x] A hung badge is killed with its child processes on macOS and Linux: covered by `scripts/e2e.mjs` in CI since 0.2.6.

## Name check

The repo is named `claude-juice` because other projects already use the name juice.

- Searched the web on 2026-10-29 with two queries: no existing Claude Code plugin or marketplace entry named `juice`.
- Similar status line plugins exist under other names: claude-statusline, claudeline, claude-code-plugin-hud, ccstatusline.
- [ ] Later, only when juice is submitted to Anthropic's plugin directory: check it has no `juice` first.

## Hosting (public since 2026-10-29)

- [x] Create the GitHub repo: `zdraveski/claude-juice`, public.
- [x] Enable GitHub Pages from the main branch **root** (`web/app.js` imports `../src/`, and the customizer lives at `/web/`).
- [x] Replace `OWNER/REPO` (and `OWNER.github.io/REPO`) in `src/schema.js` `CUSTOMIZER_URL`, `web/index.html` and `README.md`.
- [x] Add `homepage` and `repository` to `.claude-plugin/plugin.json`.
- [x] Confirm `CUSTOMIZER_URL` contains none of `& | ^ % < >` (the Windows opener passes it to cmd).
