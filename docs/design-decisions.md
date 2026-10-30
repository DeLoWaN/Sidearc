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
- **Site group**: Unpinned Tabs that opened from one another on the same site. Only the Sidearc panel shows it. It is not a Tab group.
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
4. The Unpinned Tabs of all windows, in the order of the Chrome tab strip. Tab groups and site groups show as blocks that the user can collapse.
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
- A tab that the user opens directly (Ctrl+T or Cmd+T, the "+" button, the "New tab" entry of the Chrome menu) goes to the start of the Unpinned Tabs, as in Arc. The panel lists the Unpinned Tabs in tab strip order, so Sidearc moves the tab to the start of the Chrome tab strip. Chrome keeps its own pinned tabs first. The first tab of a new window stays where it is. A tab that a link opens keeps the place that Chrome gives it, next to its opener. The setting "Open new tabs at the top of the list" turns this off. It is on by default.
- When a tab joins the Unpinned Tabs and its row is not fully visible, the panel scrolls to it. The scroll is smooth, and instant for a user who prefers reduced motion. A row that is already fully visible does not scroll. A new tab inside a collapsed group scrolls to the header of the group. The first state that the panel receives, and a drag in progress, never scroll the panel. The panel keeps the new row in view for one second, because a site group of the tab can arrive just after the tab.

### Site groups

A site group is not a Chrome tab group. The Chrome tab strip does not change, nothing syncs with the Google account, and closing a group gives no Chrome warning. The panel and `chrome.storage.session` hold the group, so Chrome keeps it when the service worker restarts and forgets it when Chrome quits.

- A new tab joins a site group when it has an opener, its address is known, and its site equals the site of its opener. The site is the host in lower case without a leading `www.`. Another subdomain is another site.
- Both tabs must be Unpinned Tabs, and neither is in a Tab group. A Tab group wins over a site group.
- When the opener is already in a site group, the new tab joins that group. Otherwise the two tabs form a new group. A tab is in one site group at most.
- A tab leaves its group when it closes, when it becomes the live tab of a Pinned Tab or a Favorite, when it joins a Tab group, and when the user chooses "Remove from group" in its right-click menu. A group with fewer than 2 tabs disappears. A member that navigates to another site stays in the group.
- The panel shows the group as one block at the place of its first member in the tab strip. The block lists all members in tab strip order, even when another tab sits between them. The header is a row of the same height as a tab row. It shows the site icon, the name of the group in bold, a chevron, and the member count while the block is collapsed. The name is the host, unless the user renamed the group. The members sit one indent step (24px) below the header. A click on the header collapses or expands the block. A collapsed header shows the "not visited yet" dot when a hidden member has not been visited. The right-click menu of the header has "Rename group", "Ungroup" and "Close group". A rename is trimmed and limited to 60 characters, and an empty name brings the host back. The name lasts as long as the group.
- A Tab group block has the same layout. Its header shows a dot in the colour of the group in place of the site icon, and the title that Chrome gives the group. Sidearc cannot rename it. Its right-click menu has "Close group" only.
- "Close group" closes every Unpinned Tab of a block, for a Site group and for a Tab group. A live tab of a Pinned Tab or a Favorite that sits in a Tab group stays open. Three controls do it: the entry of the header menu, a cross at the right end of the header that shows on hover or keyboard focus, and a middle click on the header. A search turns the three off, because it shows only some of the members. The tabs do not go to View Archive. One Undo reopens the tabs in their places and builds the group again, with its name and its collapsed state.
- A hover on the header or on a member, or a keyboard focus in the block, shows a faint tint behind the whole block.
- A search expands the groups and lists only the matching members.
- A drag of a member tab works as for any Unpinned Tab. It does not change the membership.
- Tab Handoff keeps the membership when a member moves to another window.
- The option "Group tabs opened from the same site" turns the grouping on or off. It is on by default. When it is off, no new group forms, and the groups that exist stay until a rule above dissolves them or the user removes them.

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

### Selection of rows

The user can act on several rows at once.

