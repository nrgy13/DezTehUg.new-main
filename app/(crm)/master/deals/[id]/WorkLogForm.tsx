'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { Label } from '@/components/ui/label';
import { addWorkLog, markDealCompleted } from './actions';

export function WorkLogForm({ dealId, status }: { dealId: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addWorkLog(dealId, {
        performedAt,
        description,
        areaM2: areaM2 ? Number(areaM2) : null,
        notes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Запись добавлена');
      setOpen(false);
      setDescription('');
      setAreaM2('');
      setNotes('');
      setPerformedAt(new Date().toISOString().slice(0, 16));
      router.refresh();
    });
  }

  function handleComplete() {
    if (!confirm('Завершить выезд? Сделка перейдёт в статус «Выполнен».')) return;
    startTransition(async () => {
      const res = await markDealCompleted(dealId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success('Сделка помечена как выполненная');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <div className="flex gap-2">
          <CyberpunkButton variant="primary" onClick={() => setOpen(true)} disabled={isPending}>
            <Plus className="w-4 h-4 mr-1" />
            Записать выполненные работы
          </CyberpunkButton>
          {status !== 'completed' && (
            <CyberpunkButton variant="secondary" onClick={handleComplete} disabled={isPending}>
              <Check className="w-4 h-4 mr-1" />
              Завершить выезд
            </CyberpunkButton>
          )}
        </div>
      ) : (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wl-when">Когда</Label>
                <NeonInput
                  id="wl-when"
                  type="datetime-local"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
              <div>
                <Label htmlFor="wl-area">Обработанная площадь, м²</Label>
                <NeonInput
                  id="wl-area"
                  type="number"
                  min={0}
                  value={areaM2}
                  onChange={(e) => setAreaM2(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="wl-desc">Что сделано</Label>
              <textarea
                id="wl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Например: дезинсекция кухни и склада, обработка туманом по периметру"
                disabled={isPending}
                required
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
              />
            </div>
            <div>
              <Label htmlFor="wl-notes">Заметки (опционально)</Label>
              <textarea
                id="wl-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={isPending}
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
              >
                Отмена
              </button>
              <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
                {isPending ? 'Сохранение…' : 'Записать'}
              </CyberpunkButton>
            </div>
          </form>
        </CyberpunkCard>
      )}
    </div>
  );
}
