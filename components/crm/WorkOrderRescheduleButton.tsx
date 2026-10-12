'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { mskLocalToUtcISO, utcToMskParts } from '@/lib/datetime/msk';
import { updateVisitPlannedAt } from '@/app/(crm)/manager/deals/[id]/visits-actions';

const fieldClass =
  'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none';

/**
 * Кнопка «Перенести» на карточке запланированного наряда (менеджер): новая дата И время.
 * Перетаскивание в месячном календаре двигает только день, а время там не поменять —
 * жалоба Регины 10.2026. Время вводится и показывается в МСК, независимо от TZ браузера.
 */
export function WorkOrderRescheduleButton({
  workLogId,
  plannedAtIso,
}: {
  workLogId: string;
  /** Текущее время выезда (UTC ISO) — подставляется в поля; null — наряд без даты. */
  plannedAtIso: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    const cur = plannedAtIso ? utcToMskParts(plannedAtIso) : null;
    setDate(cur?.date ?? '');
    setTime(cur?.time ?? '09:00');
    setOpen(true);
  }

  function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      toast.error('Укажи дату и время');
      return;
    }
    startTransition(async () => {
      const res = await updateVisitPlannedAt(workLogId, {
        startAtIso: mskLocalToUtcISO(`${date}T${time}`),
        endAtIso: null,
      });
      if (res.ok) {
        const [y, m, d] = date.split('-');
        toast.success(`Перенесено на ${d}.${m}.${y} ${time} (МСК) — мастеру ушёл push`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="p-1.5 text-content-muted hover:text-neon-orange hover:bg-neon-orange/10 rounded border border-gray-200"
        title="Перенести: другая дата и время"
        aria-label="Перенести наряд"
      >
        <CalendarClock className="w-3.5 h-3.5" />
      </button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Перенести наряд</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label htmlFor={`rs-date-${workLogId}`}>Дата</Label>
                <input
                  id={`rs-date-${workLogId}`}
                  type="date"
                  className={fieldClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor={`rs-time-${workLogId}`}>Время (МСК)</Label>
                <input
                  id={`rs-time-${workLogId}`}
                  type="time"
                  step={60}
                  className={fieldClass}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <p className="text-xs text-content-muted">
              Мастеру (и всей бригаде) придёт push «Выезд перенесён».
            </p>
            <DialogFooter>
              <CyberpunkButton variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Отмена
              </CyberpunkButton>
              <CyberpunkButton onClick={save} disabled={isPending}>
                {isPending ? 'Сохраняю…' : 'Перенести'}
              </CyberpunkButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
