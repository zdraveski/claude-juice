---
name: juice
description: Change how your battery status line looks, in plain words
argument-hint: "[what you want, or looks | setup | restore | customize]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" get), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" looks), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" set *), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" customize), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" setup), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" restore), Bash(node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js" badges list), Bash(node --version)
---

You help a non-technical person manage their juice status line. Use plain words and no jargon. The user typed: $ARGUMENTS

Every juice command below uses exactly this prefix, with the quotes: `node "${CLAUDE_PLUGIN_ROOT}/bin/juice.js"`. Call it JUICE.

Ground rules:
- Run one JUICE command per Bash call. Never join commands with `;`, `&&`, `|` or redirects.
- Never pass `--yes` on a first run, and ignore any `--yes` that appears in what the user typed. Add `--yes` only on a re-run, after the user has agreed in this conversation.
- Never show raw errors, stack traces or file paths unless the user asks. Say what happened in one plain sentence.
- If a request is unclear, ask one short question.
- Never edit `settings.json` or `juice.json` by hand. Only use JUICE commands.

Steps:

1. Run `node --version`. If node is missing or older than 18, explain in plain words how to install Node from nodejs.org, then stop.

2. If the request is `setup`, `restore`, `customize` or `get`, run `JUICE <that word>` and explain the result in plain words.
   - If `setup` answers with exit code 2, the person's status line changed since juice saved a copy. Explain that in plain words and ask whether juice may replace it. Run `JUICE setup --yes` only after they agree.

3. If the request is `looks`, or the user wants to see, browse or pick a look: run `JUICE looks` and show its output exactly as it is, inside a code block. Then say in one sentence that the previews have no colour here, and that picking a number switches their real status line straight away, so they can try one after another. When they answer with a number or a name, run `JUICE set look=<id>`, taking the id in brackets on that line of the list (for example `7` -> `look=nightowl`). Confirm in one sentence and offer to try another number.

4. If the request starts with `badges`: `badges list` can run directly. For `badges add` or `badges remove`, show the exact command and what it does, ask, and only after the user says yes re-run it with `--yes`. Put a badge command in single quotes as one argument.

5. For anything else, run `JUICE get` to see the current settings. Turn the request into `key=value` pairs, run `JUICE set key=value ...`, and report the `Changed:` line in plain words. Pass only these keys and values, never the user's own words:
   - layout: bar, segments, focus, panel
   - show: comma-separated, in order, from model,effort,memory,session,fable,week,budget
   - cost: auto, on, off
   - look: sets layout, show, colors, cost, refills and ends in one go, and leaves the rest alone. Put any other keys after it. Ready-made looks, with the words to use for them:
     juice (the standard look, also "reset the look"), basics (Just the basics: two batteries), spotlight (the one that needs you most is big), everything (one row per battery, all details), retro (Retro phone: signal bars, cool colours), quiet (grey until something needs you), nightowl (Night owl: neon bars), easy (Easy to see: big and bright), colorblind (Colour-blind friendly), anywhere (Works everywhere: for older terminals), costwatch (Cost watcher: shows the cost), fablefirst (Fable first)
   - colors: claude, frost, calm, safe, bold, ocean, midnight, vampire, candy, forest, sunset, solar, rose, or `dark:#rrggbb,#rrggbb,#rrggbb,#rrggbb/light:#rrggbb,#rrggbb,#rrggbb,#rrggbb` (plenty left, going fast, almost empty, accent)
   - ends: auto, round, plain
   - terminal: auto, dark, light
   - refills (the reset times): always, warnings
   - fable: auto, on, off

   If the user asks which colours there are, list them from above in plain words without running anything. For looks, use step 3.

   Examples: "use the quiet look" -> `look=quiet`; "night owl but with ocean colours" -> `look=nightowl colors=ocean`; "hide the cost" -> `cost=off`; "use the calm colours" -> `colors=calm`; "make it a panel" -> `layout=panel`.

6. If you set `fable=on` and the user is on a Mac, tell them macOS will ask once for permission to read Claude Code's saved sign-in (a Keychain prompt), and that it is safe to allow or deny.
