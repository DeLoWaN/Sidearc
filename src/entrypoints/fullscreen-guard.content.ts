import { startFullscreenGuard } from '../fullscreen-guard/guard';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main: startFullscreenGuard,
});
