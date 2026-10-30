import { Section } from '../Section';
import { useSettings } from '../settings-context';

/** The switch of the place of new tabs. A tab that a link opens keeps the place that Chrome gives it. */
export function NewTabsSection() {
  const { settings, save } = useSettings();
  return (
    <Section title="New tabs">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.newTabsOnTop}
          onChange={(event) => save({ newTabsOnTop: event.target.checked })}
        />
        Open new tabs at the top of the list
      </label>
    </Section>
  );
}
