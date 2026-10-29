# Manual checklist (inside Claude Code)

- [ ] `/plugin marketplace add <path-to-this-repo>` then `/plugin install juice@juice` succeeds.
- [ ] Typing `/juice` resolves to this plugin's skill (shows as `juice:juice` or `juice`).
- [ ] `${CLAUDE_PLUGIN_ROOT}` is expanded in the Bash call and runs without a permission prompt.
- [ ] `/juice setup` shows the status line, and the old entry is in `juice-backup.json`.
- [ ] `/juice make it the panel layout` sets `layout: 'panel'` in `juice.json` and the status line changes.
- [ ] `/juice restore` brings the previous status line back.
- [ ] When `setup` answers exit 2, `/juice` explains it and asks before running `setup --yes`.
- [ ] `/juice badges add ...` shows the exact command and waits for a yes.
- [ ] `badges add` triggers Claude Code's own permission prompt.
- [ ] On macOS, the Keychain prompt for Fable appears only after `fable=on`.
- [ ] On macOS and Linux, a hung badge command is killed with its child processes after 2 seconds (check that no stray processes are left).
- [ ] In the web customizer, drag-and-drop reorder and both Copy buttons work.
- [ ] On a Max account, the Fable battery appears and matches claude.ai's usage page.
- [ ] The status line works on Node 18 and Node 20.
- [ ] `node scripts/check-customizer.js` passes all six browser checks (needs Playwright: `npm i -g playwright`).
- [ ] `node scripts/bench.js` prints OK: juice adds at most 75 ms to Node starting (56 ms on a 2011 i5, 2026-10-29).
- [ ] Bump `version` in `.claude-plugin/plugin.json` and `package.json` together on every release (Claude Code uses plugin.json's version to detect updates).

# Terminal matrix (KIRE, needs real terminals)

For each, check dark and light: "rounded ends OK" and "truecolor OK". Save no screenshots.

- [ ] VS Code on Windows: dark / light, rounded ends OK / truecolor OK
- [ ] VS Code on macOS: dark / light, rounded ends OK / truecolor OK
- [ ] Windows Terminal: dark / light, rounded ends OK / truecolor OK
- [ ] iTerm2: dark / light, rounded ends OK / truecolor OK
- [ ] macOS Terminal: dark / light, rounded ends OK / truecolor OK
- [ ] One Linux terminal (name it here): dark / light, rounded ends OK / truecolor OK

# Name check

- Searched the web on 2026-10-29 with two queries: no existing Claude Code plugin or marketplace entry named `juice`.
- Similar status line plugins exist under other names: claude-statusline, claudeline, claude-code-plugin-hud, ccstatusline.
- [x] Searched GitHub again on 2026-10-29: two small usage-limit projects are called `juice` (michaelofengenden/juice, namzug16/juice), so the repo is named `claude-juice`; the command stays `/juice`.
- [ ] Check Anthropic's plugin directory for `juice` before submitting there.

# Hosting (public since 2026-10-29)

- [x] Create the GitHub repo: `zdraveski/claude-juice`, public.
- [x] Enable GitHub Pages from the main branch **root** (`web/app.js` imports `../src/`, and the customizer lives at `/web/`).
- [x] Replace `OWNER/REPO` (and `OWNER.github.io/REPO`) in `src/schema.js` `CUSTOMIZER_URL`, `web/index.html` and `README.md`.
- [x] Add `homepage` and `repository` to `.claude-plugin/plugin.json`.
- [x] Confirm `CUSTOMIZER_URL` contains none of `& | ^ % < >` (the Windows opener passes it to cmd).
