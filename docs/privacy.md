# Privacy

[juice](../README.md) · [Guide](guide.md) · [Commands](commands.md) · [FAQ](faq.md) · [Badges](badges.md) · [Troubleshooting](troubleshooting.md) · [Privacy](privacy.md)

- Read: your Claude login token, only for the Fable battery, and only after you say yes, unless you already had the Fable battery before 1.4.0 on Windows or Linux.
- Sent: that token goes to `api.anthropic.com` and nowhere else.
- Stored: your usage numbers. Never the token.
- Analytics: none. juice sends nothing to its maker.

## The Fable battery and your login

The Fable battery needs your Claude login token, the key Claude Code keeps on your computer to sign you in. juice reads it from `.credentials.json` in your Claude folder (`~/.claude`, or your `CLAUDE_CONFIG_DIR` folder). On a Mac it reads it from the Keychain, the Mac's password store.

- juice asks before it reads the token, on every system. `/juice setup` asks once. `/juice set fable=on` or `/juice set fable=off` changes your answer later.
- Before 1.4.0, on Windows and Linux, juice read the token without asking. If you already had a Fable battery then, it stays on. Type `/juice set fable=off` to turn it off.
- On a Mac, macOS also asks once for permission to read the token from the Keychain.
- Share links and the customizer's command never turn the Fable battery on or off. Only you do.
- juice sends the token only to `api.anthropic.com`, about every 5 minutes, to read your usage. It never stores or logs it. It keeps only your usage numbers, in `juice-cache/fable.json`.
- If your login has expired, juice sends nothing and looks again in 5 minutes. If a check fails, it waits 15 minutes.
- If `HTTPS_PROXY` (or `https_proxy`) is set, the proxy carries juice's connection to Anthropic, as it does for Claude Code.

### If the Fable address changes

Anthropic does not publish the usage address juice reads (`api.anthropic.com/api/oauth/usage`) for others to use, so it may stop working. Then the Fable battery disappears. Session and Weekly keep working, because Claude Code hands those to juice itself. `/juice doctor` reports it.

With the Fable battery on, the same reading also keeps Session and Weekly current in every window, including idle ones and brand-new chats. With it off, an idle window can show older numbers.

## Badges

[Badges](badges.md) only run commands you added yourself with `/juice badges add`, after juice shows you the command. They see only basic environment variables, not your keys or tokens, unless you name one with `--env`.

## Files juice keeps

All of them live in your Claude folder.

| File | What is in it |
|---|---|
| `juice.json` | Your choices and badge commands |
| `juice-backup.json` | A copy of your old status line (and any older `juice-backup-....json`) |
| `juice-statusline.mjs` | The launcher that runs juice |
| `juice-cache` | Recent usage readings, badge results, the badge approval secret and the last error |

While you have badges, `juice-cache` also keeps a copy of the details Claude Code gives the status line (folder, chat and cost), which badge commands read. juice deletes copies older than a week, and all of them when you remove your last badge.

`/juice setup` also sets the status line in your `settings.json`.

## Remove everything

1. Run `/juice restore` to bring back your old status line.
2. Uninstall the plugin.
3. Delete the files above and the `juice-cache` folder.

## Check it yourself

- The token is read in `readToken` and sent in `fetchFable`, both in [plugin/src/fable.js](../plugin/src/fable.js).
- Badges run in `run` in [plugin/src/badges.js](../plugin/src/badges.js).

Questions or problems: [open an issue](https://github.com/zdraveski/claude-juice/issues). To report a security problem privately, see [SECURITY.md](../.github/SECURITY.md).
