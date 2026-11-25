# The launcher stands alone, and the plugin-store layout is written more than once

Date: 2026-11-25. Status: accepted.

## Context

Architecture reviews keep flagging that the plugin store's folder layout (`<config>/plugins/cache/<market>/juice/<version>/bin/juice-statusline.js`) and the "turned off in /plugin" rule each appear in more than one module:

- `plugin/bin/launcher.js` builds the path (`resolveTarget`) and reads the turned-off rule (`turnedOff`).
- `plugin/src/launcher-file.js` reads the marketplace out of a juice folder (`marketOf`).
- `plugin/src/install.js` reads the version and marketplace out of a launcher target (`versionOf`, `marketOfTarget`) and works out `off` itself.

## Decision

Keep them as they are.

- `launcher.js` is a template that `/juice setup` copies to `<config>/juice-statusline.mjs`, so it must not import anything from juice. It has to keep running after the plugin folder it came from is replaced or deleted.
- `install.js` works out `off` from the `settings.json` it has already read, so Claude Code's settings are read once per inspection. Calling `turnedOff` would read that file a second time.
- `marketOf` takes a juice folder and handles a symlinked or junctioned plugins folder. `marketOfTarget` takes a launcher target. They read the same layout in opposite directions, and merging them would put the symlink case at risk.

## Consequences

A change to the plugin store's layout has to touch all three modules. `test/install.test.js` and `test/statusline.test.js` cover them.
