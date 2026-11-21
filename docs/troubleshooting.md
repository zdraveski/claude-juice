# Troubleshooting

[juice](../README.md) · [Guide](guide.md) · [Commands](commands.md) · [FAQ](faq.md) · [Badges](badges.md) · [Troubleshooting](troubleshooting.md) · [Privacy](privacy.md)

Run `/juice doctor`. It tells you what is wrong and what to do.

It checks your Node version, whether juice is your status line, whether a project setting hides it, your settings and badges, the Fable battery and the last error. It never shows your badge commands, and your home folder reads `~`. If you ask for help, [open a bug report](https://github.com/zdraveski/claude-juice/issues/new?template=bug_report.yml) and paste what it says.

When juice itself hits a problem, the status line says `juice: /juice doctor` until the next run that works.

Jump to:

- [Nothing shows, or the install fails](#nothing-shows-or-the-install-fails)
- [The look is wrong](#the-look-is-wrong)
- [The Fable battery](#the-fable-battery)
- [Update, undo and uninstall](#update-undo-and-uninstall)
- [By system](#by-system)

## Nothing shows, or the install fails

### `/plugin marketplace add` fails

1. Check that you typed `/plugin marketplace add zdraveski/claude-juice` exactly.
2. Check that you can reach github.com from this computer.
3. Update Claude Code, then try again.

### Claude Code does not know `/juice`

1. Type `/reload-plugins`.
2. If it still fails, restart Claude Code.
3. Type `/plugin` and check that juice is installed and turned on.

### The status line is empty

1. Type `/juice setup`. It repairs the line and says if a project setting or `disableAllHooks` is hiding it.
2. Type `node --version` in a terminal. You need 24 or newer, from nodejs.org.
3. Restart Claude Code.

### The line is blank before my first message

A new chat has no numbers until Claude's first reply. juice says "batteries appear after Claude's first reply". Send a message and they fill in.

### It says "juice is turned off" or "juice is not installed"

1. Open `/plugin` and turn juice on, or install it again.
2. Type `/juice setup` to use juice, or `/juice restore` to get your old status line back.
3. If you don't want juice back, delete the `statusLine` entry in the `settings.json` in your Claude folder. Your old line is in `juice-backup.json` there. Folder paths are under [By system](#by-system).

### The numbers differ from `/usage`

Session and Weekly are the numbers Claude Code hands juice, and juice refreshes about once a minute by default, so they can lag `/usage` for a moment. The Fable battery comes from a separate check about every 5 minutes. If a number is still far off after a few minutes, [open a bug report](https://github.com/zdraveski/claude-juice/issues/new?template=bug_report.yml) with what `/juice doctor` says.

### It shows cost, not batteries

You pay with an API key, so there are no plan limits to show. juice shows cost instead.

## The look is wrong

### Text is hard to read on a light background

Type `/juice my terminal is light`.

### The colours look slightly off, for example over `ssh` or `sudo`

1. juice uses full colour only when the terminal says it can. That note gets lost over `ssh` and `sudo`, so you get the nearest of 256 colours.
2. If your terminal draws full colour, type `/juice set truecolor=on`.
3. If the colours come out wrong, type `/juice set truecolor=off`.

The macOS Terminal app before macOS 26 does not draw full colour. See [By system](#by-system).

### Boxes or question marks show instead of round battery ends

Type `/juice use plain ends`.

### I want round battery ends outside VS Code

Type `/juice use round ends`.

### The line runs past the edge or wraps

Some terminals set up for Chinese, Japanese or Korean draw symbols like the block and dot characters two columns wide.

1. Find a setting called "ambiguous width". iTerm2 and GNOME Terminal have one.
2. Set it to narrow.

## The Fable battery

[Privacy](privacy.md) says what juice reads and sends for this battery.

### There is no Fable battery

1. juice asks before it reads your login. Type `/juice set fable=on` if you said no.
2. Type `/juice doctor`. It says how the last check went. For example, it tells you to type `/login` when Anthropic refused your sign-in.
3. On a Mac, wait a few minutes after you allow the Keychain prompt.

### The Fable battery does not show behind a company proxy

1. Set `HTTPS_PROXY` (or `https_proxy`) where you start Claude Code. juice goes through that proxy.
2. If your company inspects secure connections, point `NODE_EXTRA_CA_CERTS` at its certificate file.

## Update, undo and uninstall

### Update

1. Open `/plugin`, pick juice, and update it.
2. Restart Claude Code.

Your settings and badges stay. [What's new](../CHANGELOG.md) lists what each version changed.

### Undo

Type `/juice restore`. It puts your old status line back.

### Uninstall

1. Type `/juice restore`.
2. Remove juice in `/plugin`. If you uninstall first, the status line tells you how to get back.
3. Optional: delete the files juice left in your Claude folder (next section).

<details>
<summary>Remove every juice file</summary>

After uninstalling, these are still in your Claude folder:

- `juice.json`: your settings and badge commands.
- `juice-cache`: usage numbers, a list of recent chats and, if you use badges, their approval and what Claude Code told the status line about each chat, including its project folder.
- `juice-backup-....json`: any older copies of your status line.

If you uninstalled before `/juice restore`, these are left too:

- `juice-statusline.mjs`
- `juice-backup.json`: your old status line.
- The `statusLine` entry in `settings.json`. Claude can remove it for you.

Deleting `juice-cache` while juice is installed is harmless, except that your badges stop running until you add each one again with `/juice badges add`.

</details>

## By system

Your Claude folder is `%USERPROFILE%\.claude` on Windows (for example `C:\Users\you\.claude`) and `~/.claude` on macOS and Linux. If you set `CLAUDE_CONFIG_DIR`, that folder is used instead.

### Windows

- Your login token is read from `.credentials.json` in your Claude folder.
- Badge commands run in the Windows command prompt (cmd), not Git Bash. See [Badges](badges.md#on-windows).
- Windows Terminal draws full colour and juice detects it, so nothing to set.

### macOS

- Your login token is read from the Keychain. macOS asks once for permission. If it asks more than once, or the battery does not appear within a few minutes, [tell us](https://github.com/zdraveski/claude-juice/issues/new?template=bug_report.yml) what `/juice doctor` says.
- The macOS Terminal app before macOS 26 does not draw full colour. juice uses 256 colours there, and the colours are close. Type `/juice set truecolor=on` only if your terminal draws full colour, such as iTerm2.

### Linux

- Your login token is read from `.credentials.json` in your Claude folder.
- Most terminals draw full colour and say so with `COLORTERM`. Over `ssh` or `sudo` that note is lost. See [the colours look off](#the-colours-look-slightly-off-for-example-over-ssh-or-sudo).
