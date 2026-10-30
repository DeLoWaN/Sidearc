import { DENSITIES } from '../../shared/settings';
import type { Density } from '../../shared/types';
import { Section } from '../Section';
import { useSettings } from '../settings-context';

const DENSITY_LABELS: Record<Density, string> = {
  compact: 'Compact',
  normal: 'Normal',
  spacious: 'Spacious',
};

/** The panel gradient and the density. This page shows them too, as a preview. */
export function AppearanceSection() {
  const { settings, save } = useSettings();
  return (
    <Section title="Appearance">
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          Gradient start
          <input
            type="color"
            value={settings.gradientFrom}
            onChange={(event) => save({ gradientFrom: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2">
          Gradient end
          <input
            type="color"
            value={settings.gradientTo}
            onChange={(event) => save({ gradientTo: event.target.value })}
          />
        </label>
      </div>
      <fieldset className="mt-4 flex flex-wrap items-center gap-4">
        <legend className="mb-1">Density</legend>
        {DENSITIES.map((density) => (
          <label key={density} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="density"
              checked={settings.density === density}
              onChange={() => save({ density })}
            />
            {DENSITY_LABELS[density]}
          </label>
        ))}
      </fieldset>
    </Section>
  );
}
