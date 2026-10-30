import { useRef } from 'react';

/**
 * A one-line field for a title. Enter and the loss of focus send the title, Escape sends nothing.
 * `onDone` runs once when the edit ends, with the trimmed title or undefined when the user cancelled.
 * A blank title counts as cancelled, unless `allowEmpty` is set: then it ends the edit with an empty string.
 */
export function TitleField({
  label,
  initial = '',
  allowEmpty = false,
  onDone,
}: {
  label: string;
  initial?: string;
  allowEmpty?: boolean;
  onDone: (title: string | undefined) => void;
}) {
  const finished = useRef(false);

  // Enter and the loss of focus both end the edit: the first one wins.
  const finish = (value: string, save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const title = value.trim();
    onDone(save && (title || allowEmpty) ? title : undefined);
  };

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the user just chose to edit, the field must take the keys.
      autoFocus
      aria-label={label}
      defaultValue={initial}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => finish(event.currentTarget.value, true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish(event.currentTarget.value, true);
        if (event.key === 'Escape') finish(event.currentTarget.value, false);
      }}
      className="min-w-0 flex-1 rounded-md bg-(--row-active) px-1.5 py-0.5 outline-none"
    />
  );
}
