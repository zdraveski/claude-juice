# Fix, update or remove juice

[← Back to juice](../README.md)

## If something looks wrong

Type `/juice doctor` first (when juice itself hits a problem, the line says `juice: /juice doctor` until the next run that works). It checks, in plain words, your Node version, whether juice is your status line, which juice it runs, whether a project setting hides it, whether your juice settings and badges are usable, whether drawing works with them, when juice last saw your limits, how the Fable battery is doing and the last problem the status line hit, and says what to do about each. It never shows your badge commands or another status line's command, and your home folder reads `~`, so it doesn't show your user name. If you ask for help, [open a bug report](https://github.com/zdraveski/claude-juice/issues/new?template=bug_report.yml) and include what it says.

- **The status line is empty.** Type `/juice setup` again; it repairs the line and says if a project setting or `disableAllHooks` is hiding it. If it is still empty, check that Node is installed (type `node --version` in a terminal; you need 24 or newer, from nodejs.org), then restart Claude Code.
- **The text is hard to read on a light background.** Type `/juice my terminal is light`.
- **The colours look slightly off, for example over `ssh` or `sudo`.** juice uses full colour only when the terminal says it can, and that note gets lost over `ssh` and `sudo`, so you get the nearest of 256 colours. If your terminal draws full colour (iTerm2, Windows Terminal, VS Code, kitty and most others, but not the macOS Terminal app), type `/juice set truecolor=on`. If the colours come out wrong or garbled, type `/juice set truecolor=off`.
- **You see boxes or question marks instead of round battery ends.** Type `/juice use plain ends`.
- **You want round battery ends outside VS Code.** Type `/juice use round ends`.
- **The line runs past the edge or wraps.** Some terminals set up for Chinese, Japanese or Korean draw symbols like `■`, `░` and `·` two columns wide. Look for a setting called "ambiguous width" (iTerm2 and GNOME Terminal have one) and set it to narrow.
- **There is no Fable battery.** juice asks before it reads your login, so type `/juice set fable=on` if you said no. Then `/juice doctor` says how the last check went and what to do, for example to type `/login` when Anthropic refused your sign-in. [Privacy](privacy.md) says what juice reads and sends for this battery.
- **The Fable battery doesn't show at work, behind a company proxy.** juice goes through the proxy named in `HTTPS_PROXY` (or `https_proxy`), so set it where you start Claude Code. If your company inspects secure connections, also point `NODE_EXTRA_CA_CERTS` at its certificate file.
- **It says "juice is turned off" or "juice is not installed".** Turn juice back on, or install it again, in `/plugin`. Then `/juice setup` uses it, or `/juice restore` gives you your old status line back. If you don't want juice back, delete the `statusLine` entry in `~/.claude/settings.json`; your old one is in `~/.claude/juice-backup.json`.

## Update, undo and uninstall

- To update, open `/plugin`, pick juice, and update it, then restart Claude Code. Your settings and badges stay. [What's new](../CHANGELOG.md) lists what each version changed.
- To undo, type `/juice restore`. It puts your old status line back.
- To uninstall, run `/juice restore` first, then remove juice in `/plugin`. If you uninstall first, the status line tells you how to get back.

<details>
<summary>Remove every juice file</summary>

After uninstalling, juice's own files are still in your Claude folder (`~/.claude`, or your `CLAUDE_CONFIG_DIR` folder): `juice.json` (your settings and badge commands), the `juice-cache` folder (usage numbers, a list of recent chats, and, if you use badges, their approval and what Claude Code told the status line about each chat, including its project folder), any older `juice-backup-….json` copies, and, if you uninstalled before `/juice restore`, `juice-statusline.mjs`, `juice-backup.json` (your old status line) and the `statusLine` entry in `settings.json` (Claude can remove it for you). Delete them if you want nothing left. (Deleting `juice-cache` while juice is installed is harmless, except that your badges stop running until you approve each one again by adding the same command with `/juice badges add`.)

</details>
