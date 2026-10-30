import { startLinkGuard } from '../link-guard/guard';

// The worker registers this script once the user grants access to web pages.
export default defineContentScript({
  registration: 'runtime',
  main: startLinkGuard,
});
