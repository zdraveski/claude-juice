# FAQ

[juice](../README.md) · [Guide](guide.md) · [Commands](commands.md) · [FAQ](faq.md) · [Badges](badges.md) · [Troubleshooting](troubleshooting.md) · [Privacy](privacy.md)

## Is juice official?

No. It is free and not made by Anthropic.

## Do I need a Max plan?

No. juice is for Claude Code on a Pro or Max plan. Only Max has been checked against Anthropic's usage page. Pro is not checked.

## Does juice use my limits?

The status line is a small script, not a Claude request, so it uses none. The optional Fable battery makes one usage lookup about every 5 minutes. A `/juice` command is a short chat turn and uses a little.

## Does it read my prompts or code?

No. juice reads only what Claude Code hands every status line: model, folder, limits, context and cost. It does not read your prompts, replies or files. See [Privacy](privacy.md).

## Does it slow Claude Code down?

Not noticeably. juice has no dependencies and adds about 60 ms to Node starting on an old laptop (`node scripts/bench.js` measures yours). It refreshes once a minute. With `/juice set motion=on` it refreshes every second, which costs about a sixth of one processor core for each open Claude Code window. See [Motion and refresh](guide.md#motion-and-refresh).

## Does it work with an API key?

Partly. juice is for Claude Code on a Pro or Max plan. If you pay with an API key, it shows your cost instead of limits.

## Why does it differ from /usage?

Session, Weekly and Memory come from the numbers Claude Code gives the status line, and Claude Code sends them after a reply. The numbers were checked once against Anthropic's usage page, on a Max account. A gap of a few percent right after a reply is normal, because juice refreshes about once a minute and `/usage` is read live. If yours stay far off for several minutes, type `/juice doctor` and [open an issue](https://github.com/zdraveski/claude-juice/issues/new?template=bug_report.yml) with what it says.

## Why is Weekly out of date in an idle window?

With the Fable battery off, Session and Weekly come only from Claude Code, so an idle window or a new chat can show older numbers until the next reply. With the Fable battery on, juice reads your usage about every 5 minutes, which keeps both up to date in every window. See [Privacy](privacy.md).

## Why is the line empty?

The batteries fill in after Claude's first reply. If the line stays empty, type `/juice doctor`.

## Which terminals work?

juice runs in the terminal where you type `claude`, on Windows, macOS and Linux. It does not show in the VS Code chat panel or the desktop app. Rounded battery ends show on their own in VS Code. Elsewhere you get plain ends, and `/juice use round ends` turns them on. The macOS Terminal app before macOS 26 does not draw full colour, so juice uses 256 colours there and the colours are close. You need to do nothing. iTerm2, Windows Terminal, VS Code and kitty draw full colour. tmux is not tested. If colours look wrong anywhere, see [Troubleshooting](troubleshooting.md). More in the [guide](guide.md#by-system).

## Which Node and Claude Code versions do I need?

Node 24 or newer. This is separate from Claude Code. Type `node --version` to check yours. Claude Code: juice was tested by hand when 1.0.0 shipped, with 2.1.316 on Windows; CI tests every release on Windows, macOS and Linux. No older minimum is known.

## How do I update or remove it?

To remove it, type `/juice restore` first, then remove juice in `/plugin`. Your old status line comes back. juice's own files stay in your Claude folder until you delete them. [Troubleshooting](troubleshooting.md#update-undo-and-uninstall) has the steps, including updating.

## Does it send my data anywhere?

Only while the Fable battery is on: one usage request to `api.anthropic.com`, using your Claude login, and juice asks before it reads the login, unless you already had the Fable battery before 1.4.0 on Windows or Linux. There is no telemetry. [Privacy](privacy.md) has the details.
