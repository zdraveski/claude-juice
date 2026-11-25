# Changelog

This page lists what changed in each version of juice, newest first.

To update, type `/plugin`, update juice, then restart Claude Code.

## Unreleased

Tidier code behind the numbers juice remembers between redraws, and behind when the Fable battery tries again after a failed check. Nothing you see changes.

## 1.5.5 (2026-11-25)

[Changes since 1.5.4](https://github.com/zdraveski/claude-juice/compare/v1.5.4...v1.5.5)

One fix for a `juice.json` juice can't open, and tidier code behind `/juice set`, badges and the customizer.

### Changed

- **Saving settings:** `/juice set` and adding or removing a badge now read `juice.json` once instead of two or three times, so a save from another window in between can't be missed.

### Fixed

- **A juice.json juice can't open:** when `juice.json` fails to open for a reason juice doesn't know (another program holding it, a folder in its place), juice now says it isn't allowed to read it, instead of calling it unreadable and suggesting you delete it. Your settings and badges in it are never overwritten either way.

## 1.5.4 (2026-11-25)

[Changes since 1.5.3](https://github.com/zdraveski/claude-juice/compare/v1.5.3...v1.5.4)

One fix in setup, and tidier code behind setup and the doctor.

### Fixed

- **Setup over a status line that isn't valid:** when `settings.json` held a status line Claude Code can't use (plain text, say), setup said it saved it "so you can get it back", but `/juice restore` never puts such a line back. Setup now says so, and still keeps it in `juice-backup.json`.

## 1.5.3 (2026-11-24)

[Changes since 1.5.2](https://github.com/zdraveski/claude-juice/compare/v1.5.2...v1.5.3)

A smaller install, and one fix in the doctor.

### Changed

- **Smaller install:** juice now installs only the files it runs, about 280 KB instead of 3.5 MB. Its tests, scripts and pictures stay on GitHub.

### Fixed

- **Doctor on a Mac:** after a denied Keychain read, its advice now names the right file to delete, `fable.json` in the `juice-cache` folder. It said `fable-cache.json`, which doesn't exist.

## 1.5.2 (2026-11-24)

[Changes since 1.5.1](https://github.com/zdraveski/claude-juice/compare/v1.5.1...v1.5.2)

Tidier code inside juice. What you see stays the same, apart from two small fixes.

### Changed

- **Motion warning:** a wrong `motion` value now lists the choices as `off, on`, in the same order as the customizer's buttons.
- **Customizer:** its buttons now come straight from juice's settings rules, so a new choice shows up on the page by itself. They look the same as before.

### Fixed

- **Badge list:** a badge saved with an empty list of extra variables no longer shows "(also sees )".

## 1.5.1 (2026-11-24)

[Changes since 1.5.0](https://github.com/zdraveski/claude-juice/compare/v1.5.0...v1.5.1)

Bug fixes for badges on Windows, the Mac Keychain and settings safety.

### Security

- **Badges on Windows:** a badge no longer runs a program of the same name from the project folder, so a `git.bat` in a cloned repo cannot take the place of git. Stopping a stuck badge runs Windows' own `taskkill`, never one from the project folder.
- **Saved badge outputs:** removing a badge now deletes the saved badge outputs at once, even when other badges stay, since they hold the command text.
- **Hostile settings files:** warnings that quote a value from a file are cut to one short line, so a hostile `juice.json` cannot push text into Claude's context.

### Fixed

- **Battery times:** a reset time of zero or below is unknown, not a window that already ended.
- **Batteries without colour:** with `colors=terminal`, an unlit battery segment differs from the casing by shape, so it shows without colour.
- **Badge settings:** adding or removing a badge keeps entries juice cannot read and any extra fields in `juice.json`, instead of dropping them.
- **Badge refresh:** badges refresh again after 6 seconds.
- **Unreadable lock file:** a lock file that cannot be read no longer loses the drawn line. A badge that fails to load costs only the badges.
- **Mac Keychain:** a refused Keychain read is told apart from a missing login. juice backs off for about 12 hours instead of asking again, and `/juice doctor` says access was denied and how to retry sooner.
- **Empty settings file:** an empty `juice.json` is treated as missing, so `/juice set` works and Fable is not switched off.
- **Symlinked settings:** settings written through a symlink keep the link.
- **Damaged backup:** a saved status line backup that is damaged is never written into `settings.json`.
- **Help command:** `juice help`, `--help` and `-h` print the usage.
- **Saved errors:** the saved error hides whole paths, even folders with spaces, and a run that works clears the error an earlier run left.
- **Docs:** the colour set count is 14, and the "last tested" line says when it was tested. The notes on `show`, `--env`, Windows badges, Keychain denial and quotes in badge commands are corrected.

## 1.5.0 (2026-11-22)

[Changes since 1.4.3](https://github.com/zdraveski/claude-juice/compare/v1.4.3...v1.5.0)

A new Sand look, a Terminal colour set and an easier customizer on a phone.

### New

- **Sand look:** batteries that fill like an hourglass, in bold colours. `/juice look sand` also switches the battery style to sand, and picking any other look puts it back to Glossy.
- **Terminal colour set:** `/juice set colors=terminal` draws in your terminal's own 16 colours, so if you changed your terminal's colour scheme, juice follows it. Green is plenty left, yellow is going fast, red is almost empty, cyan is the model name and Fable is magenta. juice can't promise these read well, since that depends on your scheme.
- **Easier customizer on a phone:** the "What to show" rows and the colour and look cards are compact, and the live preview stays at the top with its options folded away.
- **Animated renamed:** "Climbing" is now called "Animated" in the customizer. The command is still `motion=on`.

### Fixed

- **Terminal colours on light terminals:** with `colors=terminal` on a light terminal, the words on plain green and yellow batteries are now black, so you can read them.

## 1.4.3 (2026-11-21)

[Changes since 1.4.2](https://github.com/zdraveski/claude-juice/compare/v1.4.2...v1.4.3)

Full colour over `ssh`, and badge commands no longer see your keys and tokens.

### New

- **Full colour switch:** `/juice set truecolor=on` gives full colour where juice can't tell your terminal draws it, such as over `ssh` or `sudo`, which drop the note that says so. `truecolor=off` keeps 256 colours for a terminal that can't. `/juice doctor` suggests it when it sees 256 colours.

### Security

- **Badge environment:** badge commands now see only the basic environment variables a shell needs (`PATH`, your home and temp folders, the language and the like), not every key and token your terminal holds, such as `ANTHROPIC_API_KEY` or `GITHUB_TOKEN`. Proxy addresses stay out too, since they can hold a password.
- **Passing a variable to a badge:** a badge that needs one gets it by name: `/juice badges add '<command>' --env HTTPS_PROXY,AWS_PROFILE`. `/juice badges list` shows the names a badge can see. If one of your badges stops working after the update, add it again with the `--env` it needs.

## 1.4.2 (2026-11-21)

[Changes since 1.4.1](https://github.com/zdraveski/claude-juice/compare/v1.4.1...v1.4.2)

Fixes for Weekly after switching accounts, limit resets and leftover badge files.

### Fixed

- **Weekly after switching accounts:** after you switch accounts, a new chat no longer pushes Weekly down (for example from 40% to 22%). juice shows the highest number any open chat has sent for that week.
- **Limit reset:** at the moment a limit resets, juice no longer shows it refilled a few seconds before Anthropic does.
- **Last badge removed:** removing your last badge now deletes the badge outputs and the copy of the status line details badges read. Before, they stayed in `juice-cache/badges` for good.

## 1.4.1 (2026-11-16)

[Changes since 1.4.0](https://github.com/zdraveski/claude-juice/compare/v1.4.0...v1.4.1)

Easier colours to read, a customizer that works on a phone, and many fixes for badges, the Mac Keychain and narrow windows.

### Changed

- **Cost speed:** when juice shows the cost, it now works it out in a few milliseconds instead of about 40.
- **Narrow red battery:** in a narrow window, a red battery first drops the reset time beside its run-out time, so it reads `Session 93% !! runs out ~2:33 PM` rather than `Session 93%!! out ~2:33 PM`.
- **Expired login:** when your Claude login has expired, juice no longer sends it. Claude Code renews it on your next message, and juice looks again 5 minutes later.
- **Fable check reasons:** `/juice doctor` says why the last Fable check failed: the login was refused, it had expired, Anthropic was busy, the login changed, or you were offline. Only a refused login gets "type /login".
- **Colour-blind safe set:** it is now blue, amber, red and pink-purple, picked so every kind of colour blindness tells them apart. On a light terminal, two of its colours looked the same to some people.
- **High contrast set:** it is now the easiest set to read on both backgrounds. Claude's light accent is a little darker and Solar's dark red a little lighter, so every colour of every set reads at 4.5:1 or more.
- **Hard-to-read colours:** `/juice set` says when one of your own colours is hard to read on its terminal (under 4.5:1), and still saves it. The customizer says "A little faint" for those. `Dark:` and `LIGHT:` work as well as `dark:`.
- **Customizer on a phone:** the preview stays in view and keeps its batteries, the preview options fold away, and every control is big enough to tap.
- **Customizer look and access:** switches, buttons and look cards stand out from the page, it follows Windows' high-contrast colours, and the keyboard can skip straight to the options.

### Security

- **Badge list hides keys:** `/juice badges list` and `remove` hide the whole value of a key typed before a command, however it is quoted or escaped, including `$(...)` and `${...}`.
- **Badge folder paths:** the project folder and chat path handed to badges are deleted once read.
- **Badge cache names:** badge cache files are named with SHA-256, which clears a GitHub security alert. Old ones are ignored and cleared after 7 days.

### Fixed

- **Narrow panels:** in a pane under 26 columns, a panel shows `Session 88%!!` instead of `Session …`. When only one battery fits, it is the one that blocks you first, not the first in your order.
- **First-reply hint:** the "batteries appear after Claude's first reply" hint no longer shows when no battery is chosen.
- **Readable words:** words now read at 4.5:1 or more wherever juice draws them: numbers in a battery and words in a capsule (some were down to 2.5:1), and white text on a fill in four light sets (Claude, Calm, Vampire, Forest). The pace tick on a glossy battery no longer fades into its casing.
- **256-colour terminals:** words never read worse than in full colour, on the background or on a fill. Claude's red fell to 3.7:1 there on a light terminal.
- **Cutting at the edge:** cutting a line or a badge at the window's edge never splits a flag, a joined emoji or a letter from its accent.
- **After an error:** the line juice shows stays on one row inside the window.
- **Wide characters:** more wide characters (Tangut, Kana supplement, small form variants) count as two columns, so the line doesn't spill.
- **Reset times:** a saved reset time could be read 1000 times too far away, so it never ended.
- **Blank line on Linux and macOS:** a Claude folder with a backslash in its name no longer leaves the line blank. If yours was blank, type `/juice setup` once after updating.
- **Windows PowerShell blank line:** Windows PowerShell 5.1 could pipe in a hidden mark (a BOM) that left the line blank.
- **Temp files:** temp files left by a refresh that was stopped are now cleared after every update.
- **Duplicate badges:** adding a badge that is already there adds no second copy.
- **Badges copied between computers:** a badge copied over in `juice.json` from another computer is approved where it stands when you add it again. `/juice badges list` now says to do that, instead of removing it first, and marks a copy 1.4.0 left beside an approved badge so you can remove it.
- **Background programs:** a program a badge leaves running in the background is stopped (Linux and macOS).
- **Badge folder:** a badge like `git branch` shows the repo Claude Code is in, not the folder juice runs from.
- **Fable stays off:** if you said no to the Fable battery, a mistyped or broken `juice.json` (a trailing comma, `"Off"`, a locked file) no longer turns the login read back on. The Fable battery stays off until the file is fixed.
- **Mac Keychain wait:** on a Mac, the Keychain question now waits 25 seconds for your answer instead of closing after 3. A slow answer no longer lets a second Fable check start and ask again.
- **Mac Keychain login:** juice also reads a Keychain login macOS prints as hex, and finds the login in `.credentials.json` when the Keychain has none.
- **Settings file with other content:** a `juice.json` that holds something other than settings, like `[]`, is left alone instead of replaced by `/juice set`.
- **Setup comparison:** `/juice setup` takes your status line as unchanged when only the order of its settings differs, and names the copy it sets aside.
- **Setup failure:** if `/juice setup` can't save your settings, or its copy of your old status line, it leaves the launcher as it was.
- **Setting names:** `/juice set` takes names in any case.
- **Doctor home folder:** `/juice doctor`'s report shortens a folder to `~` only when it is really your home folder (`/rootfs/x` showed as `~fs/x`), and hides your home folder even when it is quoted or ends in a slash. A home at a drive's root (`C:\`) no longer turns every folder on that drive into `~`.
- **Customizer on Windows:** `/juice customize` opens without a window flashing up on Windows.

## 1.4.0 (2026-11-15)

[Changes since 1.3.1](https://github.com/zdraveski/claude-juice/compare/v1.3.1...v1.4.0)

A much lighter refresh, a safer Fable login question, and many fixes for badges, terminal codes and the customizer.

### Changed

- **Still batteries, one refresh a minute:** the batteries and the effort level now stand still, and the line refreshes once a minute. The climb needed a refresh every second, which cost about a sixth of a CPU core for every open Claude Code window. Type `/juice set motion=on` to bring the climb back.
- **Refresh moved once:** after the update, juice moves the 1-second refresh it wrote for 1.3.x to once a minute by itself, once. It can't tell its own 1 or 30 from one you typed, so those move too; `/juice set motion=on` puts the 1 back.
- **Fable asks first:** `/juice setup` now asks before juice reads your Claude login for the Fable battery. If the Fable battery already showed on your Windows or Linux computer, it stays on.
- **When juice can't draw:** when juice can't draw the line, it shows `juice: /juice doctor` after the model name, so you know where to look. It goes away on the next run that works.

### Security

- **Badge list shows less:** `/juice badges list` shows only the first word of each command, so a key inside a command doesn't land in the chat. `/juice badges list --show` shows the whole commands and asks first. Don't put passwords or API keys in a badge command.
- **No terminal codes:** badge text and model names can't send terminal codes (like clipboard writes or title changes) or hidden direction marks that reorder the line.
- **Private cache folders:** on Mac and Linux, juice's cache folders, which hold the copy of Claude Code's data that badges read, can only be read by you. Folders from an older juice change on the first refresh after the update.
- **Customizer loads own files:** the customizer page can load only its own files.

### Fixed

- **Fuel tank narrow window:** fuel tank in a very narrow window never shows a "4%" that has lost its "left".
- **Used up:** 100% used with no reset time says "used up", not "almost empty".
- **Small and big costs:** a cost under a cent shows "<$0.01", and big costs get thousands separators.
- **Reset time in milliseconds:** a reset time sent in milliseconds is no longer drawn months away. An oversized reset time from Anthropic is refused.
- **No colour:** with no colour, rounded ends become plain ones instead of stray symbols, and an odd `COLUMNS` value no longer shrinks the line.
- **Other accounts:** a window signed into another Claude account shows its own Session and Weekly numbers, not the other account's.
- **Hanging status line:** the status line no longer hangs if Claude Code never finishes sending to it, and a file juice can't write no longer holds up every refresh for seconds.
- **Several windows:** when several Claude Code windows draw at the same moment, only one starts a background refresh, so your login goes to Anthropic once and a badge command runs once.
- **Theme:** juice reads Claude Code's theme only when your `terminal` setting is automatic.
- **Plugin folder links:** the status line keeps following juice updates when your plugins folder is a link (a symlink or a Windows junction). If yours stopped following them, `/juice doctor` says so; type `/juice setup`.
- **Broken juice folder:** a broken juice folder shows `juice: /juice doctor` instead of a blank line.
- **After uninstalling:** after juice is uninstalled, the line says what you can do: install it again and type `/juice restore`, or delete the `statusLine` entry in `settings.json`.
- **Failing badges:** a badge whose command fails keeps its last text for 5 minutes, then shows nothing, so an old branch name never passes for the current one.
- **Cache save failures:** if juice can't save its Fable or badge cache, it waits (15 minutes for Fable, 5 for badges) instead of trying again every few seconds.
- **Error messages:** a wrong `/juice set` value lists the values that work, and an error saving a file is a plain sentence. Other errors hide your home folder.
- **Unreadable files:** a `settings.json` juice isn't allowed to read is no longer called missing or one with a mistake in it, and a `juice.json` juice isn't allowed to read is no longer taken for a missing one or one to delete.
- **Clock set ahead:** a clock that was set ahead when you installed or updated juice or ran `/juice setup` no longer skips, or repeats on every refresh, the changes juice makes once after an update, like moving the every-second refresh to once a minute.
- **Temp files:** leftover temporary files are cleaned up.
- **Doctor wording:** `/juice doctor` says Node 24 or newer everywhere, says it's juice (not Claude Code) that can't read a `settings.json` with comments, and says `/juice setup` fixes a changed marketplace name.
- **Customizer access:** a screen reader reads the preview as words, each Copy button says what it copies, and nothing scrolls sideways at 320 px.
- **Customizer text:** the window title is easier to read, and the Fable row says the page can't turn on reading your login.
- **README:** it says the Fable battery needs Node 24 or newer behind a proxy too, that the proxy carries juice's connection to Anthropic, and that the usage address juice reads isn't a documented API.
- **Help:** `/juice` has clearer steps when setup fails or you type just `/juice`. The badge example in the help works on every system.

### Known limits

- **Climb between steps:** with `motion=on`, a refresh between climb steps (after a reply, or with a refresh time you chose) can show the picture part-way up. The number beside it is always right.
- **Node on Windows:** on Windows, setup writes plain `node`, so a Node that only your shell profile puts on PATH (nvm-windows, fnm, volta) isn't found.
- **Node version:** setup uses whichever Node comes first on PATH without checking its version, and `/juice doctor` checks the Node of the shell it runs in, which may not be the one the line uses.
- **Refresh of 1 or 30:** juice can't tell its own refresh time of 1 or 30 seconds from one you typed (see above).
- **Special characters in the folder:** a Claude folder whose path holds `$`, a backtick, `%` or `"` can't use juice; setup says so.
- **Busy settings file:** the once-per-update refresh move isn't tried again if `settings.json` was busy (`/juice doctor` says to type `/juice setup`). It rewrites `settings.json` whole, so a Claude Code change in the same instant could be lost.
- **Linked settings file:** a `settings.json` that is a link to a missing file becomes a normal file when juice writes it.
- **Slow clock:** a clock that was slow when juice updated and was put right before the status line next refreshed (it synced in between) skips the changes juice makes once after that update. The next update makes them.
- **Test versions:** a test version folder (like `1.4.0-beta`) counts the same as the release.
- **WSL and Windows:** WSL and Windows sharing one `settings.json` each write their own command.
- **No permission prompt:** `/juice` can change any setting without a permission prompt, `fable=on` included.
- **Two windows:** two windows saving at once can drop each other's last-seen numbers until the next refresh, and two windows of the same chat swap them on every refresh.
- **Times:** times are always 12-hour, and on a computer set to UTC every time says "UTC".
- **Wide characters:** some emoji sequences, skin tones and accents count wider than they draw, so the line may end a little early.

## 1.3.1 (2026-11-07)

[Changes since 1.3.0](https://github.com/zdraveski/claude-juice/compare/v1.3.0...v1.3.1)

Faster-moving batteries and effort level.

### Changed

- **Faster movement:** the effort level and the batteries move much faster: one step every 2 seconds instead of every 30, and they start again together every 12 seconds instead of every 3½ minutes, so they no longer sit still for minutes and look stuck.
- **Refresh every second:** juice now refreshes every second, twice a step, so no step is skipped. Run `/juice setup` once after updating (`/juice doctor` reminds you). A refresh time you chose yourself is kept, except juice's own old 60 and 30 seconds.

## 1.3.0 (2026-11-07)

[Changes since 1.2.2](https://github.com/zdraveski/claude-juice/compare/v1.2.2...v1.3.0)

Moving effort level and batteries.

### New

- **Moving effort level:** on your status line its staircase climbs up to your level, one step every 30 seconds, holds there, then starts again. The word beside it always says the level. When a narrow window hides the word, the staircase stands still, so the level can still be read.
- **Moving batteries:** Memory, Session, Fable, Weekly and Budget fill in four steps, one every 30 seconds, from a quarter of the way up to the real amount, then hold. They start again together with the effort level every 3½ minutes. Fuel tank fills up to what is left.
- **Only the picture moves:** the percentage, the warning marks and the times stay put and always say the real amount. A red battery stands still, and the even-pace tick only shows once the picture is full, so it never says "behind" while it climbs. Previews and `/juice looks` show everything still.

### Changed

- **Refresh every 30 seconds:** juice refreshes every 30 seconds instead of once a minute, so the pictures keep moving while Claude Code is idle. Run `/juice setup` once after updating to switch an existing install (`/juice doctor` reminds you); a refresh time other than juice's old 60 seconds is kept.

## 1.2.2 (2026-11-07)

[Changes since 1.2.1](https://github.com/zdraveski/claude-juice/compare/v1.2.1...v1.2.2)

Amber batteries now say when they will run out.

### Changed

- **Amber run-out time:** an amber battery that is on track to run out before it resets now says when, as a red one already did: "runs out ~Sat 2:12 PM · resets Mon 3:32 AM". It waits until a tenth of the limit's time has passed (about 17 hours of a week), so a busy first morning doesn't predict a run-out days away.
- **Narrow windows:** when the line is too wide, that time is the first thing to go after the battery size, and a narrow window keeps the reset time instead.
- **Which battery comes first:** the battery that needs you most is now an amber one that will run out, ahead of one that lasts until it resets: first when batteries move by need, in the Tightest first spotlight, and for the one time Capsules and Fuel tank show in a narrow window.

## 1.2.1 (2026-11-07)

[Changes since 1.2.0](https://github.com/zdraveski/claude-juice/compare/v1.2.0...v1.2.1)

Support for newer Node versions and small drawing fixes.

### Changed

- **Node versions:** juice now supports the two newest long-term Node versions, 24 and 26. On an older Node the line still draws, but `/juice doctor` says to update Node from nodejs.org.
- **Unknown settings:** a setting juice doesn't know, like a shape from a newer juice, now says how to update juice instead of only "isn't valid".
- **Half-used shapes:** shapes light a cell only when more than half of it is used, so 50% no longer looks over half: the slider's knob sits just left of the middle, and Lives shows 2 hearts of 5.

### Fixed

- **Stray space:** with no colour and plain ends, the line no longer starts with a stray space before the model name.
- **Emoji in badges:** a badge with an emoji like ❤️ is counted two columns wide, as terminals draw it, so the line never runs past the edge.
- **Customizer:** the battery style row wraps properly in older browsers.

## 1.2.0 (2026-11-07)

[Changes since 1.1.1](https://github.com/zdraveski/claude-juice/compare/v1.1.1...v1.2.0)

Eight new shapes to show usage instead of a battery.

### New

- **Eight shapes:** Pie, Sand, Slider, Pace race, Lives, Dots, Chevrons and Ruler are shapes instead of a battery. They show in Status bar and Tightest first, with the number after the shape, and read without colour too. `/juice set battery=slider` (or any of them), or pick one in the customizer.
- **Style notice:** when a look or `layout=` moves the style you picked to a layout that draws its own shapes, juice now says the style won't show there.

### Fixed

- **Outline width:** the Outline style was counted one column too wide, so a narrow window squeezed the line a little early.

## 1.1.1 (2026-11-07)

[Changes since 1.1.0](https://github.com/zdraveski/claude-juice/compare/v1.1.0...v1.1.1)

A clearer message when a battery style does nothing.

### Fixed

- **Battery style message:** `/juice set battery=` in a layout that keeps its own shapes (Classic segments, Panel, Capsules, Fuel tank) now says the style only shows in Status bar and Tightest first, instead of seeming to do nothing. The customizer page says the same under Battery style.

## 1.1.0 (2026-11-07)

[Changes since 1.0.2](https://github.com/zdraveski/claude-juice/compare/v1.0.2...v1.1.0)

New layouts, looks, battery styles and battery order, and a new default look.

### New

- **Two new layouts:** Capsules: each battery a rounded capsule that fills with colour when it needs you. Fuel tank: shows what is left instead of what is used.
- **Two new looks:** Capsule (Candy colours) and Road trip (Forest colours) use the new layouts. `/juice look 13` and `/juice look 14`.
- **New chat hint:** until Claude's first reply, the line reads "batteries appear after Claude's first reply" instead of looking broken.
- **Battery order:** the batteries keep your order, as before. If you like, they can move instead: the one that needs you first, or the fullest first. The customizer page has the same choice.
- **New default look:** glossy batteries in tinted glass, the model name on a small tag, effort steps that warm up as they climb, and quiet dividers between items. `/juice set battery=classic` brings the old bars back.
- **Battery style:** Glossy, Classic, Outline, Hot tip (heats up only when amber or red), Liquid edge and Pace glow. `/juice set battery=` and the style, or pick one in the customizer.

### Fixed

- **Very narrow window:** in a window narrower than one battery's words, the cut keeps its name, number and warning ("Week 50% left!") instead of cutting through them.

## 1.0.2 (2026-10-31)

[Changes since 1.0.1](https://github.com/zdraveski/claude-juice/compare/v1.0.1...v1.0.2)

Fixes for narrow windows, percentages, settings and setup.

### Fixed

- **Narrow red battery:** in a narrow window a red battery's "out ~2:44 PM" words now go before the battery itself. In the Everything look, red rows keep their numbers.
- **99%:** 99.5% to 99.9% shows as 99%, not as a used-up 100%.
- **Fable behind a proxy:** behind a company proxy, the Fable battery works with Node 24 or newer (22.21 or newer on Node 22), and `/juice doctor` says so.
- **Settings from a newer juice:** `/juice set` and badges change only what you asked for: a setting from a newer juice, still open in another window, is kept.
- **Old status line:** a status line set up by juice before 0.2.1 is brought up to date on its own (the old one could run another plugin named juice).
- **Setup edge cases:** setup handles an empty settings file and a Claude folder given as a relative path, and says plainly what it changed.
- **Launcher:** the launcher never mistakes a folder Claude Code named by code version for a newer juice.
- **Doctor project settings:** `/juice doctor` names a project's settings file from where you are, so it never shows the folders above it.

## 1.0.1 (2026-10-31)

[Changes since 1.0.0](https://github.com/zdraveski/claude-juice/compare/v1.0.0...v1.0.1)

Two fixes for `/juice setup`.

### Fixed

- **Setup switch message:** `/juice setup` tells you when it switches your status line to a different copy of juice. Before, it said "Nothing changed" even when it had.
- **Setup clears doctor warnings:** `/juice setup` clears the problem `/juice doctor` reported, so the warning only comes back if the problem does.

## 1.0.0 (2026-10-31)

The `/juice doctor` check, day-and-time reset times and several fixes.

### New

- **Doctor:** `/juice doctor` checks what juice sees and tells you in plain words. Each line is fine (✓), needs you (!) with what to do, or just for your information (·). It never shows your user name, so you can paste it into a bug report.
- **Reset times with a day:** reset times say the day and time when a limit resets more than a day from now: "resets Sat 7:20 PM", "resets next Wed 2:19 PM" a week out, a date further away. Under a day it still counts down ("resets in 2h 10m"). Days are counted on the calendar, so daylight saving never shifts them.
- **Run-out day:** a red battery that runs out on another day says which day the same way: "runs out ~Thu 9:15 AM".
- **UTC times:** times on a computer set to UTC (a server or container) say "UTC".

### Security

- **Badge commands hidden:** `/juice get` no longer shows your badge commands, which can hold a key.

### Fixed

- **Narrow red battery:** a red battery is never cut to something like "Week 9…" in a narrow window.
- **Used-up Budget:** a used-up Budget always shows, like Session, Weekly and Fable.
- **Faster start:** the status line starts faster.
- **Restore:** `/juice restore` handles a damaged saved copy instead of crashing.
- **Customizer:** a chosen terminal colour wins over the preview switch, and a link without settings in it no longer wipes the ones you saved.

## 0.2.6 (2026-10-31)

Fixes for narrow windows, restore and setup.

### Fixed

- **Used-up limit:** a used-up limit (100%) always shows, even in looks that leave it out.
- **Narrow windows:** in a narrow window, amber batteries go before red ones, and what's left always keeps the battery's name and number.
- **After a Node upgrade:** on a Mac or Linux, the status line keeps working after Node is upgraded.
- **Restore:** `/juice restore` never removes a status line that only runs juice from inside another script.
- **Setup folder check:** `/juice setup` refuses a Claude Code folder whose name would break the status line, before changing anything.
- **Setup messages:** setup says the batteries fill in after Claude's first reply, and explains a line that was told to show nothing.

## 0.2.5 (2026-10-31)

Badges need your approval, and early use is judged by pace.

### New

- **Pace judging:** batteries judge early use by pace: 84% used 24 minutes into a window is red.
- **Spotlight:** spotlight picks the red battery that runs out first.

### Security

- **Approved badges only:** badges only run if you approved them on this computer. A copied or hand-edited settings file can't make juice run anything.

### Fixed

- **Tiny windows:** a very small window never gets a line wider than itself.
- **Newer numbers kept:** several fixes so an idle or old window never overwrites newer numbers, including after `/login` switches accounts.

## 0.2.4 (2026-10-31)

Choose a look by number, a Terminal colour choice, and a fuller README.

### New

- **Look by number:** `/juice look` with a number picks a look.
- **Plain text:** `NO_COLOR` gives plain text.
- **Light terminal:** a light terminal is detected under Claude's "auto" theme.
- **Customizer:** the customizer page has a Terminal colour choice.
- **Setup warning:** setup warns when a project's own settings hide the status line.
- **Docs:** the README covers troubleshooting, narrow windows, updating, undoing and uninstalling.

### Fixed

- **Resumed chats:** resumed chats keep their batteries, and a cost of $0.00 is never shown.
- **Mac sign-in:** on a Mac, juice reads the right sign-in when you use more than one Claude Code folder.

## 0.2.3 (2026-10-31)

Better narrow windows, readable grey text and a Fable run-out time.

### New

- **Fable run-out time:** a red Fable battery says when it runs out.

### Changed

- **Narrow windows:** a narrow window keeps the model name and as much detail as fits.
- **Day countdowns:** day countdowns round the hours instead of cutting them.
- **Grey text:** grey text is easier to read, in the status line and on the customizer page.

### Fixed

- **Badge helpers:** a badge that leaves a helper program running can't hold up the status line.

## 0.2.2 (2026-10-31)

Safer settings, badge removal and uninstall.

### Changed

- **Fable for subscribers:** only Claude subscribers get a Fable battery.
- **Removing a badge:** removing a badge asks first, like adding one.

### Security

- **Private settings file:** a private settings file stays private when juice rewrites it.

### Fixed

- **Settings never reset:** your settings and badges are never reset because a settings file couldn't be read.
- **Restore:** restore with no saved copy removes juice instead of getting stuck.
- **Uninstalled juice:** an uninstalled juice stops running.

## 0.2.1 (2026-10-31)

Fixes for the clock, Fable model names and other plugins named juice.

### Fixed

- **Clock ahead:** a computer clock that ran ahead no longer freezes the Fable and badge updates.
- **Fable model name:** a Fable model named like "Fable 5.1" still counts.
- **Other plugins:** juice never runs another plugin that happens to be called juice.

## 0.2.0 (2026-10-31)

Run-out times, an even-pace mark and full colour in Windows Terminal.

### New

- **Run-out time:** red batteries say when they run out at this pace: "runs out ~4:04 PM · resets in 2h 10m".
- **Even-pace mark:** a thin mark on Session, Weekly and Fable shows where an even pace would be, so going too fast is visible without colour.
- **Amber and red rules:** a battery turns amber on pace alone; red needs 90% used, or half used and on track to run out.
- **Windows Terminal:** Windows Terminal gets full colour.

### Fixed

- **Removed badges:** a removed badge never shows its text in another's place.

## 0.1.0 (2026-10-29)

The first release.

### New

- **First release:** a battery-style status line for Claude Code that shows how much of your usage you have used and when it resets. It comes with twelve ready-made looks, thirteen colour sets, the plain-words `/juice` command and a web customizer with a live preview.
