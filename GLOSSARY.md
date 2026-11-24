# juice

A Claude Code status line that shows how much of each plan limit is used, as batteries.

## Language

**Fetched reading**:
The usage juice asks Anthropic for itself, in the background, with the user's Claude login: the Fable limit, plus Session and Weekly to keep idle windows current. Opposite of what Claude Code sends the status line on its own.
_Avoid_: fable cache, Fable reading (it holds more than Fable)
