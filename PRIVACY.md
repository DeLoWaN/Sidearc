# Sidesweep privacy policy

Last update: 2026-10-30

Sidesweep is a Chrome extension that shows the sidebar of the Arc browser in the Chrome side panel. This page tells you which data Sidesweep reads, where it keeps that data, and who can see it.

In short: Sidesweep keeps all its data in your browser. It sends no data to Damien Gustave, to Google, or to any other person or server.

## Data that Sidesweep reads

- **Your open tabs.** Sidesweep reads the title, the address (URL) and the icon of each tab, and the Chrome tab groups. It needs them to show your tabs in the panel.
- **Link clicks in live tabs.** A live tab is the real Chrome tab that belongs to a saved link (a Favorite or a Pinned Tab). This feature, the link guard, is off until you turn it on in the options page. Chrome then asks you to give Sidesweep access to all websites. While the link guard is on, a small Sidesweep script in each page waits for a click on a link. When the page is a live tab and the link goes to another site, the script sends the address of the link to Sidesweep, and Sidesweep opens it in a new tab. The script reads nothing else in the page.
- **The Arc file that you select.** When you import from Arc, Sidesweep reads the file `StorableSidebar.json` that you select in the file window. It keeps the saved links of one Arc space and ignores the rest of the file.

## Where Sidesweep keeps your data

Sidesweep keeps its data in the extension storage of Chrome, on your computer:

- **Local storage** keeps your Favorites, Pinned Tabs, Folders and settings. It also keeps View Archive: the title, address and icon of each tab that Sidesweep closed automatically. View Archive removes a tab after 30 days.
- **Session storage** keeps the state of your open tabs, for example the Site groups and the log of the Troubleshooting section. Chrome clears it when it quits.

Sidesweep does not use the Chrome sync storage. Your data does not go to other computers.

## Data that leaves your browser

None. Sidesweep makes no network request. It has no analytics, no advertising, no tracking and no code from a remote server.

Two actions put data outside the extension, and only when you ask for them:

- **Export backup** saves your data to a JSON file on your computer, at the place that you choose.
- **Copy URL** and the other copy buttons put text in your clipboard.

## How to remove your data

Remove Sidesweep from `chrome://extensions`. Chrome then deletes all the data of the extension. A backup file that you exported stays on your computer until you delete it.

## Changes and contact

When this policy changes, the date at the top changes too. The history of this file is in the [Sidesweep repository](https://github.com/DeLoWaN/Sidesweep/commits/main/PRIVACY.md).

For a question, open an issue in the [Sidesweep repository](https://github.com/DeLoWaN/Sidesweep/issues).
