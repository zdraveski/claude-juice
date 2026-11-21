# Contributing

Thanks for helping.

## The basics

- juice is plain Node.js (24 or newer) with no dependencies. There is nothing to install. Please don't add one: a change that needs a package gets sent back.
- `main` is what everyone installs: the plugin store serves it straight away. Work on a branch and open a pull request. Changes reach `main` only through a pull request whose checks pass.
- Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
- Tests: `node --test`, then `node scripts/e2e.mjs` (end to end, in a throwaway home). GitHub runs both on Windows, macOS and Linux with Node 24 and 26 for every branch, and a pull request needs them green.
- Before a release, also run `node scripts/bench.js` (speed: juice may add at most 75 ms) and `node scripts/check-customizer.js` (the web customizer, needs Playwright). The full list is in [docs/release/checklist.md](docs/release/checklist.md).

## Never touch your real Claude folder while testing

The status line writes to your Claude folder, and a refresh run from a copy of the code points your real status line at that copy. Always set `CLAUDE_CONFIG_DIR` to a throwaway folder:

```sh
export CLAUDE_CONFIG_DIR="$(mktemp -d)"
node bin/juice.js looks          # every look, drawn with sample numbers
rm -rf "$CLAUDE_CONFIG_DIR"
```

The tests already do this. (The `now+…` reset times in `test/fixtures/` are filled in by the tests, so piping a fixture into the status line by hand prints a meaningless reset time.)

## Where things are

| Folder | What is in it |
|---|---|
| `bin/` | The status line, the `/juice` command, and the launcher that setup copies into your Claude folder |
| `src/` | Reading Claude Code's data, settings, setup, the doctor, badges and the Fable battery |
| `src/render/` | Drawing: layouts, colours, fitting a narrow window |
| `skills/juice/` | The `/juice` instructions Claude follows |
| `web/` | The live customizer (GitHub Pages) |
| `scripts/` | End-to-end test, speed check, customizer check, and the picture scripts in `scripts/pictures/` |
| `test/` | Tests, with sample status-line input in `test/fixtures/` |
| `docs/` | The pages the README links to (guide, commands, FAQ, troubleshooting, privacy, badges), its pictures in `docs/images/`, and maintainer notes: the release checklist in `docs/release/`, designs and plans in `docs/superpowers/` |

## Pictures

The README and guide pictures in `docs/images/` are drawn by scripts with juice's own renderer, each in a light and a dark version. Run these from the repo root. They need Playwright (`npm i -g playwright`), ffmpeg and the network (for Google Fonts).

| Script | Draws |
|---|---|
| `node scripts/pictures/hero-features.mjs` | `hero.png`, `hero-*`, `looks-grid-*` and `social.png` |
| `node scripts/pictures/before-after.mjs` | `before-after-*` |
| `node scripts/pictures/readme.mjs` | `anatomy-*`, `colours-*`, `looks-*` and `colour-sets-*` |
| `node scripts/pictures/customizer.mjs` | `customizer.gif` |

Run them again after you change `src/schema.js` or anything in `src/render/`, so the pictures match the code.

## Writing for juice

juice is for people who don't code. Anything they read (status line, `/juice` replies, the README and its pages in `docs/`) uses plain words without jargon and says what to do next. Record what changed for them in [CHANGELOG.md](CHANGELOG.md).
