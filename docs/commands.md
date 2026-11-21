# Commands

[juice](../README.md) · [Guide](guide.md) · [Commands](commands.md) · [FAQ](faq.md) · [Badges](badges.md) · [Troubleshooting](troubleshooting.md) · [Privacy](privacy.md)

Type `/juice` in Claude Code, then a command or plain words. `/juice` is a Claude skill: Claude reads what follows, runs juice's local script and tells you what changed. That is one short chat turn, so it uses a little of your limits. The status line itself is a plain script and uses none. Badge changes ask you first. `/juice restore` puts your old status line back.

## Commands

| Command | What it does | Example |
|:---|:---|:---|
| `/juice` | Shows what is set and offers a look, the customizer or setup. | `/juice` |
| `/juice get` | Shows your current settings. | `/juice get` |
| `/juice looks` | Lists the 15 looks, numbered, with a preview of each. | `/juice looks` |
| `/juice look <number>` | Switches to that look. | `/juice look 7` |
| `/juice set key=value` | Changes one or more settings (see the next table). | `/juice set layout=panel colors=ocean` |
| `/juice customize` | Opens the live customizer with your current settings. | `/juice customize` |
| `/juice setup` | Makes juice your status line. It saves a copy of your current one first. | `/juice setup` |
| `/juice restore` | Puts your old status line back. | `/juice restore` |
| `/juice doctor` | Checks Node, your settings and what could hide the line, and says what to fix. | `/juice doctor` |
| `/juice badges list` | Lists your badges. `--show` prints the full commands. | `/juice badges list` |
| `/juice badges add` | Adds a badge. It shows the command and asks first. | `/juice badges add 'git branch --show-current'` |
| `/juice badges remove <number>` | Removes a badge. It asks first. | `/juice badges remove 1` |

In plain words, the same things work: `/juice use the quiet look`, `/juice hide the cost`, `/juice my terminal is light`. Badges are covered in [Badges](badges.md).

## Settings

Each row is one `key=value` for `/juice set`. The default is first.

| Key | Values | Example |
|:---|:---|:---|
| `layout` | `bar` (default), `segments`, `focus`, `panel`, `pills`, `tank` | `/juice set layout=pills` |
| `show` | A comma list, in order, from `model`, `effort`, `memory`, `session`, `fable`, `week`, `budget` | `/juice set show=model,session,week` |
| `order` | `yours` (default), `urgent`, `fullest` | `/juice set order=urgent` |
| `cost` | `auto` (default), `on`, `off` | `/juice set cost=off` |
| `look` | ([pictures and notes](guide.md#ready-made-looks)) `juice`, `basics`, `spotlight`, `everything`, `retro`, `quiet`, `nightowl`, `easy`, `colorblind`, `anywhere`, `costwatch`, `fablefirst`, `capsule`, `roadtrip`, `sand` | `/juice set look=quiet` |
| `colors` | ([colour sets](guide.md#colour-sets)) `claude` (default), `frost`, `calm`, `safe`, `bold`, `ocean`, `midnight`, `vampire`, `candy`, `forest`, `sunset`, `solar`, `rose`, `terminal`, or your own | `/juice set colors=ocean` |
| `ends` | `auto` (default), `round`, `plain` | `/juice set ends=plain` |
| `battery` | `glossy` (default), `classic`, `outline`, `hot`, `liquid`, `pace`, `pie`, `sand`, `slider`, `race`, `lives`, `dots`, `chevrons`, `ruler` | `/juice set battery=outline` |
| `terminal` | `auto` (default), `dark`, `light` | `/juice set terminal=light` |
| `truecolor` | `auto` (default), `on`, `off` | `/juice set truecolor=on` |
| `refills` | `always` (default), `warnings` (reset times only when something needs you) | `/juice set refills=warnings` |
| `motion` | `off` (default), `on` | `/juice set motion=on` |
| `fable` | `auto` (default), `on`, `off` | `/juice set fable=on` |

Notes:

- `look` sets layout, show, order, colors, cost, refills and ends in one go. Put other keys after it. See the [guide](guide.md#ready-made-looks).
- `layout` names: `pills` is Capsules, `tank` is Fuel tank, `focus` is Tightest first, `segments` is Classic segments.
- `show` uses `week` for Weekly.
- The setting is spelled `colors`. The text elsewhere says colours.
- `colors` of your own: `dark:#rrggbb,#rrggbb,#rrggbb,#rrggbb/light:#rrggbb,#rrggbb,#rrggbb,#rrggbb`. The four colours are plenty left, going fast, almost empty, accent. juice saves what you type and warns when one is hard to read.
- `fable=on` reads your Claude login. See [Privacy](privacy.md). Only you can turn it on, with `/juice set`. A shared customizer link never does.
- Battery styles draw only in the `bar` and `focus` layouts.
- `truecolor` forces full colour on or off for terminals that report it wrongly.
- `/juice set` with a value juice cannot use changes nothing and says why.
