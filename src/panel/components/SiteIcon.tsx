import { useState } from 'react';

/** The site icon, or the first letter of the title when there is no icon or it does not load. */
export function SiteIcon({
  iconUrl,
  title,
  large = false,
}: {
  iconUrl: string;
  title: string;
  /** The size of a Favorite tile. A row uses the small size. */
  large?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const size = large ? 'size-6 rounded-md' : 'size-4 rounded-[4px]';

  if (iconUrl && iconUrl !== failedUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={`${size} shrink-0`}
        onError={() => setFailedUrl(iconUrl)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${size} grid shrink-0 place-items-center bg-(--icon-fallback) font-bold ${large ? 'text-xs' : 'text-[9px]'}`}
    >
      {Array.from(title.trim())[0]?.toUpperCase()}
    </span>
  );
}
