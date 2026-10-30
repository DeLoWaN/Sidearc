import { useLayoutEffect } from 'react';
import { appearanceVariables } from '../shared/appearance';
import type { Settings } from '../shared/types';

/** Sets the gradient and density variables of the settings on the root element of the page. */
export function useAppearance({
  density,
  gradientFrom,
  gradientTo,
}: Pick<Settings, 'density' | 'gradientFrom' | 'gradientTo'>) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const variables = appearanceVariables({ density, gradientFrom, gradientTo });
    for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(variables)) root.style.removeProperty(name);
    };
  }, [density, gradientFrom, gradientTo]);
}
