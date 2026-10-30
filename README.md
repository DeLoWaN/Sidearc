# Sidearc

Sidearc is a Chrome extension that brings the sidebar of the Arc browser to Chrome. It shows one vertical side panel that mixes saved links (Favorites and Pinned Tabs) with open tabs.

The project is at an early stage. [docs/design-decisions.md](docs/design-decisions.md) records every decision taken so far, with the terms it uses.

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

Each ticket adds files and rarely edits a shared file.

- `src/background/modules/`: one file per service worker module. Each file default-exports a `WorkerModule`. The folder is loaded by a glob, so a new file starts by itself.
- `src/shared/protocol.ts` and `src/shared/types.ts`: one section per ticket. A ticket edits only its own section.
- `src/panel/sections/` and `src/options/sections/`: one component per section of the page.
- `tests/support/fake-chrome.ts`: a fake of the Chrome tabs, windows, tab group, side panel and port APIs for unit tests.
- Unit tests sit next to the code (`*.test.ts`). End-to-end tests live in `tests/e2e/`.
