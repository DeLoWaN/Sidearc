import { Section } from '../Section';
import { useSettings } from '../settings-context';

/** The switch of site groups. Turning it off keeps the groups that exist. */
export function SiteGroupsSection() {
  const { settings, save } = useSettings();
  return (
    <Section title="Site groups">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.groupBySite}
          onChange={(event) => save({ groupBySite: event.target.checked })}
        />
        Group tabs opened from the same site
      </label>
    </Section>
  );
}
