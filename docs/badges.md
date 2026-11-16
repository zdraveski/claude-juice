# Badges

[← Back to juice](../README.md)

Badges are small optional extras that show the output of a command you choose. They update about every 30 seconds while you work.

- Add one with `/juice badges add`. juice shows you the command before it adds it.
- See yours, numbered, with `/juice badges list`. It shows the first word of each command; `/juice badges list --show` shows the whole command and asks first.
- Don't put passwords or API keys in a badge command. juice runs it as typed, and the chat can see it.
- Remove the first one with `/juice badges remove 1` (it asks first).
- Only the first line of the output shows, up to 40 characters.
- A command that takes longer than 2 seconds is stopped and keeps its last text.
- The command gets the same details Claude Code gives the status line (the folder, chat and cost).
- A badge runs in the folder Claude Code is working in. A `git` badge there also follows that folder's own git settings, which can start other programs, so take care in a folder someone handed you (a cloned project doesn't bring its settings along).
- Badges are the first thing a narrow window hides.
- On Windows, badge commands run in the Windows command prompt (cmd), not Git Bash, so write them for cmd. cmd's own commands, like `echo`, turn letters such as é into plain ones; programs like `git` show them as they are.

juice only runs badges you added yourself on this computer: each one is approved with a secret that stays on this computer, so a `juice.json` copied from somewhere else never runs anything. `/juice badges list` marks each badge that isn't approved here, including badges added before juice 0.2.5. To approve one, add the same command again with `/juice badges add` (`/juice badges list --show` shows it). It keeps its place in the list. If the list calls a badge a copy of another one, remove that copy instead.
