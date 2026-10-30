# Sidearc

Sidearc is a Chrome extension that shows the Arc sidebar in the Chrome side panel. This glossary holds the terms of the tab groups and the tab marks. The other terms (Favorite, Pinned Tab, Folder, Live tab, Unpinned Tab, Reset, Auto Archive, View Archive, Tab Handoff) are defined in [docs/design-decisions.md](docs/design-decisions.md).

## Language

**Tab group**:
A Chrome tab group, with a title and a colour. Chrome shows it in the tab strip and synchronises it with the Google account.
_Avoid_: Group (alone), site group

**Site group**:
A set of two or more Unpinned Tabs of the same site, opened from each other. Only the Sidearc panel shows it. Chrome does not know it.
_Avoid_: Group (alone), Tab group, topic group

**Unvisited tab**:
An Unpinned Tab that Chrome opened in the background from another tab, and that the user has not made active yet.
_Avoid_: Unread tab, new tab
