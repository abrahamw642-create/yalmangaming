import { ChevronDown } from "lucide-react";
import type { FaqEntry } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * Accordion FAQ built on `<details>`/`<summary>`.
 *
 * No client component and no JavaScript: the browser gives us the open/close
 * behaviour, keyboard support and — importantly — in-page find still matches
 * text inside a collapsed answer in every current browser.
 *
 * Answers are plain strings rather than nodes on purpose. The same array feeds
 * `faqJsonLd`, and markup that says something different from the visible page
 * is exactly the thing Google penalises.
 */
export function Faq({
  entries,
  className,
}: {
  entries: FaqEntry[];
  className?: string;
}) {
  if (!entries.length) return null;

  return (
    <div className={cn("divide-y divide-[var(--color-line)]", className)}>
      {entries.map((entry) => (
        <details key={entry.question} className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <h3 className="font-display text-base font-semibold text-chrome transition-colors group-hover:text-white">
              {entry.question}
            </h3>
            <ChevronDown
              className="mt-0.5 h-4 w-4 shrink-0 text-ash transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-silver">
            {entry.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
