/** Helpers for code that checks data from outside: settings, backup files and Arc files. */

/** The result of a check that failed, with the text for the user. */
export type Fail = { ok: false; error: string };

export const fail = (error: string): Fail => ({ ok: false, error });

/** True for a plain object. An array and null are not plain objects. */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Writes a value for an error text: JSON when it has one, else the string form. */
export const show = (value: unknown) => JSON.stringify(value) ?? String(value);
