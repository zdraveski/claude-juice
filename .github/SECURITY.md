# Security

To report a security problem privately:

- [Report a vulnerability](https://github.com/zdraveski/claude-juice/security/advisories/new) on GitHub. Only you and the maintainer can see it.
- Please don't open a public issue for it.

These count as security problems:

- Your Claude login token is stored, logged, or sent anywhere except `api.anthropic.com`.
- The token is read while the Fable battery is off.
- A badge command runs without your approval.
- juice changes settings it didn't tell you about.

Claude Code itself is Anthropic's. Please report problems in it to Anthropic.

Say what you found, which juice version (`/juice doctor` prints it) and how to reproduce it. A fix ships as a new version. Your report is credited unless you'd rather not be named.

Only the newest version gets fixes. To update, see [Troubleshooting](../docs/troubleshooting.md#update).

What juice reads, sends and keeps is in [Privacy](../docs/privacy.md).
