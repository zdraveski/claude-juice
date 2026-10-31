# Release checklist

Everything here is what GitHub's tests can't do: a real Claude Code, a real Mac, real terminals. GitHub already
runs every test and the end-to-end check (install, the real command through bash and sh, a hung badge killed with
its child, restore) on Windows, macOS and Linux with Node 18, 22 and 24 on every push.

## 1. Run here before every release

- [ ] `node --test` passes, and GitHub's run for the release commit is green on all 9.
- [ ] `node scripts/check-customizer.js` passes all eight browser checks (needs Playwright: `npm i -g playwright`).
- [ ] `node scripts/bench.js` prints OK: juice adds at most 75 ms to Node starting.
- [ ] `version` is raised in both `.claude-plugin/plugin.json` and `package.json` (a test fails if they differ; Claude Code uses plugin.json's to find updates).
- [ ] 0.3.0 only: delete `test/oracle/` and check 1 of `test/readings.property.test.js` (with its oracle imports): the readings rewrite is proven, and the frozen copy would otherwise ship in the plugin.

## 2. Inside Claude Code, on each system you have

Use a normal session, not auto mode: auto mode approves on its own, so permission prompts can't be checked there.
Each step says what passes.

1. **Install.** `/plugin marketplace add zdraveski/claude-juice`, `/plugin install juice@juice`, restart Claude Code, `/juice setup`.
   Pass: the batteries appear within a minute, and `~/.claude/juice-backup.json` holds your previous status line.
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
   time ("resets Sat 7:20 PM") in your time zone, matching Anthropic's usage page. In a narrow window Weekly may say "resets 3d 5h".
7. **Restore.** `/juice restore`. Pass: your old status line is back, and `juice-statusline.mjs` and `juice-backup.json` are gone.
8. **Update.** After publishing a version bump, `/plugin update`. Pass: the old version's folder gets `.orphaned_at`, and the
   line keeps drawing with the new version (`/juice doctor` names it).
9. **Turn off and uninstall.** Turn juice off in `/plugin`. Pass: the line reads "juice is turned off…". Uninstall.
   Pass: "juice is not installed…".
10. **No flashing windows (Windows).** Add the badge `git branch --show-current`, then work for 2 minutes.
    Pass: no console window ever flashes.
11. **Fable numbers.** On a Max account, the Fable battery matches Anthropic's usage page.
12. **Desktop app.** Open a Code tab in the Claude desktop app. Write down whether the status line shows there at all
    (this decides how much the 0.4.0 mod matters).

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

- [ ] VS Code on Windows: dark / light, rounded ends OK / truecolor OK
- [ ] VS Code on macOS: dark / light, rounded ends OK / truecolor OK
- [ ] Windows Terminal: dark / light, rounded ends OK / truecolor OK
- [ ] iTerm2: dark / light, rounded ends OK / truecolor OK
- [ ] macOS Terminal: dark / light, rounded ends OK / truecolor OK
- [ ] One Linux terminal (name it here): dark / light, rounded ends OK / truecolor OK

## Done before 0.3.0 (kept for the record)

- [x] Install from the marketplace works, and `/juice` resolves to this plugin's skill (2026-10-29, Windows).
- [x] `/juice make it the panel layout` changes `juice.json` and the line (2026-10-29).
- [x] `/juice badges add …` shows the exact command and waits for a yes (2026-10-29).
- [x] Fable battery matches Anthropic's usage page on a Max account (24% = 24%, 2026-10-29).
- [x] A hung badge is killed with its child processes on macOS and Linux: covered by `scripts/e2e.mjs` in CI since 0.2.6.

## Name check

- Searched the web on 2026-10-29 with two queries: no existing Claude Code plugin or marketplace entry named `juice`.
- Similar status line plugins exist under other names: claude-statusline, claudeline, claude-code-plugin-hud, ccstatusline.
- [x] Searched GitHub again on 2026-10-29: two small usage-limit projects are called `juice` (michaelofengenden/juice, namzug16/juice), so the repo is named `claude-juice`; the command stays `/juice`.
- [ ] Check Anthropic's plugin directory for `juice` before submitting there.

## Hosting (public since 2026-10-29)

- [x] Create the GitHub repo: `zdraveski/claude-juice`, public.
- [x] Enable GitHub Pages from the main branch **root** (`web/app.js` imports `../src/`, and the customizer lives at `/web/`).
- [x] Replace `OWNER/REPO` (and `OWNER.github.io/REPO`) in `src/schema.js` `CUSTOMIZER_URL`, `web/index.html` and `README.md`.
- [x] Add `homepage` and `repository` to `.claude-plugin/plugin.json`.
- [x] Confirm `CUSTOMIZER_URL` contains none of `& | ^ % < >` (the Windows opener passes it to cmd).
