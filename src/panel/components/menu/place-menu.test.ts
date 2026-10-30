import { expect, it } from 'vitest';
import { placeMenu } from './place-menu';

const viewport = { width: 300, height: 400 };
const menu = { width: 120, height: 100 };
const point = (x: number, y: number) => ({ left: x, top: y, right: x, bottom: y });

it('opens at the pointer when there is room', () => {
  expect(placeMenu(point(20, 30), menu, viewport)).toMatchObject({ left: 20, top: 30 });
});

it('opens to the left of the pointer near the right edge', () => {
  expect(placeMenu(point(250, 30), menu, viewport)).toMatchObject({ left: 130, top: 30 });
});

it('opens above the pointer near the bottom edge', () => {
  expect(placeMenu(point(20, 380), menu, viewport)).toMatchObject({ left: 20, top: 280 });
});

it('stays inside a narrow panel when the menu fits on neither side', () => {
  const narrow = { width: 130, height: 400 };

  expect(placeMenu(point(60, 30), menu, narrow)).toMatchObject({ left: 6, top: 30 });
});

it('stays inside the panel when the menu is wider or taller than the panel', () => {
  const tiny = { width: 100, height: 60 };

  expect(placeMenu(point(50, 50), menu, tiny)).toEqual({ left: 6, top: 6, maxHeight: 48 });
});

it('puts a submenu beside its entry, on the right first', () => {
  const entry = { left: 10, top: 50, right: 150, bottom: 80 };

  expect(placeMenu(entry, menu, viewport)).toMatchObject({ left: 150, top: 50 });
});

it('puts a submenu on the left of its entry when the right side has no room', () => {
  const entry = { left: 200, top: 50, right: 280, bottom: 80 };

  expect(placeMenu(entry, menu, viewport)).toMatchObject({ left: 80, top: 50 });
});

it('lines up the bottom of a submenu with its entry near the bottom edge', () => {
  const entry = { left: 10, top: 350, right: 150, bottom: 380 };

  expect(placeMenu(entry, menu, viewport)).toMatchObject({ left: 150, top: 280 });
});