- Selectable rows: Unpinned Tabs (also inside Tab groups and site groups), Pinned Tabs and Folders. Favorites and group headers are not selectable.
- A click with Ctrl or Cmd adds a row to the selection, or removes it. On macOS, Ctrl and a click is a right click, so use Cmd. A Ctrl or Cmd click on a Folder does not collapse it.
- A click with Shift selects the rows from the anchor to the clicked row, in the visible order of the panel, and replaces the selection. The anchor is the last row clicked with Ctrl, Cmd or Shift. Rows inside a collapsed Folder or group, group headers and Favorites are not in the range.
- A click without a key does its normal action and ends the selection. Escape ends it too, and so does any command that the panel sends. A search turns the selection off.
- A selected Folder stands for itself and its content. A selected row inside a selected Folder does not count.
- A bar above the footer shows "N selected" and the buttons Close, Move to… and Clear. Delete and Backspace close the selection when no text field has the focus. A right click on a selected row opens a menu with the same two actions. A right click on another row ends the selection and shows the normal menu.
- Close removes the selected Unpinned Tabs and deletes the selected Pinned Tabs and Folders with their content. The live tab of a deleted item stays open as an Unpinned Tab. The panel asks for a confirmation first when a selected Folder is not empty. One Undo reverts the whole close.
- Move takes the selection to one place: the root of the Pinned Tabs or a Folder, the Unpinned Tabs (no Folder in the selection), a Tab group or a site group (Unpinned Tabs only). A drag of a selected row, with a count badge, and Move to… in the bar send the same command. The panel refuses a place that does not fit the whole selection, and changes nothing. The rows keep their visible order in the new place. One Undo reverts the items of the whole move.
- A tab that moves into a site group by hand becomes a member of that group. It leaves its Tab group and its former site group.

### Interactions

- Drag and drop between the Favorites, the Pinned Tabs, the Folders and the Unpinned Tabs.
- A tab dropped into the Pinned Tabs or the Favorites becomes a Pinned Tab or a Favorite. It keeps its URL and title, and the tab becomes its live tab.
- A Pinned Tab dragged into the Unpinned Tabs becomes a normal tab, and the Pinned Tab is deleted.
- A right-click menu: rename, Reset, copy URL, delete, and "Move to…". "Move to…" is the keyboard way to move an item, because the drag and drop library has no keyboard support.
- A keyboard shortcut pins the current tab at the root of the Pinned Tabs.
- A Pinned Tab has a delete cross, and a middle click on it deletes it. A middle click on a Favorite or an Unpinned Tab closes its tab.
- An Undo button in the bottom bar reverts the last 20 actions, one at a time: every change of the Folders, Pinned Tabs and Favorites, the close of an Unpinned Tab from the panel, "Close group", and the close and the move of a selection of rows. Ctrl+Z or Cmd+Z does the same while the panel has the focus, because the browser keeps Ctrl+Z for itself elsewhere. The list clears when Chrome restarts.

## Data

- Sidearc keeps its data in `chrome.storage.local`, not in the Chrome bookmarks. Each item keeps its title, URL, Folder, Favorite status and collapsed state in one record.
- The data does not sync between computers. The options page exports and imports a JSON file as a backup.
- Sidearc imports one Arc space from Arc's `StorableSidebar.json` file. The user selects the file in a file picker, because an extension cannot read `~/Library`. The folder is hidden, so the options page gives the path to paste in the file window (⌘ Shift G) and a button that copies it. A numbered guide in the "Import from Arc" section explains each step.
- The Arc import can run at any time. The "Import from Arc" section is always on the options page, and it comes first while Sidearc is empty.
- The import replaces the Favorites, Pinned Tabs and Folders. It keeps the settings and View Archive. When Sidearc already has items, the page asks for a confirmation first and advises a backup. The import is all-or-nothing: a refused file changes nothing. The Undo button reverts it.
- While Sidearc has no Favorite, no Pinned Tab and no Folder, the panel shows a card with an "Import from Arc" button, which opens the options page, and the shortcut that pins the current tab.

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
- the switch "Group tabs opened from the same site",
- the switch "Open new tabs at the top of the list",
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
