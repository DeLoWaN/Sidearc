/** Writes a count with its noun: "1 Folder", "2 Folders". `many` replaces the default plural, the noun and an "s". */
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
