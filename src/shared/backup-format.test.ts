import { expect, it } from 'vitest';
import { backupFileName } from './backup-format';

it('names the backup file after the local date of the export', () => {
  expect(backupFileName(new Date(2026, 2, 5, 23, 59))).toBe('sidesweep-backup-2026-03-05.json');
  expect(backupFileName(new Date(2026, 11, 31, 0, 0))).toBe('sidesweep-backup-2026-12-31.json');
});
