import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type Crumb = { label: string; href?: string };

/**
 * Хлебные крошки для иерархии Клиент › Договор › Объект (п.10 навигации).
 * Последний элемент — текущая страница (без ссылки). Промежуточные с href — кликабельны.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Навигация по разделам"
      className="flex items-center gap-1 text-xs text-content-muted flex-wrap"
    >
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {it.href && !isLast ? (
              <Link href={it.href} className="hover:text-neon-orange truncate max-w-[16rem]">
                {it.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? 'text-content-secondary truncate max-w-[22rem]'
                    : 'truncate max-w-[16rem]'
                }
              >
                {it.label}
              </span>
            )}
            {!isLast && <ChevronRight className="w-3 h-3 shrink-0 opacity-60" />}
          </span>
        );
      })}
    </nav>
  );
}
