## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues of DeLoWaN/Sidesweep, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Release

A release ships one version of the extension as a GitHub release of DeLoWaN/Sidesweep.

1. In the PR of the change, raise `version` in `package.json` and the two `version` fields at the top of `package-lock.json`. A feature raises the minor number. A fix raises the patch number.
2. Merge the PR into `main`.
3. Check out the merge commit on `main` and run `npm run zip`. It writes `.output/sidesweep-<version>-chrome.zip`.
4. Run `gh release create v<version> --repo DeLoWaN/Sidesweep --target <merge commit>` with the ZIP and short notes. The tag always marks a commit of `main`.

The Chrome Web Store upload follows `docs/store/listing.md`.
