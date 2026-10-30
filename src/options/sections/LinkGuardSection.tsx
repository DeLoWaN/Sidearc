import { useEffect, useState } from 'react';
import { LINK_GUARD_ORIGINS } from '../../link-guard/origins';
import { Section } from '../Section';

const isGranted = () => browser.permissions.contains({ origins: LINK_GUARD_ORIGINS });

/**
 * The switch of the link guard. The switch is on while Chrome grants Sidesweep access to web pages,
 * so a change in the Chrome settings shows here too.
 */
export function LinkGuardSection() {
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const read = () => {
      isGranted().then(setGranted, () => setGranted(false));
    };
    read();
    browser.permissions.onAdded.addListener(read);
    browser.permissions.onRemoved.addListener(read);
    return () => {
      browser.permissions.onAdded.removeListener(read);
      browser.permissions.onRemoved.removeListener(read);
    };
  }, []);

  const change = (on: boolean) => {
    setError(undefined);
    // Chrome shows its prompt only during the click, so nothing may wait before the request.
    const done = on
      ? browser.permissions.request({ origins: LINK_GUARD_ORIGINS })
      : browser.permissions.remove({ origins: LINK_GUARD_ORIGINS });
    done.then(
      () => isGranted().then(setGranted),
      (failure: unknown) =>
        setError(
          `Chrome refused the change: ${failure instanceof Error ? failure.message : String(failure)}`,
        ),
    );
  };

  return (
    <Section title="Link guard">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={granted}
          onChange={(event) => change(event.target.checked)}
        />
        Open links to other sites in a new tab
      </label>
      <p className="mt-2 text-xs text-(--text-muted)">
        In the live tab of a Favorite or a Pinned Tab, a link to another site opens in a new tab, so
        the live tab stays on its site. Chrome asks for access to all websites. Sidesweep uses it
        only to check link clicks in live tabs.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-(--g-red)">
          {error}
        </p>
      )}
    </Section>
  );
}
