import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import { LINK_GUARD_ORIGINS } from './src/link-guard/origins';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    // MIT and Apache-2.0 require the notices of bundled packages in the shipped extension.
    // Each WXT build writes this file again, so the last build must bundle every package.
    build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
  }),
  manifest: ({ mode }) => ({
    name: 'Sidesweep',
    description: 'An Arc-like sidebar in the Chrome side panel.',
    minimum_chrome_version: '141',
    permissions: ['sidePanel', 'tabs', 'tabGroups', 'storage', 'alarms', 'favicon', 'scripting'],
    optional_host_permissions: LINK_GUARD_ORIGINS,
    // Playwright cannot answer the permission prompt, so the e2e build grants the web pages at install.
    ...(mode === 'e2e' && { host_permissions: LINK_GUARD_ORIGINS }),
    action: { default_title: 'Open Sidesweep' },
    commands: {
      'open-panel': {
        suggested_key: { default: 'Alt+Shift+S', mac: 'Alt+Shift+S' },
        description: 'Open the Sidesweep panel',
      },
      'pin-current-tab': {
        suggested_key: { default: 'Alt+Shift+P', mac: 'Alt+Shift+P' },
        description: 'Pin the current tab in Sidesweep',
      },
    },
  }),
});
