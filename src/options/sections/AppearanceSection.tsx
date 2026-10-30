import { GRADIENT_PRESETS } from '../../shared/gradient-presets';
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
      <div className="mb-3 flex flex-wrap gap-2">
        {GRADIENT_PRESETS.map((preset) => {
          const selected =
            settings.gradientFrom === preset.from && settings.gradientTo === preset.to;
          return (
            <button
              key={preset.name}
              type="button"
              aria-label={preset.name}
              title={preset.name}
              aria-pressed={selected}
              onClick={() => save({ gradientFrom: preset.from, gradientTo: preset.to })}
              style={{ backgroundImage: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
              className="size-8 rounded-full ring-offset-2 ring-offset-(--row-active) aria-pressed:ring-2 aria-pressed:ring-(--text)"
            />
          );
        })}
      </div>
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
