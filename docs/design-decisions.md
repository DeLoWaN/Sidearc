# Sidearc: design decisions

Sidearc is a Chrome extension. It shows a vertical panel that mixes saved links and open tabs, like the sidebar of the Arc browser. This file records the decisions taken on 2026-10-30, at the start of the project.

## Terms

Sidearc uses the vocabulary of Arc. Each term below has one meaning in this file.

- **Side panel**: the Chrome area where an extension shows its own page, on the left or right of the window. The user picks the side and the width in Chrome.
- **Favorite**: a saved link shown as an icon at the top of the panel. A profile has 12 Favorites at most.
- **Pinned Tab**: a saved link shown in a tree under the Favorites. A Pinned Tab has a saved URL and a saved title.
- **Folder**: a named group of Pinned Tabs. Folders can contain Folders.
- **Live tab**: the real Chrome tab that belongs to a Favorite or a Pinned Tab. Each Favorite or Pinned Tab has one live tab at most, across all windows.
- **Unpinned Tab**: an open Chrome tab that belongs to no Favorite and no Pinned Tab. The Unpinned Tabs section is also called **Today**.
- **Tab group**: a Chrome tab group, with a title and a colour.
- **Reset**: the action that sends a live tab back to the saved URL of its Pinned Tab or Favorite.
- **Auto Archive**: the automatic closing of an Unpinned Tab after a delay without a visit.
- **View Archive**: the list of tabs that Auto Archive closed. The user can reopen a tab from this list.
- **Tab Handoff**: the move of a tab into the window where the user clicks it.

## Scope

- Sidearc is for one user first. Other people can install it later.
- Sidearc is written from scratch. Arcify was tested and rejected, because its panel has no Folders.
- Version 1 targets Chrome only. The build tool also supports Firefox later.
- Spaces are out of scope. Each Chrome profile has its own Sidearc data. The Arc space "IWD" goes to the Chrome profile "pro", and the Arc space "Perso" goes to the Chrome profile "perso".
- Arc Live Folders and Peek are out of scope.

## Chrome limits accepted

- The horizontal Chrome tab strip stays visible. No extension API can hide it.
- The side panel opens only after a click or a keyboard shortcut, in each window.
- The user sets the side and the width of the side panel.
- No API gives the colour of the Chrome profile theme. The panel colour cannot follow it.

## Panel content

The panel shows, from top to bottom:

1. The Favorites, as a grid of large icons.
2. The Pinned Tabs, as a tree of Folders.
3. A divider with a "Clear" button, which closes all Unpinned Tabs.
4. The Unpinned Tabs of all windows, in the order of the Chrome tab strip. Tab groups show as blocks that the user can collapse.
5. At the bottom: a search field and a button that opens View Archive.

The search filters the Favorites, the Pinned Tabs and the Unpinned Tabs. It does not search the Chrome history.

## Behaviour

### Favorites and Pinned Tabs

- A click on a closed Pinned Tab opens its live tab in the current window.
- A click on a Pinned Tab whose live tab is in another window moves that tab into the current window (Tab Handoff).
- Closing the live tab returns the Pinned Tab to its saved state. The Pinned Tab stays in the tree.
- After a navigation inside the live tab, the panel shows the saved title, a "/", the current page title and a Reset button.
- A link to the same host stays in the live tab.
- A link to another host opens in a new Unpinned Tab. A different subdomain counts as another host: a link from `jira.iwd.io` to `wiki.iwd.io` opens a new tab.
- Only link clicks are checked. Redirects, such as a single sign-on login, stay in the live tab.
- Favorites behave exactly like Pinned Tabs.
- Auto Archive never closes the live tab of a Favorite or a Pinned Tab.

### Unpinned Tabs

- A click on an Unpinned Tab of another window moves the tab into the current window (Tab Handoff).
- A move in the panel also moves the tab in the Chrome tab strip.
- Collapsing a Tab group in the panel collapses it in the Chrome tab strip, and the reverse.

### Tab Handoff

The Chromium source shows that `chrome.tabs.move` moves the same tab object to the other window, with no reload. So a form that is half filled keeps its content.

