'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ActType = 'act_inspection' | 'act_work';

const ACT_LABEL: Record<ActType, string> = {
  act_inspection: 'Акт обследования',
  act_work: 'Акт выполненных работ',
};

/**
 * Кнопки генерации актов (АО / АВР) ПО КОНКРЕТНОМУ ВЫЕЗДУ (заказ-наряду).
 * Шлёт workLogId — генератор берёт услуги из снимка наряда, мастера/дату из выезда,
 * объект выводит из него сам. Переиспользуется на карточке выезда в табе сделки,
 * карточке объекта и в календаре. Возвращает фрагмент (две кнопки) — вставляется
 * в существующий ряд действий выезда.
 */
export function VisitActButtons({
  dealId,
  workLogId,
}: {
  dealId: string;
  workLogId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ActType | null>(null);

  async function generate(type: ActType) {
    if (pending) return; // не плодим параллельные генерации
    setPending(type);
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, dealId, workLogId, format: 'both' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`);
        return;
      }
      toast.success(`${ACT_LABEL[type]} ${json.data.number} готов`);
      const url = json.data.pdfUrl ?? json.data.docxUrl;
      if (url) window.open(url, '_blank');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сети');
    } finally {
      setPending(null);
    }
  }

  const cls =
    'inline-flex items-center gap-1 px-2 py-1 text-[11px] text-content-secondary hover:text-neon-orange border border-gray-200 rounded disabled:opacity-50';

  return (
    <>
      <button
        type="button"
        onClick={() => generate('act_inspection')}
        disabled={pending !== null}
        className={cls}
        title="Сформировать Акт обследования по этому выезду"
      >
        {pending === 'act_inspection' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ClipboardCheck className="w-3 h-3" />
        )}
        АО
      </button>
      <button
        type="button"
        onClick={() => generate('act_work')}
        disabled={pending !== null}
        className={cls}
        title="Сформировать Акт выполненных работ по этому выезду"
      >
        {pending === 'act_work' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ClipboardList className="w-3 h-3" />
        )}
        АВР
      </button>
    </>
  );
}
