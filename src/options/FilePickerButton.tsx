import { useRef } from 'react';

/**
 * A button that opens the file picker. The file input is hidden: the button is the control.
 * The input keeps its `inputLabel`, so a test or a script can still set its file.
 * It forgets the file at once, so choosing the same file twice calls `onFile` twice.
 */
export function FilePickerButton({
  buttonLabel,
  inputLabel,
  accept,
  className,
  onFile,
}: {
  buttonLabel: string;
  inputLabel: string;
  accept: string;
  className: string;
  onFile(file: File): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {buttonLabel}
      </button>
      <input
        ref={input}
        type="file"
        aria-label={inputLabel}
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
