# Sidesweep is licensed under GPL-3.0-or-later

Sidesweep is released under the GNU General Public License, version 3 or any later version (GPL-3.0-or-later). The GPL is a copyleft license: anyone who distributes a modified copy must publish its source under the same license. We chose it over MIT so that every fork of Sidesweep stays open source. Sidesweep has no paid version planned, so the GPL costs us nothing.

## Considered Options

- **MIT**: a permissive license. It allows a closed fork, and a fork that someone sells. We rejected it because a closed fork is the one reuse we want to prevent.
- **MPL-2.0**: a copyleft that applies file by file. A fork must publish changes to our files, but can add closed files. We rejected it because a fork could still close most of its code.
- **GPL-2.0**: rejected because it is incompatible with Apache-2.0, the license of `@atlaskit/pragmatic-drag-and-drop`.
- **AGPL-3.0**: the GPL with one more rule for software that runs on a server. Sidesweep has no server, so it adds nothing.

## Consequences

- Outside contributions come in without a contributor agreement. Each contributor keeps the copyright on their code, so a later move to a license that is not compatible with the GPL needs the consent of every contributor. "or-later" lets a future GPL version apply without that consent.
- The GPL does not stop a clone on the Chrome Web Store: a clone that publishes its source is legal. Only the name can block a clone. The README adds a section 7(e) term that keeps the name "Sidesweep" and its icon out of the license.