A manual test confirms this at the start of development. If the test fails, Tab Handoff is removed completely. In that case, a click on a tab in another window focuses that window. Sidearc never decides this at runtime.

### Auto Archive

- An Unpinned Tab closes when nobody has viewed it for the delay. Tabs in a Tab group close too.
- The delay is 12 hours by default. The options page changes it.
- The tab on screen and a tab that plays sound never close.
- A closed tab goes into View Archive. View Archive keeps 30 days of tabs and has its own search.

### Restart

Tab IDs change when Chrome restarts. When Chrome restores the tabs, Sidearc links each restored tab back to its Pinned Tab by URL. A Pinned Tab with no matching tab starts closed.

### Interactions

- Drag and drop between the Favorites, the Pinned Tabs, the Folders and the Unpinned Tabs.
- A tab dropped into the Pinned Tabs or the Favorites becomes a Pinned Tab or a Favorite. It keeps its URL and title, and the tab becomes its live tab.
- A Pinned Tab dragged into the Unpinned Tabs becomes a normal tab, and the Pinned Tab is deleted.
- A right-click menu: rename, Reset, copy URL, delete, and "Move to…". "Move to…" is the keyboard way to move an item, because the drag and drop library has no keyboard support.
- A keyboard shortcut pins the current tab at the root of the Pinned Tabs.
- A Pinned Tab has a delete cross, and a middle click on it deletes it. A middle click on a Favorite or an Unpinned Tab closes its tab.
- An Undo button in the bottom bar reverts the last 20 actions, one at a time: every change of the Folders, Pinned Tabs and Favorites, and the close of an Unpinned Tab from the panel. Ctrl+Z or Cmd+Z does the same while the panel has the focus, because the browser keeps Ctrl+Z for itself elsewhere. The list clears when Chrome restarts.

## Data

- Sidearc keeps its data in `chrome.storage.local`, not in the Chrome bookmarks. Each item keeps its title, URL, Folder, Favorite status and collapsed state in one record.
- The data does not sync between computers. The options page exports and imports a JSON file as a backup.
- On the first run, Sidearc imports one Arc space from Arc's `StorableSidebar.json` file. The user selects the file in a file picker, because an extension cannot read `~/Library`. The import runs once.

## Appearance

- The look follows Arc: a coloured background, rounded rows, large Favorite icons. This is variant A of the prototype.
- The options page sets the background as a free gradient of two colours.
- The options page sets the density: compact, normal or spacious. Normal is the default, between variants A and C of the prototype.
- The panel follows the light or dark mode of the system.
- Any gradient stays readable. In light mode the panel keeps 30% of each chosen colour and adds white. In dark mode it keeps 35% and adds black. A test checks the text contrast on extreme colours.
- Density sets the row height and the Favorite tile size: compact 28 and 36 pixels, normal 32 and 44, spacious 40 and 56.

## Options page

The options page holds:

- the Auto Archive delay,
- the background gradient,
- the density,
- the JSON export and import.

## Technical stack

- WXT 0.21: the build framework for the extension.
- React 19: the UI library.
- Pragmatic drag and drop 4 (Atlassian): the drag and drop library for the tree.
- Zustand: the state store of the panel.
- Tailwind CSS 4: the styling.
- Biome: lint and format.
- TypeScript 7: the type check.
- Vitest with the WXT fake browser: unit tests. The fake browser has no `tabGroups`, so the tests mock it.
- Playwright on its bundled Chromium: end-to-end tests. Playwright cannot drive the real side panel, so it opens the panel page in a normal tab.

The service worker owns Auto Archive (through `chrome.alarms`), Tab Handoff, the link between items and live tabs, and the keyboard shortcut. The panel page rebuilds its view from Chrome each time it opens.

## Permissions

`sidePanel`, `tabs`, `tabGroups`, `storage`, `alarms`, `favicon`, and a content script on all sites to check link clicks in live tabs. The Chrome Web Store reviews the all-sites permission more closely if Sidearc is published.

## Project

- Name: Sidearc.
- Location: `~/git_perso/Sidearc`.
- Hosting: a public GitHub repository.
