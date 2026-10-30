# Sidearc

Sidearc is a Chrome extension that brings the sidebar of the Arc browser to Chrome. It shows one vertical side panel that mixes saved links (Favorites and Pinned Tabs) with open tabs.

[docs/design-decisions.md](docs/design-decisions.md) records the design decisions, with the terms it uses.

## Commands

Install once with `npm install`. Use npm, not pnpm.

| Command                | What it does                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run build`        | Builds the extension into `.output/chrome-mv3`.                   |
| `npm run dev`          | Starts the WXT dev server.                                        |
| `npm run lint`         | Runs the Biome linter.                                            |
| `npm run format`       | Formats and fixes the code with Biome.                            |
| `npm run format:check` | Checks the format without changing a file.                        |
| `npm run typecheck`    | Checks the types with TypeScript.                                 |
| `npm test`             | Runs the unit and component tests with Vitest.                    |
| `npm run test:e2e`     | Builds the extension, then runs the Playwright tests in Chromium. |

To load the extension in Chrome 141 or later, run `npm run build`, open `chrome://extensions`, turn on developer mode, and load the folder `.output/chrome-mv3` as an unpacked extension.

The first end-to-end test is the Tab Handoff gate (`tests/e2e/00-tab-handoff-gate.spec.ts`). It checks that `chrome.tabs.move` moves a tab to another window without a reload.

## Layout

- `src/background/modules/`: one file per service worker module. Each file default-exports a `WorkerModule`. The folder is loaded by a glob, so a new file starts by itself.
- `src/shared/protocol.ts` and `src/shared/types.ts`: the commands, messages and data types that the worker and its views share.
- `src/panel/sections/` and `src/options/sections/`: one component per section of the page.
- `tests/support/fake-chrome.ts`: a fake of the Chrome tabs, windows, tab group, side panel and port APIs for unit tests.
- Unit tests sit next to the code (`*.test.ts`). End-to-end tests live in `tests/e2e/`.

## License

Copyright (C) 2026 Damien Gustave

Sidearc is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. The SPDX identifier of this license is `GPL-3.0-or-later`.

Sidearc is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

### Name and icon

Additional term under section 7(e) of the GNU GPL version 3: this license grants no right to use the name "Sidearc" or the Sidearc icon. A modified version that you distribute must use another name and another icon.

### Third-party code

The built extension bundles packages under the MIT and Apache-2.0 licenses. The build writes their notices to `THIRD_PARTY_LICENSES.md` at the root of the extension folder.
