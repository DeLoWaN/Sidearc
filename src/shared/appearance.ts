import type { Density, Settings } from './types';

/**
 * Sizes of each density, in pixels. Variant A of the prototype has rows of 36 and tiles of 52,
 * variant C has rows of 26 and tiles of 30: the normal density sits between them.
 */
export const DENSITY_SIZES: Record<Density, { rowHeight: number; favoriteSize: number }> = {
  compact: { rowHeight: 28, favoriteSize: 36 },
  normal: { rowHeight: 32, favoriteSize: 44 },
  spacious: { rowHeight: 40, favoriteSize: 56 },
};

/**
 * Readability rule: the panel never shows a gradient colour as it is.
 * In light mode it keeps 30% of the colour and adds white. In dark mode it keeps 35% and adds black.
 * So the text colours of app.css keep their contrast on any colour: appearance.test.ts checks it.
 */
const KEEP_PERCENT = { light: 30, dark: 35 };
const SCRIM = { light: 255, dark: 0 };

function mix(hex: string, scheme: 'light' | 'dark') {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16);
    const mixed = Math.round(
      (KEEP_PERCENT[scheme] * value + (100 - KEEP_PERCENT[scheme]) * SCRIM[scheme]) / 100,
    );
    return mixed.toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/** The CSS variables that the settings set on the root element of a page. */
export function appearanceVariables(
  settings: Pick<Settings, 'density' | 'gradientFrom' | 'gradientTo'>,
): Record<string, string> {
  const { rowHeight, favoriteSize } = DENSITY_SIZES[settings.density];
  return {
    '--row-height': `${rowHeight}px`,
    '--favorite-size': `${favoriteSize}px`,
    '--panel-from-light': mix(settings.gradientFrom, 'light'),
    '--panel-to-light': mix(settings.gradientTo, 'light'),
    '--panel-from-dark': mix(settings.gradientFrom, 'dark'),
    '--panel-to-dark': mix(settings.gradientTo, 'dark'),
  };
}
