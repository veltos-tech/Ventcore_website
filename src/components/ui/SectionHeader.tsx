import { cn } from "@/lib/cn";
import { typo } from "@/lib/typography";

type SectionHeaderProps = {
  /** Серая надпись-рубрика в первой колонке сетки */
  label: string;
  /** Заголовок секции; если не задан, заголовком становится рубрика */
  title?: string;
  id?: string;
  className?: string;
};

// Шапка секции: на мобильных рубрика слева, заголовок справа;
// на десктопе — рубрика в 1-й колонке, заголовок со 2-й колонки сетки.
export function SectionHeader({ label, title, id, className }: SectionHeaderProps) {
  const labelClass = "font-display text-xl font-medium text-muted lg:text-[22px]";

  if (!title) {
    return (
      <h2 id={id} className={cn(labelClass, className)}>
        {label}
      </h2>
    );
  }

  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 lg:grid lg:grid-cols-4 lg:gap-2.5",
        className,
      )}
    >
      <p className={labelClass}>{label}</p>
      <h2
        id={id}
        className="text-right font-display text-xl font-semibold text-navy lg:col-span-3 lg:text-left lg:text-[22px]"
      >
        {typo(title)}
      </h2>
    </div>
  );
}
