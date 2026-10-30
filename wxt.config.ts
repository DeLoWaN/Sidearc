import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    // MIT and Apache-2.0 require the notices of bundled packages in the shipped extension.
    // Each WXT build writes this file again, so the last build must bundle every package.
    build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
  }),
  manifest: {
    name: 'Sidearc',
    description: 'An Arc-like sidebar in the Chrome side panel.',
    minimum_chrome_version: '141',
    permissions: ['sidePanel', 'tabs', 'tabGroups', 'storage', 'alarms', 'favicon'],
    action: { default_title: 'Open Sidearc' },
    commands: {
      'open-panel': {
        suggested_key: { default: 'Alt+Shift+S', mac: 'Alt+Shift+S' },
        description: 'Open the Sidearc panel',
      },
      'pin-current-tab': {
        suggested_key: { default: 'Alt+Shift+P', mac: 'Alt+Shift+P' },
        description: 'Pin the current tab in Sidearc',
      },
    },
  },
});
