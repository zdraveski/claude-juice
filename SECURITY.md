# Security

juice reads your Claude login token (for the Fable battery) and runs badge commands you add yourself. If you find a security problem in it, please report it privately:

- [Report a vulnerability](https://github.com/zdraveski/claude-juice/security/advisories/new) on GitHub. Only you and the maintainer can see it.
- Please don't open a public issue for it.

These count as security problems: your Claude login token being stored, logged or sent anywhere except `api.anthropic.com`, or read while the Fable battery is off; a badge command running without your approval; or juice changing settings it didn't tell you about. Claude Code itself is Anthropic's: please report problems in it to Anthropic.

Say what you found, which juice version (`/juice doctor` prints it) and how to reproduce it. A fix ships as a new version, with your report credited unless you'd rather not be named.

Only the newest version gets fixes. To update, open `/plugin` in Claude Code, update juice, then restart Claude Code.

What juice does with your data is in the README's [Privacy](README.md#privacy) section.
