export interface GradientPreset {
  name: string;
  /** Lower case colour like #rrggbb: the form that the settings store. */
  from: string;
  to: string;
}

/** The first preset is the default gradient. */
export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { name: 'Lavender', from: '#b9a7f0', to: '#a7c4f0' },
  { name: 'Ocean', from: '#8fd3f4', to: '#84a9f0' },
  { name: 'Sunset', from: '#f7b28c', to: '#f08fb0' },
  { name: 'Forest', from: '#9bd3a8', to: '#6fb5a0' },
  { name: 'Rose', from: '#f2a6c8', to: '#d9a3f0' },
  { name: 'Sand', from: '#e8d3a0', to: '#d9b8a0' },
  { name: 'Slate', from: '#a9b6c8', to: '#8e9bb5' },
  { name: 'Midnight', from: '#5b6fb5', to: '#3c3f7a' },
];
