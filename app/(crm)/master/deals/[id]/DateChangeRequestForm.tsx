'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { requestDateChange } from './actions';

export function DateChangeRequestForm({
  dealId,
  contractNumber,
  currentStartDate,
  currentEndDate,
}: {
  dealId: string;
  contractNumber: string;
  currentStartDate: string | null;
  currentEndDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState<string>(currentStartDate ?? '');
  const [end, setEnd] = useState<string>(currentEndDate ?? '');
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await requestDateChange(dealId, {
        requestedStartDate: start,
        requestedEndDate: end || '',
        reason,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Запрос отправлен менеджеру');
      setOpen(false);
      setReason('');
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-cyber-blue border border-cyber-blue/40 rounded hover:bg-cyber-blue/10 transition-colors"
        title="Попросить менеджера перенести даты выезда"
      >
        <CalendarClock className="w-4 h-4" />
        Попросить перенести даты
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-orbitron uppercase tracking-wide">
              Запрос на перенос дат
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono text-content-primary">{contractNumber}</span> —
              менеджер увидит запрос в истории сделки и (если у него привязан Telegram) получит
              уведомление сразу.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs text-content-muted">Текущие даты</Label>
              <div className="text-sm text-content-secondary mt-1">
                {formatRange(currentStartDate, currentEndDate)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-start">Новая дата начала</Label>
                <NeonInput
                  id="new-start"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
              <div>
                <Label htmlFor="new-end">
                  Новая дата окончания{' '}
                  <span className="text-content-muted text-[10px]">(опц.)</span>
                </Label>
                <NeonInput
                  id="new-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  disabled={isPending}
                  min={start || undefined}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dc-reason">Причина переноса</Label>
              <Textarea
                id="dc-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Например: клиент просит перенести; не хватает реагента; объект закрыт; и т.п."
                rows={4}
                disabled={isPending}
                required
              />
              <div className="text-[10px] text-content-muted mt-1">Минимум 5 символов.</div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
              >
                Отмена
              </button>
              <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
                <Send className="w-4 h-4 mr-1" />
                {isPending ? 'Отправляю…' : 'Отправить'}
              </CyberpunkButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Без дат';
  const fmt = (s: string) => s.split('-').reverse().join('.');
  if (start && end && start !== end) return `${fmt(start)} — ${fmt(end)}`;
  return fmt(start ?? end!);
}
