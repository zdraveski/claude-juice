# juice

A Claude Code status line that shows how much of each plan limit is used, as batteries.

## Language

**Fetched reading**:
The usage juice asks Anthropic for itself, in the background, with the user's Claude login: the Fable limit, plus Session and Weekly to keep idle windows current. Opposite of what Claude Code sends the status line on its own.
_Avoid_: fable cache, Fable reading (it holds more than Fable)

**Install**:
How juice is wired into Claude Code on this computer: whose status line is set, the launcher it runs, and the version that launcher starts. `/juice setup` is the action that changes it.
_Avoid_: setup state, hookup
