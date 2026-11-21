# Privacy

[← Back to juice](../README.md)

juice reads your Claude login only for the Fable battery and sends it only to Anthropic. You are asked first, unless you already had the Fable battery before 1.4.0 on Windows or Linux. The details:

- The Fable battery needs your Claude login token, the key Claude Code keeps on your computer to sign you in. juice reads it from `.credentials.json` in your Claude folder (`~/.claude`, or your `CLAUDE_CONFIG_DIR` folder), or on a Mac from the Keychain (the Mac's password store).
- juice asks before it reads the token, on every system. `/juice setup` asks once, and `/juice set fable=on` or `/juice set fable=off` changes your answer later. If you used juice before 1.4.0 on Windows or Linux and already have a Fable battery, it stays on.
- On a Mac, macOS also asks once for permission to read the token from the Keychain. If macOS asks more than once, or the battery doesn't appear within a few minutes, please [tell us](https://github.com/zdraveski/claude-juice/issues/new?template=bug_report.yml) what `/juice doctor` says.
- Share links and the customizer's command never turn the Fable battery on or off; only you do.
- juice sends that token only to `api.anthropic.com`, to read your usage, about every 5 minutes. It never stores or logs it. juice keeps only your usage numbers, in `juice-cache/fable.json`.
- If your login has expired, juice sends nothing and looks again in 5 minutes. If a check fails, it waits 15 minutes before the next one.
- If `HTTPS_PROXY` (or `https_proxy`) is set, the proxy it names carries juice's connection to Anthropic, as it does for Claude Code.
- Anthropic doesn't publish the usage address juice reads (`api.anthropic.com/api/oauth/usage`) for others to use, so it may stop working.
- The same usage reading also keeps Session and Weekly up to date in every window, including idle ones and brand-new chats. With the Fable battery off, those two come only from Claude Code itself, so an idle window can show older numbers.
- To switch the Fable battery off, run `/juice set fable=off`.
- [Badges](badges.md) only run commands you added yourself with `/juice badges add`, after juice shows you the command.
- juice keeps its files only in your Claude folder: your choices in `juice.json`, copies of your old status line in `juice-backup.json` (and any older `juice-backup-*.json`), its launcher in `juice-statusline.mjs`, and recent readings, badge results, the badge signing secret and the last error in `juice-cache`. Besides that, `/juice setup` sets the status line in your `settings.json`. juice sends nothing to its maker and has no analytics.
- To remove everything: run `/juice restore` to bring back your old status line, uninstall the plugin, then delete those files and the `juice-cache` folder.
- Check it yourself: the token is read and sent in [src/fable.js](../src/fable.js); badges run in [src/badges.js](../src/badges.js).

Questions about privacy: [open an issue](https://github.com/zdraveski/claude-juice/issues). To report a security problem privately, see [SECURITY.md](../SECURITY.md).
