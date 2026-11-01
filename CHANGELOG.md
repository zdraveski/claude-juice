# What's new in juice

To update, type `/plugin`, update juice, then restart Claude Code.

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
