# What's new in juice

To update, type `/plugin`, update juice, then restart Claude Code.

## 1.5.0 (2026-11-22)

[Changes since 1.4.3](https://github.com/zdraveski/claude-juice/compare/v1.4.3...v1.5.0)

New:
- A new look, Sand: batteries that fill like an hourglass, in bold colours. `/juice look sand` also switches the battery style to sand, and picking any other look puts it back to Glossy.
- The customizer page is easier to use: on a phone the "What to show" rows and the colour and look cards are compact, the live preview stays at the top with its options folded away, and "Climbing" is now called "Animated" (the command is still `motion=on`).
- A new colour set, Terminal: `/juice set colors=terminal` draws in your terminal's own 16 colours, so if you changed your terminal's colour scheme, juice follows it. Green is plenty left, yellow is going fast, red is almost empty, cyan is the model name and Fable is magenta. juice can't promise these read well, since that depends on your scheme.

Fixed:
- With `colors=terminal` on a light terminal, the words on plain green and yellow batteries are now black, so you can read them.

## 1.4.3 (2026-11-21)

[Changes since 1.4.2](https://github.com/zdraveski/claude-juice/compare/v1.4.2...v1.4.3)

New:
- `/juice set truecolor=on` gives full colour where juice can't tell your terminal draws it, such as over `ssh` or `sudo`, which drop the note that says so. `truecolor=off` keeps 256 colours for a terminal that can't. `/juice doctor` suggests it when it sees 256 colours.

Changed:
- Badge commands now see only the basic environment variables a shell needs (`PATH`, your home and temp folders, the language and the like), not every key and token your terminal holds, such as `ANTHROPIC_API_KEY` or `GITHUB_TOKEN`. Proxy addresses stay out too, since they can hold a password. A badge that needs one gets it by name: `/juice badges add '<command>' --env HTTPS_PROXY,AWS_PROFILE`. `/juice badges list` shows the names a badge can see. If one of your badges stops working after the update, add it again with the `--env` it needs.

## 1.4.2 (2026-11-21)

[Changes since 1.4.1](https://github.com/zdraveski/claude-juice/compare/v1.4.1...v1.4.2)

Fixed:
- After you switch accounts, a new chat no longer pushes Weekly down (for example from 40% to 22%). juice shows the highest number any open chat has sent for that week.
- At the moment a limit resets, juice no longer shows it refilled a few seconds before Anthropic does.
- Removing your last badge now deletes the badge outputs and the copy of the status line details badges read. Before, they stayed in `juice-cache/badges` for good.

## 1.4.1 (2026-11-16)

[Changes since 1.4.0](https://github.com/zdraveski/claude-juice/compare/v1.4.0...v1.4.1)

Changed:
- When juice shows the cost, it now works it out in a few milliseconds instead of about 40.
- In a narrow window, a red battery first drops the reset time beside its run-out time, so it reads `Session 93% !! runs out ~2:33 PM` rather than `Session 93%!! out ~2:33 PM`.
- When your Claude login has expired, juice no longer sends it. Claude Code renews it on your next message, and juice looks again 5 minutes later.
- `/juice doctor` says why the last Fable check failed: the login was refused, it had expired, Anthropic was busy, the login changed, or you were offline. Only a refused login gets "type /login".
- Colour-blind safe is now blue, amber, red and pink-purple, picked so every kind of colour blindness tells them apart. On a light terminal, two of its colours looked the same to some people.
- High contrast is now the easiest set to read on both backgrounds. Claude's light accent is a little darker and Solar's dark red a little lighter, so every colour of every set reads at 4.5:1 or more.
- `/juice set` says when one of your own colours is hard to read on its terminal (under 4.5:1), and still saves it. The customizer says "A little faint" for those. `Dark:` and `LIGHT:` work as well as `dark:`.
- The customizer works on a phone: the preview stays in view and keeps its batteries, the preview options fold away, and every control is big enough to tap. Switches, buttons and look cards stand out from the page, it follows Windows' high-contrast colours, and the keyboard can skip straight to the options.

Fixed:
- If you said no to the Fable battery, a mistyped or broken `juice.json` (a trailing comma, `"Off"`, a locked file) no longer turns the login read back on. The Fable battery stays off until the file is fixed.
- On a Mac, the Keychain question now waits 25 seconds for your answer instead of closing after 3. juice also reads a Keychain login macOS prints as hex, and finds the login in `.credentials.json` when the Keychain has none.
- Windows PowerShell 5.1 could pipe in a hidden mark (a BOM) that left the line blank.
- A saved reset time could be read 1000 times too far away, so it never ended.
- `/juice badges list` and `remove` hide the whole value of a key typed before a command, however it is quoted or escaped, including `$(...)` and `${...}`.
- Adding a badge that is already there adds no second copy. A badge copied over in `juice.json` from another computer is approved where it stands when you add it again. `/juice badges list` now says to do that, instead of removing it first, and marks a copy 1.4.0 left beside an approved badge so you can remove it.
- A program a badge leaves running in the background is stopped (Linux and macOS). The project folder and chat path handed to badges are deleted once read.
- A `juice.json` that holds something other than settings, like `[]`, is left alone instead of replaced by `/juice set`.
- `/juice setup` takes your status line as unchanged when only the order of its settings differs, and names the copy it sets aside. `/juice set` takes names in any case.
- In a pane under 26 columns, a panel shows `Session 88%!!` instead of `Session …`. When only one battery fits, it is the one that blocks you first, not the first in your order.
- The "batteries appear after Claude's first reply" hint no longer shows when no battery is chosen.
- Words now read at 4.5:1 or more wherever juice draws them: numbers in a battery and words in a capsule (some were down to 2.5:1), and white text on a fill in four light sets (Claude, Calm, Vampire, Forest). The pace tick on a glossy battery no longer fades into its casing.
- On a 256-colour terminal, words never read worse than in full colour, on the background or on a fill. Claude's red fell to 3.7:1 there on a light terminal.
- A badge like `git branch` shows the repo Claude Code is in, not the folder juice runs from.
- On Linux and macOS, a Claude folder with a backslash in its name no longer leaves the line blank. If yours was blank, type `/juice setup` once after updating.
- `/juice doctor`'s report shortens a folder to `~` only when it is really your home folder (`/rootfs/x` showed as `~fs/x`), and hides your home folder even when it is quoted or ends in a slash. A home at a drive's root (`C:\`) no longer turns every folder on that drive into `~`.
- If `/juice setup` can't save your settings, or its copy of your old status line, it leaves the launcher as it was.
- On a Mac, a slow answer to the Keychain question no longer lets a second Fable check start and ask again.
- Cutting a line or a badge at the window's edge never splits a flag, a joined emoji or a letter from its accent.
- After an error, the line juice shows stays on one row inside the window.
- More wide characters (Tangut, Kana supplement, small form variants) count as two columns, so the line doesn't spill.
- Temp files left by a refresh that was stopped are now cleared after every update, and `/juice customize` opens without a window flashing up on Windows.
- Badge cache files are named with SHA-256, which clears a GitHub security alert. Old ones are ignored and cleared after 7 days.

## 1.4.0 (2026-11-15)

[Changes since 1.3.1](https://github.com/zdraveski/claude-juice/compare/v1.3.1...v1.4.0)

Changed:
- The batteries and the effort level now stand still, and the line refreshes once a minute. The climb needed a refresh every second, which cost about a sixth of a CPU core for every open Claude Code window. Type `/juice set motion=on` to bring the climb back.
- After the update, juice moves the 1-second refresh it wrote for 1.3.x to once a minute by itself, once. It can't tell its own 1 or 30 from one you typed, so those move too; `/juice set motion=on` puts the 1 back.
- `/juice setup` now asks before juice reads your Claude login for the Fable battery. If the Fable battery already showed on your Windows or Linux computer, it stays on.
- When juice can't draw the line, it shows `juice: /juice doctor` after the model name, so you know where to look. It goes away on the next run that works.
- `/juice badges list` shows only the first word of each command, so a key inside a command doesn't land in the chat. `/juice badges list --show` shows the whole commands and asks first. Don't put passwords or API keys in a badge command.

Fixed:
- The status line keeps following juice updates when your plugins folder is a link (a symlink or a Windows junction). If yours stopped following them, `/juice doctor` says so; type `/juice setup`.
- A broken juice folder shows `juice: /juice doctor` instead of a blank line.
- After juice is uninstalled, the line says what you can do: install it again and type `/juice restore`, or delete the `statusLine` entry in `settings.json`.
- A window signed into another Claude account shows its own Session and Weekly numbers, not the other account's.
- A badge whose command fails keeps its last text for 5 minutes, then shows nothing, so an old branch name never passes for the current one.
- Badge text and model names can't send terminal codes (like clipboard writes or title changes) or hidden direction marks that reorder the line.
- When several Claude Code windows draw at the same moment, only one starts a background refresh, so your login goes to Anthropic once and a badge command runs once.
- If juice can't save its Fable or badge cache, it waits (15 minutes for Fable, 5 for badges) instead of trying again every few seconds.
- The status line no longer hangs if Claude Code never finishes sending to it, and a file juice can't write no longer holds up every refresh for seconds.
- On Mac and Linux, juice's cache folders, which hold the copy of Claude Code's data that badges read, can only be read by you. Folders from an older juice change on the first refresh after the update.
- A wrong `/juice set` value lists the values that work, and an error saving a file is a plain sentence. Other errors hide your home folder. A `settings.json` juice isn't allowed to read is no longer called missing or one with a mistake in it, and a `juice.json` juice isn't allowed to read is no longer taken for a missing one or one to delete.
- A clock that was set ahead when you installed or updated juice or ran `/juice setup` no longer skips, or repeats on every refresh, the changes juice makes once after an update, like moving the every-second refresh to once a minute.
- `/juice doctor` says Node 24 or newer everywhere, says it's juice (not Claude Code) that can't read a `settings.json` with comments, and says `/juice setup` fixes a changed marketplace name.
- 100% used with no reset time says "used up", not "almost empty".
- A cost under a cent shows "<$0.01", and big costs get thousands separators.
- A reset time sent in milliseconds is no longer drawn months away.
- Fuel tank in a very narrow window never shows a "4%" that has lost its "left".
- With no colour, rounded ends become plain ones instead of stray symbols, and an odd `COLUMNS` value no longer shrinks the line.
- juice reads Claude Code's theme only when your `terminal` setting is automatic.
- The customizer: a screen reader reads the preview as words, each Copy button says what it copies, nothing scrolls sideways at 320 px, the window title is easier to read, the Fable row says the page can't turn on reading your login, and the page can load only its own files.
- The README says the Fable battery needs Node 24 or newer behind a proxy too, that the proxy carries juice's connection to Anthropic, and that the usage address juice reads isn't a documented API. `/juice` has clearer steps when setup fails or you type just `/juice`.
- Smaller: an oversized reset time from Anthropic is refused, leftover temporary files are cleaned up, and the badge example in the help works on every system.

Known limits:
- With `motion=on`, a refresh between climb steps (after a reply, or with a refresh time you chose) can show the picture part-way up. The number beside it is always right.
- On Windows, setup writes plain `node`, so a Node that only your shell profile puts on PATH (nvm-windows, fnm, volta) isn't found.
- Setup uses whichever Node comes first on PATH without checking its version, and `/juice doctor` checks the Node of the shell it runs in, which may not be the one the line uses.
- juice can't tell its own refresh time of 1 or 30 seconds from one you typed (see above).
- A Claude folder whose path holds `$`, a backtick, `%` or `"` can't use juice; setup says so.
- The once-per-update refresh move isn't tried again if `settings.json` was busy (`/juice doctor` says to type `/juice setup`). It rewrites `settings.json` whole, so a Claude Code change in the same instant could be lost.
- A `settings.json` that is a link to a missing file becomes a normal file when juice writes it.
- A clock that was slow when juice updated and was put right before the status line next refreshed (it synced in between) skips the changes juice makes once after that update. The next update makes them.
- A test version folder (like `1.4.0-beta`) counts the same as the release.
- WSL and Windows sharing one `settings.json` each write their own command.
- `/juice` can change any setting without a permission prompt, `fable=on` included.
- Two windows saving at once can drop each other's last-seen numbers until the next refresh, and two windows of the same chat swap them on every refresh.
- Times are always 12-hour, and on a computer set to UTC every time says "UTC".
- Some emoji sequences, skin tones and accents count wider than they draw, so the line may end a little early.

## 1.3.1 (2026-11-07)

[Changes since 1.3.0](https://github.com/zdraveski/claude-juice/compare/v1.3.0...v1.3.1)

Changed:
- The effort level and the batteries move much faster: one step every 2 seconds instead of every 30, and they start again together every 12 seconds instead of every 3½ minutes, so they no longer sit still for minutes and look stuck. juice now refreshes every second, twice a step, so no step is skipped; run `/juice setup` once after updating (`/juice doctor` reminds you). A refresh time you chose yourself is kept, except juice's own old 60 and 30 seconds.

## 1.3.0 (2026-11-07)

[Changes since 1.2.2](https://github.com/zdraveski/claude-juice/compare/v1.2.2...v1.3.0)

Added:
- The effort level moves: on your status line its staircase climbs up to your level, one step every 30 seconds, holds there, then starts again. The word beside it always says the level. When a narrow window hides the word, the staircase stands still, so the level can still be read.
- The batteries move too: Memory, Session, Fable, Weekly and Budget fill in four steps, one every 30 seconds, from a quarter of the way up to the real amount, then hold. They start again together with the effort level every 3½ minutes. Fuel tank fills up to what is left. Only the picture moves: the percentage, the warning marks and the times stay put and always say the real amount. A red battery stands still, and the even-pace tick only shows once the picture is full, so it never says "behind" while it climbs. Previews and `/juice looks` show everything still.

Changed:
- juice refreshes every 30 seconds instead of once a minute, so the pictures keep moving while Claude Code is idle. Run `/juice setup` once after updating to switch an existing install (`/juice doctor` reminds you); a refresh time other than juice's old 60 seconds is kept.

## 1.2.2 (2026-11-07)

[Changes since 1.2.1](https://github.com/zdraveski/claude-juice/compare/v1.2.1...v1.2.2)

Changed:
- An amber battery that is on track to run out before it resets now says when, as a red one already did: "runs out ~Sat 2:12 PM · resets Mon 3:32 AM". It waits until a tenth of the limit's time has passed (about 17 hours of a week), so a busy first morning doesn't predict a run-out days away. When the line is too wide, that time is the first thing to go after the battery size, and a narrow window keeps the reset time instead.
- The battery that needs you most is now an amber one that will run out, ahead of one that lasts until it resets: first when batteries move by need, in the Tightest first spotlight, and for the one time Capsules and Fuel tank show in a narrow window.

## 1.2.1 (2026-11-07)

[Changes since 1.2.0](https://github.com/zdraveski/claude-juice/compare/v1.2.0...v1.2.1)

Changed:
- juice now supports the two newest long-term Node versions, 24 and 26. On an older Node the line still draws, but `/juice doctor` says to update Node from nodejs.org.
- A setting juice doesn't know, like a shape from a newer juice, now says how to update juice instead of only "isn't valid".
- Shapes light a cell only when more than half of it is used, so 50% no longer looks over half: the slider's knob sits just left of the middle, and Lives shows 2 hearts of 5.

Fixed:
- With no colour and plain ends, the line no longer starts with a stray space before the model name.
- A badge with an emoji like ❤️ is counted two columns wide, as terminals draw it, so the line never runs past the edge.
- The customizer's battery style row wraps properly in older browsers.

## 1.2.0 (2026-11-07)

[Changes since 1.1.1](https://github.com/zdraveski/claude-juice/compare/v1.1.1...v1.2.0)

New:
- **Eight shapes instead of a battery.** Pie, Sand, Slider, Pace race, Lives, Dots, Chevrons and Ruler. They show in Status bar and Tightest first, with the number after the shape, and read without colour too. `/juice set battery=slider` (or any of them), or pick one in the customizer.
- When a look or `layout=` moves the style you picked to a layout that draws its own shapes, juice now says the style won't show there.

Fixed:
- The Outline style was counted one column too wide, so a narrow window squeezed the line a little early.

## 1.1.1 (2026-11-07)

[Changes since 1.1.0](https://github.com/zdraveski/claude-juice/compare/v1.1.0...v1.1.1)

Fixed:
- `/juice set battery=` in a layout that keeps its own shapes (Classic segments, Panel, Capsules, Fuel tank) now says the style only shows in Status bar and Tightest first, instead of seeming to do nothing. The customizer page says the same under Battery style.

## 1.1.0 (2026-11-07)

[Changes since 1.0.2](https://github.com/zdraveski/claude-juice/compare/v1.0.2...v1.1.0)

New:
- **Two new layouts.** Capsules: each battery a rounded capsule that fills with colour when it needs you. Fuel tank: shows what is left instead of what is used.
- **Two new looks** that use them: Capsule (Candy colours) and Road trip (Forest colours). `/juice look 13` and `/juice look 14`.
- **A new chat says what's coming.** Until Claude's first reply, the line reads "batteries appear after Claude's first reply" instead of looking broken.
- **Battery order.** The batteries keep your order, as before. If you like, they can move instead: the one that needs you first, or the fullest first. The customizer page has the same choice.
- **A new look by default.** Glossy batteries in tinted glass, the model name on a small tag, effort steps that warm up as they climb, and quiet dividers between items. `/juice set battery=classic` brings the old bars back.
- **Battery style.** Glossy, Classic, Outline, Hot tip (heats up only when amber or red), Liquid edge and Pace glow. `/juice set battery=` and the style, or pick one in the customizer.

Fixed:
- In a window narrower than one battery's words, the cut keeps its name, number and warning ("Week 50% left!") instead of cutting through them.

## 1.0.2 (2026-10-31)

[Changes since 1.0.1](https://github.com/zdraveski/claude-juice/compare/v1.0.1...v1.0.2)

- In a narrow window a red battery's "out ~2:44 PM" words now go before the battery itself. In the Everything look, red rows keep their numbers.
- 99.5% to 99.9% shows as 99%, not as a used-up 100%.
- `/juice set` and badges change only what you asked for: a setting from a newer juice, still open in another window, is kept.
- A status line set up by juice before 0.2.1 is brought up to date on its own (the old one could run another plugin named juice).
- Behind a company proxy, the Fable battery works with Node 24 or newer (22.21 or newer on Node 22), and `/juice doctor` says so.
- `/juice doctor` names a project's settings file from where you are, so it never shows the folders above it.
- Setup handles an empty settings file and a Claude folder given as a relative path, and says plainly what it changed.
- The launcher never mistakes a folder Claude Code named by code version for a newer juice.

## 1.0.1 (2026-10-31)

[Changes since 1.0.0](https://github.com/zdraveski/claude-juice/compare/v1.0.0...v1.0.1)

- `/juice setup` tells you when it switches your status line to a different copy of juice. Before, it said "Nothing changed" even when it had.
- `/juice setup` clears the problem `/juice doctor` reported, so the warning only comes back if the problem does.

## 1.0.0 (2026-10-31)

New:
- `/juice doctor` checks what juice sees and tells you in plain words. Each line is fine (✓), needs you (!) with what to do, or just for your information (·). It never shows your user name, so you can paste it into a bug report.
- Reset times say the day and time when a limit resets more than a day from now: "resets Sat 7:20 PM", "resets next Wed 2:19 PM" a week out, a date further away. Under a day it still counts down ("resets in 2h 10m"). Days are counted on the calendar, so daylight saving never shifts them.
- Times on a computer set to UTC (a server or container) say "UTC".
- A red battery that runs out on another day says which day the same way: "runs out ~Thu 9:15 AM".

Fixed:
- A red battery is never cut to something like "Week 9…" in a narrow window.
- A used-up Budget always shows, like Session, Weekly and Fable.
- `/juice get` no longer shows your badge commands, which can hold a key.
- `/juice restore` handles a damaged saved copy instead of crashing.
- The customizer: a chosen terminal colour wins over the preview switch, and a link without settings in it no longer wipes the ones you saved.
- The status line starts faster.

## 0.2.6 (2026-10-31)

- A used-up limit (100%) always shows, even in looks that leave it out.
- In a narrow window, amber batteries go before red ones, and what's left always keeps the battery's name and number.
- `/juice restore` never removes a status line that only runs juice from inside another script.
- On a Mac or Linux, the status line keeps working after Node is upgraded.
- `/juice setup` refuses a Claude Code folder whose name would break the status line, before changing anything.
- Setup says the batteries fill in after Claude's first reply, and explains a line that was told to show nothing.

## 0.2.5 (2026-10-31)

- Badges only run if you approved them on this computer. A copied or hand-edited settings file can't make juice run anything.
- Batteries judge early use by pace: 84% used 24 minutes into a window is red.
- Spotlight picks the red battery that runs out first.
- A very small window never gets a line wider than itself.
- Several fixes so an idle or old window never overwrites newer numbers, including after `/login` switches accounts.

## 0.2.4 (2026-10-31)

- `/juice look` with a number picks a look.
- The customizer page has a Terminal colour choice.
- Setup warns when a project's own settings hide the status line.
- `NO_COLOR` gives plain text. A light terminal is detected under Claude's "auto" theme.
- Resumed chats keep their batteries, and a cost of $0.00 is never shown.
- On a Mac, juice reads the right sign-in when you use more than one Claude Code folder.
- The README covers troubleshooting, narrow windows, updating, undoing and uninstalling.

## 0.2.3 (2026-10-31)

- A narrow window keeps the model name and as much detail as fits.
- A red Fable battery says when it runs out.
- Day countdowns round the hours instead of cutting them.
- Grey text is easier to read, in the status line and on the customizer page.
- A badge that leaves a helper program running can't hold up the status line.

## 0.2.2 (2026-10-31)

- Only Claude subscribers get a Fable battery.
- Removing a badge asks first, like adding one.
- Your settings and badges are never reset because a settings file couldn't be read.
- A private settings file stays private when juice rewrites it.
- Restore with no saved copy removes juice instead of getting stuck.
- An uninstalled juice stops running.

## 0.2.1 (2026-10-31)

- A computer clock that ran ahead no longer freezes the Fable and badge updates.
- A Fable model named like "Fable 5.1" still counts.
- juice never runs another plugin that happens to be called juice.

## 0.2.0 (2026-10-31)

- Red batteries say when they run out at this pace: "runs out ~4:04 PM · resets in 2h 10m".
- A thin mark on Session, Weekly and Fable shows where an even pace would be, so going too fast is visible without colour.
- A battery turns amber on pace alone; red needs 90% used, or half used and on track to run out.
- Windows Terminal gets full colour.
- A removed badge never shows its text in another's place.

## 0.1.0 (2026-10-29)

First release: a battery-style status line for Claude Code that shows how much of your usage you have used and when it resets. It comes with twelve ready-made looks, thirteen colour sets, the plain-words `/juice` command and a web customizer with a live preview.
