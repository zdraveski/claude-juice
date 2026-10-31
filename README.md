# juice

Juice replaces the row under your Claude Code prompt with little batteries. Each battery shows how much you have **used**, counted the same way as Anthropic's usage page, and when it resets.

![claude-juice: your Claude usage at a glance. A battery-style status line for Claude Code, showing Memory, Session, Fable and Weekly and when each one resets.](docs/images/hero.png)

<p align="center">
  <a href="https://zdraveski.github.io/claude-juice/web/"><img src="docs/images/open-customizer.png" alt="Open the live customizer" width="340"></a>
  <br>
  <sub>Try every look, layout and colour with a live preview, right in your browser. Ctrl+click (Cmd+click on a Mac) opens it in a new tab.</sub>
</p>

## What you get

![Everything juice gives you: used % like Anthropic, when every limit resets, ! and !! warnings, a violet Fable battery, 12 ready-made looks, 13 colour sets, live numbers in every window, the /juice command, and a one-step undo.](docs/images/features.png)

## Install

You need Node 18 or newer. To check, type `node --version` in a terminal. If you don't have it, get it from [nodejs.org](https://nodejs.org). Then type these three lines into Claude Code, one at a time:

```
/plugin marketplace add zdraveski/claude-juice
/plugin install juice@juice
/juice setup
```

Juice saves your old status line first, if you had one, so `/juice restore` can always bring it back.

## What the batteries mean

![Reading the status line, left to right: the model, the effort level from low to max, Memory (room used in this chat), Session (your 5-hour limit), when it resets, Fable (its own weekly limit), Weekly (your weekly limit), and ! or !! when it is going fast or nearly out.](docs/images/anatomy.png)

| Battery | What it shows |
|---|---|
| Memory | How much of this chat's room is used. When it fills up, Claude summarises the chat to make space. |
| Session | Your 5-hour limit. |
| Fable weekly | The separate weekly limit for the Fable model. One-line layouts call it "Fable"; the panel says "Fable weekly". It resets together with Weekly, so it shows no reset time of its own while Weekly is shown. When it is red it still says when it runs out. |
| Weekly | Your weekly limit. |
| Budget | Only if your company gives you Claude Code through a gateway with a spending limit: how much of that budget is used. It has no pace: it turns amber past 85% used and red past 90%. |

Next to the batteries you also see the model's name and its effort level: a little staircase that climbs from 1 step (low) to 5 steps (max), with the word beside it.

Session and Weekly also say when they reset: how long, when it is less than a day away ("resets in 1h 31m"), and otherwise which day and at what time ("resets Sat 7:20 PM", or "Nov 10, 6:23 PM" when it is more than a week away). Times are in your computer's time zone; on a computer set to UTC, such as a server you reach over SSH, they say "UTC". In a narrow window it is the short countdown ("resets 2d 5h").

The colours for Session, Weekly and Fable weekly depend on your pace as well as on how much is used:

- Green means plenty left.
- Amber with ! means you are going a bit fast. At this pace you could run out before it resets.
- Red with !! means almost empty, or more than half used and on track to run out before it resets. A red battery also says when it runs out at this pace, for example "runs out ~4:04 PM · resets in 2h 10m".

A limit that is used up always shows, even in a look that leaves it out, so you never see "all fine" while you are locked out.

A thin line on these batteries marks where you would be if you used the limit evenly. If the colour reaches past the line, you are going faster than that. Before the line, you have time to spare.

The Fable bar is violet while it is fine, so you can tell it apart at a glance. When it goes fast or runs low, it turns amber or red with ! or !! like the others.

![Colours tell you how it is going: green means plenty left, amber with ! means going a bit fast, red with !! means nearly out and says when it runs out, and Fable is violet while it is fine. A thin line on each battery marks an even pace.](docs/images/colours.png)

Memory has no pace or reset. It turns amber, then red, as the chat fills up.

Pro and Max plans show the limits that apply to them. If you pay as you go with an API key, you see your cost instead.

## Four layouts

Pick the one you like. The status bar is the default.

### Status bar

Everything fits on one line.

![Status bar](docs/images/layout-bar.png)

### Classic segments

Each battery is five bars, like the signal on an old phone.

![Classic segments](docs/images/layout-segments.png)

### Tightest first

The battery closest to running out gets a big spotlight, and the rest shrink to numbers.

![Tightest first](docs/images/layout-focus.png)

### Panel

Each battery gets its own row, with the most detail.

![Panel](docs/images/layout-panel.png)

## Ready-made looks

A look picks the layout, the colours and what shows, all in one go. Your badges and Fable setting stay as they are. Pick one, then change anything you like.

![The 12 ready-made looks, each drawn as it really looks: Juice, Just the basics, Spotlight, Everything, Retro phone, Quiet, Night owl, Easy to see, Colour-blind friendly, Works everywhere, Cost watcher and Fable first.](docs/images/looks.png)

| Look | What it is |
|---|---|
| Juice | The standard look. Pick it to go back to the start. |
| Just the basics | Two batteries and nothing else. |
| Spotlight | The battery that needs you most is big, the rest stay small. |
| Everything | One row per battery, every detail spelled out. |
| Retro phone | Signal bars like an old phone, in cool colours. |
| Quiet | Grey until something needs you. Reset times only show then. |
| Night owl | Neon bars for dark terminals. |
| Easy to see | Like Spotlight, in bright high-contrast colours. |
| Colour-blind friendly | Blue, yellow and orange instead of green and red. |
| Works everywhere | For older terminals that show boxes instead of rounded ends. |
| Cost watcher | Shows what this chat would have cost. |
| Fable first | The Fable battery leads, and lights up while you use Fable. |

