import { type ReactNode, useId } from 'react';
import { useEscape } from './use-dismiss';

/**
 * A modal question with a safe answer and a risky one.
 * The safe answer takes the focus, so Enter never confirms by accident. Escape cancels.
 */
export function ConfirmDialog({
  label,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  /** The name of the dialog, for screen readers. */
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The question text. */
  children: ReactNode;
}) {
  const textId = useId();
  useEscape(onCancel);
  const button = 'rounded-md px-3 py-1.5 hover:bg-(--row-hover)';

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/30 p-4">
      <div
        role="alertdialog"
        aria-label={label}
        aria-describedby={textId}
        className="w-full max-w-72 rounded-xl bg-(--menu-bg) p-4 shadow-lg"
      >
        <p id={textId} className="mb-3">
          {children}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            // biome-ignore lint/a11y/noAutofocus: the safe answer takes the focus, so Enter never confirms by accident.
            autoFocus
            className={button}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${button} font-semibold text-red-600`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
