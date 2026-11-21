# Badges

[juice](../README.md) · [Guide](guide.md) · [Commands](commands.md) · [FAQ](faq.md) · [Badges](badges.md) · [Troubleshooting](troubleshooting.md) · [Privacy](privacy.md)

A badge shows the output of a command you choose, at the end of the status line. For example:

```
/juice badges add 'git branch --show-current'
```

juice shows you the command first, then adds it. The current branch name then shows in your status line.

Badges are optional. They update about every 30 seconds while you work.

## Add, list and remove

- Add one with `/juice badges add`.
- See yours, numbered, with `/juice badges list`. It shows the first word of each command. `/juice badges list --show` shows the whole command and asks first.
- Remove the first one with `/juice badges remove 1`. It asks first.

Don't put passwords or API keys in a badge command. juice runs it as typed, and the chat can see it.

## Limits

- Only the first line of the output shows, up to 40 characters.
- A command that takes longer than 2 seconds is stopped. It keeps its last text.
- The command gets the same details Claude Code gives the status line: the folder, chat and cost.
- A badge runs in the folder Claude Code is working in. A `git` badge there also follows that folder's own git settings, which can start other programs. Take care in a folder someone handed you. A cloned project does not bring its settings along.
- Badges are the first thing a narrow window hides.

## Environment variables

A badge command sees only the basics a shell and everyday programs need, such as `PATH`, your home folder, the temp folder, the language, your `CLAUDE_CONFIG_DIR` and certificate paths.

Keys and tokens your terminal holds stay out, like `ANTHROPIC_API_KEY` or `GITHUB_TOKEN`. So do proxy addresses (`HTTPS_PROXY`), because they can hold a password.

If a badge needs one, name it when you add the badge:

```
/juice badges add 'aws sts get-caller-identity --query Account' --env AWS_PROFILE
```

| You need | Do this |
|---|---|
| Several variables | Join them with commas and no spaces: `--env HTTPS_PROXY,HTTP_PROXY` |
| A `gh` badge | Nothing, if you signed in with `gh auth login`. Add `--env GH_TOKEN` only if you sign in with that variable. |
| A `git` badge over ssh | `--env SSH_AUTH_SOCK` |
| To change the list | Add the same command again with the new list, or without `--env` to take them away |

Only that badge sees the variable. `/juice badges list` shows the names, never the values.

## On Windows

Badge commands run in the Windows command prompt (cmd), not Git Bash, so write them for cmd. The single quotes around the whole command stay. Inside it, use double quotes, because cmd has no single quotes:

```
/juice badges add 'node -p "process.version"'
```

cmd's own commands, like `echo`, turn letters such as e with an accent into plain ones. Programs like `git` show them as they are.

## Badges only run where you added them

Badges run only on the computer where you added them. If you copy `juice.json` somewhere else, add each badge again there.

`/juice badges list` marks every badge that is not approved on this computer. To approve one, add the same command again. It keeps its place in the list. If the list calls a badge a copy of another one, remove that copy instead.

Questions? See the [FAQ](faq.md) or [Privacy](privacy.md).
