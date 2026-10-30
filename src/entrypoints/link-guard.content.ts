import { startLinkGuard } from '../link-guard/guard';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main: startLinkGuard,
});
