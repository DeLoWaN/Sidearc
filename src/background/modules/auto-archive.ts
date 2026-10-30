import { closeAndArchive } from '../archiving';
import type { WorkerModule } from '../worker-module';
import { getSettings } from './settings';

const ALARM = 'auto-archive';
const PERIOD_MINUTES = 5;
const HOUR_MS = 3600 * 1000;

async function archiveIdleTabs() {
  const { autoArchiveHours } = await getSettings();
  const idleSince = Date.now() - autoArchiveHours * HOUR_MS;
  await closeAndArchive((tabs) =>
    tabs.filter(
      (tab) =>
        tab.lastAccessed !== undefined &&
        tab.lastAccessed < idleSince &&
        !tab.active &&
        !tab.audible,
    ),
  );
}

const autoArchive: WorkerModule = {
  name: 'auto-archive',
  order: 40,
  start() {
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM) archiveIdleTabs().catch(console.error);
    });

    // Chrome can lose alarms when the browser restarts. A new alarm would restart the countdown.
    browser.alarms
      .get(ALARM)
      .then((existing) => {
        if (!existing) return browser.alarms.create(ALARM, { periodInMinutes: PERIOD_MINUTES });
      })
      .catch(console.error);
  },
};
export default autoArchive;
