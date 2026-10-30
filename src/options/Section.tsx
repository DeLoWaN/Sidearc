import { type ReactNode, useId } from 'react';

/** One block of the options page: a title and the controls of one topic. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-4 rounded-[12px] bg-(--row-active) p-4">
      <h2 id={titleId} className="mb-3 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
