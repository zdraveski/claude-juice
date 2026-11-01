# Contributing

Thanks for helping.

## The basics

- juice is plain Node.js (18 or newer) with no dependencies. There is nothing to install.
- `main` is what everyone installs: the plugin store serves it straight away. Work on a branch and open a pull request. Changes reach `main` only through a pull request whose checks pass.
- Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
- Tests: `node --test`. GitHub runs them on Windows, macOS and Linux with Node 18, 22 and 24 for every branch.
- Before a release, also run `node scripts/e2e.mjs` (end to end), `node scripts/bench.js` (speed: juice may add at most 75 ms) and `node scripts/check-customizer.js` (the web customizer, needs Playwright). The full list is in [docs/release/checklist.md](docs/release/checklist.md).

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
| `test/` | Tests, with sample status-line input in `test/fixtures/` |

## Writing for juice

juice is for people who don't code. Anything they read (status line, `/juice` replies, README) uses plain words without jargon and says what to do next. Record what changed for them in [CHANGELOG.md](CHANGELOG.md).
