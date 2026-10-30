import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    restoreMocks: true,
    // The cache hides files that a glob import finds only after they are added.
    fsModuleCache: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'worker',
          environment: 'node',
          include: [
            'tests/unit/**/*.test.ts',
            'src/background/**/*.test.ts',
            'src/shared/**/*.test.ts',
            'src/link-guard/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'panel',
          environment: 'happy-dom',
          include: [
            'src/**/*.test.tsx',
            'src/panel/**/*.test.ts',
            'src/options/**/*.test.ts',
            'src/fullscreen-guard/**/*.test.ts',
          ],
          setupFiles: ['tests/support/dom-setup.ts'],
        },
      },
    ],
  },
});
