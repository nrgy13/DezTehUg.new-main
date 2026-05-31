import { cn } from '@/lib/utils';

/**
 * Единый заголовок страницы CRM. Раньше h1 верстались вручную с разнобоем
 * размеров (admin text-3xl, manager text-2xl, master адаптивный). Теперь —
 * один адаптивный размер (text-2xl на мобиле → text-3xl на десктопе),
 * акцентный Exo 2 (font-orbitron), uppercase. className — для доп. отступов.
 */
export function PageTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        'text-2xl sm:text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase',
        className,
      )}
    >
      {children}
    </h1>
  );
}
