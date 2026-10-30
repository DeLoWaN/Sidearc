import { useState } from 'react';

/** The site icon, or the first letter of the title when there is no icon or it does not load. */
export function SiteIcon({ iconUrl, title }: { iconUrl: string; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();

  if (iconUrl && iconUrl !== failedUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className="size-4 shrink-0 rounded-[4px]"
        onError={() => setFailedUrl(iconUrl)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-(--icon-fallback) text-[9px] font-bold"
    >
      {Array.from(title.trim())[0]?.toUpperCase()}
    </span>
  );
}
