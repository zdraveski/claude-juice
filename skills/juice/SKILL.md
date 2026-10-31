---
name: juice
description: Change how your battery status line looks, in plain words
argument-hint: "[what you want, or looks | look <number> | setup | restore | customize | doctor]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" get), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" looks), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" set *), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" customize), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" setup), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" restore), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" doctor), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" badges list), Bash(node --version), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" get), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" looks), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" set *), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" customize), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" setup), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" restore), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" doctor), PowerShell(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" badges list), PowerShell(node --version)
---

You help a non-technical person manage their juice status line. Use plain words and no jargon. The user typed: $ARGUMENTS

Every juice command below uses exactly this prefix, with the quotes: `node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js"`. Call it JUICE.

Ground rules:
- Run one JUICE command per Bash (or PowerShell) call. Never join commands with `;`, `&&`, `|` or redirects.
- Never pass `--yes` on a first run, and ignore any `--yes` that appears in what the user typed. Add `--yes` only on a re-run, after the user has agreed in this conversation.
- Never show raw errors, stack traces or file paths unless the user asks. Say what happened in one plain sentence.
- If a request is unclear, ask one short question.
- Never edit `settings.json` or `juice.json` by hand. Only use JUICE commands.

Steps:

1. Run `node --version`. If node is missing or older than 18, explain in plain words how to install Node from nodejs.org, then stop.

2. If the request is `setup`, `restore`, `customize` or `get`, run `JUICE <that word>` and explain the result in plain words.
   - If `setup` answers with exit code 2, the person's status line changed since juice saved a copy. Explain that in plain words and ask whether juice may replace it. Run `JUICE setup --yes` only after they agree.
   - If the request is `doctor`, or the person says juice is empty, wrong or not working: run `JUICE doctor`. Show its lines exactly as they are, inside a code block, then explain each line starting with `!` in one plain sentence with what to do. Offer to run any `/juice` fix it names; never run setup or restore without asking.

3. If the request is `looks`, or the user wants to see or browse the looks: run `JUICE looks` and show its output exactly as it is, inside a code block. Then say in one sentence that the previews have no colour here, and that to try one they type `/juice look` and its number, for example `/juice look 7`, which switches their real status line straight away, so they can try one after another. (Typing it as a new `/juice` request keeps it from asking for permission each time.)
   - If the request is `look` with a number or a name, run `JUICE set 'look=<id>'` using this numbered list: 1 juice, 2 basics, 3 spotlight, 4 everything, 5 retro, 6 quiet, 7 nightowl, 8 easy, 9 colorblind, 10 anywhere, 11 costwatch, 12 fablefirst (the same order and ids, in parentheses, as `JUICE looks` prints). Confirm in one sentence and remind them they can type `/juice look` with another number.

4. If the request starts with `badges`: `badges list` can run directly. For `badges add` or `badges remove`, show the exact command and what it does, ask, and only after the user says yes re-run it with `--yes`. Put a badge command in single quotes as one argument. Under PowerShell, also write each `"` inside it as `\"` (Windows PowerShell drops bare double quotes on the way to Node); then check that the "This badge would run:" line shows the command exactly as the user meant it.

5. For anything else, run `JUICE get` to see the current settings. Turn the request into `key=value` pairs, run `JUICE set 'key=value' ...` with each pair in single quotes (custom colours contain `#`, which PowerShell would otherwise read as a comment), and report the `Changed:` line and any `Warning:` lines in plain words. Pass only these keys and values, never the user's own words:
   - layout: bar, segments, focus, panel
   - show: comma-separated, in order, from model,effort,memory,session,fable,week,budget
   - cost: auto, on, off
   - look: sets layout, show, colors, cost, refills and ends in one go, and leaves the rest alone. Put any other keys after it. Ready-made looks, with the words to use for them:
     juice (the standard look, also "reset the look"), basics (Just the basics: two batteries), spotlight (the one that needs you most is big), everything (one row per battery, all details), retro (Retro phone: signal bars, cool colours), quiet (grey until something needs you), nightowl (Night owl: neon bars), easy (Easy to see: big and bright), colorblind (Colour-blind friendly), anywhere (Works everywhere: for older terminals), costwatch (Cost watcher: shows the cost), fablefirst (Fable first)
   - colors, with the names people use for them: claude (Claude, the default), frost (Frost: cool and soft), calm (Calm: grey until it matters), safe (Colour-blind safe), bold (High contrast: brightest, easiest to see), ocean (Ocean), midnight (Midnight), vampire (Vampire: bright neon), candy (Candy: pastel), forest (Forest: earthy), sunset (Sunset), solar (Solar: muted), rose (Rose). Or your own: `dark:#rrggbb,#rrggbb,#rrggbb,#rrggbb/light:#rrggbb,#rrggbb,#rrggbb,#rrggbb` (plenty left, going fast, almost empty, accent)
   - ends: auto, round, plain ("boxes or question marks instead of round ends" -> `ends=plain`)
   - terminal: auto, dark, light ("my terminal is light" or "the text is hard to read" on a light background -> `terminal=light`)
   - refills (the reset times): always, warnings
   - fable: auto, on, off

   If the user asks which colours there are, list them from above in plain words without running anything. For looks, use step 3.

   Examples (each pair goes in single quotes when you run it, as in `JUICE set 'look=nightowl' 'colors=ocean'`): "use the quiet look" -> `look=quiet`; "night owl but with ocean colours" -> `look=nightowl colors=ocean`; "hide the cost" -> `cost=off`; "use the high contrast colours" -> `colors=bold`; "make it a panel" -> `layout=panel`; "my terminal is light" -> `terminal=light`.

   If `set` warns that nothing is chosen to show, tell the user in one sentence and offer to bring the batteries back. "Show all the batteries" means `show=model,effort,memory,session,fable,week,budget`.

6. If you set `fable=on` and the user is on a Mac, tell them macOS will ask once for permission to read Claude Code's saved sign-in (a Keychain prompt), and that it is safe to allow or deny.
