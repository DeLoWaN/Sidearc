# Chrome Web Store listing

This file holds the text and the images to paste into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) for Sidesweep. The dashboard is the Google site where a developer uploads an extension and fills its store page. Each section below matches one tab of the dashboard.

## Package

1. Run `npm run zip`. WXT, the build tool of Sidesweep, writes `.output/sidesweep-<version>-chrome.zip`.
2. Upload this ZIP file in the **Package** tab.

Before each release, increase `version` in `package.json`. The store refuses a version that it already has.

## Store listing tab

**Name** (from the manifest): Sidesweep

**Summary** (from the manifest, 132 characters at most): An Arc-like sidebar in the Chrome side panel.

**Category**: Workflow & Planning

**Language**: English

**Description**:

```text
Sidesweep brings the sidebar of the Arc browser to Chrome. It shows one vertical list in the Chrome side panel. The list mixes your saved links with your open tabs.

FAVORITES AND PINNED TABS
• Favorites show as large icons at the top of the panel.
• Pinned Tabs are saved links in a tree of Folders.
• Each saved link opens one real tab. Reset sends the tab back to the saved address.

YOUR OPEN TABS
• The Today section lists the open tabs of all your windows, in the order of the tab strip.
• Chrome tab groups show as blocks that you can collapse.
• Tabs that you open from one another on the same site form a Site group.
• A click on a tab of another window moves the tab into your window. The tab does not reload.

LESS CLUTTER
• Auto Archive closes a tab that you did not view for 12 hours. You can change the delay.
• View Archive keeps the closed tabs for 30 days, so you can reopen them.
• Search, multi-select, drag and drop, and Undo work in the whole panel.

MOVE FROM ARC
• Import one Arc space from the StorableSidebar.json file of Arc.
• Export and import your data as a JSON backup.

PRIVATE
Sidesweep keeps all its data in your browser. It makes no network request and collects no data.

Keyboard shortcuts: Alt+Shift+S opens the panel. Alt+Shift+P pins the current tab.

Sidesweep is free software under the GPL-3.0-or-later license. Source code: https://github.com/DeLoWaN/Sidesweep
```

**Images**: upload the files of `docs/store/`:

| Dashboard field  | File                                                                          | Size     |
| ---------------- | ----------------------------------------------------------------------------- | -------- |
| Store icon       | `public/icon/128.png`                                                         | 128×128  |
| Screenshots      | `screenshot-1-panel.png`, `screenshot-2-dark.png`, `screenshot-3-options.png` | 1280×800 |
| Small promo tile | `promo-small.png`                                                             | 440×280  |

**Homepage URL**: https://github.com/DeLoWaN/Sidesweep

**Support URL**: https://github.com/DeLoWaN/Sidesweep/issues

## Privacy tab

**Single purpose**:

```text
Sidesweep shows the user's saved links and open tabs as one vertical sidebar in the Chrome side panel, as the Arc browser does.
```

**Permission justifications**:

| Permission                                   | Justification                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidePanel`                                  | Sidesweep shows its sidebar in the Chrome side panel.                                                                                                                                                                                                                                  |
| `tabs`                                       | The sidebar lists the open tabs with their titles and addresses, and opens, moves, activates and closes tabs when the user asks.                                                                                                                                                       |
| `tabGroups`                                  | The sidebar shows Chrome tab groups, and moves or collapses a group when the user does it in the sidebar.                                                                                                                                                                              |
| `storage`                                    | Sidesweep keeps the saved links, Folders, settings and the list of archived tabs on the device.                                                                                                                                                                                        |
| `alarms`                                     | Auto Archive checks on a timer for tabs that the user did not view for the delay that the user chose.                                                                                                                                                                                  |
| `favicon`                                    | The sidebar shows the icon of each saved link from the Chrome icon cache, with no network request.                                                                                                                                                                                     |
| Host permission (content script on all URLs) | In a tab that belongs to a saved link, a click on a link to another site opens in a new tab. The script only reads the address of the clicked link. A second script closes the side panel while the page shows a video in fullscreen. It only reads whether the page is in fullscreen. |

**Remote code**: No, I am not using remote code.

**Data usage**: the store asks to declare user data even when it stays on the device ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)). Tick these two data types:

- **Web history**: Sidesweep reads the titles and addresses of open tabs, and View Archive keeps them for 30 days.
- **User activity**: the link guard script listens to clicks on links in live tabs.

Sidesweep sends none of this data off the device.

Tick the three certifications: no sale of data, no use unrelated to the single purpose, no use for credit decisions.

**Privacy policy URL**: https://github.com/DeLoWaN/Sidesweep/blob/main/PRIVACY.md

## Distribution tab

**Visibility**: Public, or Unlisted for a first test. An unlisted item has a store page, but only people with the link find it.

## Review

The content script on all sites asks for access to every site. The store reviews such an extension more closely, so the first review can take several days.