There are 13 colour sets to choose from: Claude, Frost, Calm, Colour-blind safe, High contrast, Ocean, Midnight, Vampire, Candy, Forest, Sunset, Solar and Rose. Or make your own in the customizer.

![The 13 colour sets on a dark terminal, each showing a fine battery, an amber one with ! and a red one with !!.](docs/images/colour-sets.png)

## Change how it looks

Type `/juice` and then say what you want, in your own words. For example:

- `/juice looks` (shows all 12 looks, numbered; then `/juice look 7` switches to number 7)
- `/juice use the quiet look`
- `/juice hide the cost`
- `/juice use the calm colours`
- `/juice show the reset times only when something needs attention`
- `/juice make it a panel`
- `/juice my terminal is light` (if the text is hard to read on a light background)

In a narrow window juice makes room step by step: first badges, reset times, the effort word and cost, then the effort level and the model name, then spacing, battery size and shorter words, then every battery as words only (`Session 88%!! out ~2:44 PM`), and only last the batteries that are fine. Whatever freed room gets used again, so a battery keeps its picture whenever it fits. A red battery keeps its `!!` and when it runs out as long as the window has room for its words; in a very small window the end of the line is cut.

### The live customizer

**[Open the live customizer](https://zdraveski.github.io/claude-juice/web/)** to try every look, layout and colour with a live preview, then copy one line into Claude Code. It runs in your browser, so there is nothing to install.

<p align="center">
  <a href="https://zdraveski.github.io/claude-juice/web/"><img src="docs/images/open-customizer.png" alt="Open the live customizer" width="340"></a>
  <br>
  <sub>Ctrl+click (Cmd+click on a Mac) opens it in a new tab.</sub>
</p>

[![The juice customizer web page: a live preview of the status line, options for plan, model, window size, dark or light terminal and situation, and the ready-made looks to start from.](docs/images/customizer.png)](https://zdraveski.github.io/claude-juice/web/)

## If something looks wrong

Type `/juice doctor` first. It checks, in plain words, whether juice is your status line, which juice it runs, whether drawing works with your settings, when juice last saw your limits, how the Fable battery is doing and the last problem the status line hit, and says what to do about each. It never shows your badge commands or another status line's command, and your home folder reads `~`, so it doesn't show your user name. If you ask for help, include what it says.

- **The status line is empty.** Type `/juice setup` again; it repairs the line and says if a project setting or `disableAllHooks` is hiding it. If it is still empty, check that Node is installed (type `node --version` in a terminal; you need 18 or newer, from nodejs.org), then restart Claude Code.
- **The text is hard to read on a light background.** Type `/juice my terminal is light`.
- **You see boxes or question marks instead of round battery ends.** Type `/juice use plain ends`.
- **It says "juice is turned off" or "juice is not installed".** Turn juice back on, or install it again, in `/plugin`. Then `/juice setup` uses it, or `/juice restore` gives you your old status line back.

## Update, undo and uninstall

- **Update:** open `/plugin`, pick juice, and update it. Your settings and badges stay.
- **Undo:** `/juice restore` puts your old status line back.
- **Uninstall:** run `/juice restore` first, then remove juice in `/plugin`. If you uninstall first, the status line tells you how to get back.
- **Leave nothing behind:** after uninstalling, juice's own files are still in your Claude folder (`~/.claude`): `juice.json` (your settings and badge commands), the `juice-cache` folder (usage numbers, the approval of your badges, and, for up to a week, which project each chat was in), any `juice-backup-….json` copies, and `juice-statusline.mjs` if you uninstalled before `/juice restore`. Delete them if you want nothing left. (Deleting `juice-cache` while juice is installed is harmless, except that your badges then need adding again.)

## Badges

Badges are small optional extras that show the output of a command you choose. Juice only runs commands you added yourself on this computer with `/juice badges add`, after it shows you the command: each one is approved with a secret that stays on this computer, so a `juice.json` copied from somewhere else never runs anything. (Badges added before juice 0.2.5 need adding again; `/juice badges list` marks them.) `/juice badges list` shows them numbered, and `/juice badges remove 1` removes the first one, after asking. Badges update about every 30 seconds while you work. On Windows, badge commands run in the Windows command prompt (cmd), not Git Bash, so write them for cmd.

## Privacy

- The Fable battery needs your Claude login token, the key Claude Code keeps on your computer to sign you in. Juice reads it from `~/.claude/.credentials.json`.
- The Fable battery is on by default on Windows and Linux. On a Mac it stays off until you type `/juice set fable=on`, and macOS will then ask once for permission to read it from the Keychain (the Mac's password store). This is new on the Mac: if macOS asks more than once, or the battery doesn't appear within a few minutes, please [tell us](https://github.com/zdraveski/claude-juice/issues/new) what `/juice doctor` says. Share links and the customizer's command never turn it on or off; only you do.
- Juice sends that token only to `api.anthropic.com`, to read your usage, about every 5 minutes. It never stores or logs it.
- The same usage reading also keeps Session and Weekly up to date in every window, including idle ones and brand-new chats. With the Fable battery off, those two come only from Claude Code itself, so an idle window can show older numbers.
- To switch the Fable battery off, run `/juice set fable=off`.
- Badges only run commands you added yourself with `/juice badges add`, after juice shows you the command.
