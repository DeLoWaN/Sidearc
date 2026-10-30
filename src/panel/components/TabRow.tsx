import type { TabView } from '../../shared/types';
import { usePanel } from '../panel-context';
import { SiteIcon } from './SiteIcon';

/** One open tab. A click shows the tab, the close button closes it. */
export function TabRow({ tab, highlighted }: { tab: TabView; highlighted: boolean }) {
  const { send } = usePanel();
  return (
    <li
      data-highlighted={highlighted || undefined}
      className="group flex h-(--row-height) items-center rounded-[10px] hover:bg-(--row-hover) data-highlighted:bg-(--row-active) data-highlighted:shadow-sm"
    >
      <button
        type="button"
        aria-current={highlighted || undefined}
        onClick={() => send({ type: 'tab/activate', tabId: tab.id })}
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-left"
      >
        <SiteIcon iconUrl={tab.iconUrl} title={tab.title} />
        <span className="truncate">{tab.title}</span>
      </button>
      <button
        type="button"
        aria-label={`Close ${tab.title}`}
        onClick={() => send({ type: 'tab/close', tabId: tab.id })}
        className="mr-2 grid size-5 shrink-0 place-items-center rounded-md text-(--text-muted) opacity-0 hover:bg-(--row-hover) focus-visible:opacity-100 group-hover:opacity-100"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
        </svg>
      </button>
    </li>
  );
}
