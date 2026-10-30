import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { appearanceVariables } from './appearance';
import type { Density } from './types';

const look = (density: Density, gradientFrom = '#b9a7f0', gradientTo = '#a7c4f0') =>
  appearanceVariables({ density, gradientFrom, gradientTo });

it.each([
  ['compact', '28px', '36px'],
  ['normal', '32px', '44px'],
  ['spacious', '40px', '56px'],
] as const)('sets the row height and the Favorite size of the %s density', (density, row, tile) => {
  expect(look(density)).toMatchObject({ '--row-height': row, '--favorite-size': tile });
});

it('puts the normal density between variants A and C of the prototype', () => {
  // Variant A: rows of 36px, Favorite tiles of 52px. Variant C: rows of 26px, tiles of 30px.
  const normal = look('normal');
  const row = Number.parseInt(normal['--row-height'] as string, 10);
  const tile = Number.parseInt(normal['--favorite-size'] as string, 10);
  expect(row).toBeGreaterThan(26);
  expect(row).toBeLessThan(36);
  expect(tile).toBeGreaterThan(30);
  expect(tile).toBeLessThan(52);
});

it('mixes each colour with white in light mode and with black in dark mode', () => {
  expect(look('normal', '#000000', '#ffffff')).toMatchObject({
    '--panel-from-light': '#b3b3b3',
    '--panel-to-light': '#ffffff',
    '--panel-from-dark': '#000000',
    '--panel-to-dark': '#595959',
  });
});

it('keeps the hue of the chosen colours', () => {
  const blue = look('normal', '#0000ff', '#ff0000');
  expect(blue['--panel-from-light']).toBe('#b3b3ff');
  expect(blue['--panel-to-light']).toBe('#ffb3b3');
  expect(blue['--panel-from-dark']).toBe('#000059');
  expect(blue['--panel-to-dark']).toBe('#590000');
});

// --- readability: the text colours come from app.css, the contrast formula from WCAG 2

const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const [lightTokens = '', darkTokens = ''] = css.split('@media (prefers-color-scheme: dark)');
const token = (block: string, name: string) =>
  new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1] as string;

const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const EXTREMES = [
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#808080',
];

it.each(EXTREMES)('keeps the text readable on a gradient that holds %s', (colour) => {
  const vars = look('normal', colour, colour);
  for (const [scheme, tokens] of [
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as const) {
    for (const end of ['from', 'to'] as const) {
      const background = vars[`--panel-${end}-${scheme}`] as string;
      expect(contrast(background, token(tokens, 'text'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(background, token(tokens, 'text-muted'))).toBeGreaterThanOrEqual(3);
    }
  }
});
