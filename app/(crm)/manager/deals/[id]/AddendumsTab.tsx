'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, FileDown, Loader2 } from 'lucide-react';
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
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { createAddendum, deleteAddendum } from './addendums/actions';

export type AddendumRow = {
  id: string;
  number: number;
  date: string | null;
  description: string | null;
  status: string;
  createdAt: string;
};

export function AddendumsTab({
  dealId,
  addendums,
}: {
  dealId: string;
  addendums: AddendumRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleGenerate(addendumId: string) {
    setGeneratingId(addendumId);
    startTransition(async () => {
      try {
        const res = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'addendum', dealId, addendumId, format: 'both' }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? `HTTP ${res.status}`);
          return;
        }
        toast.success(`ДС ${json.data.number} сгенерировано — посмотри в табе «Документы»`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка сети');
      } finally {
        setGeneratingId(null);
      }
    });
  }

  function handleDelete(id: string, number: number) {
    if (!confirm(`Удалить ДС№${number}?`)) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteAddendum(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success('ДС удалено');
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-content-muted">
          Доп. соглашений: {addendums.length}
        </p>
        <CyberpunkButton variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Создать ДС
        </CyberpunkButton>
      </div>

      {addendums.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
          <p className="text-sm text-content-muted">Доп. соглашений пока нет.</p>
        </CyberpunkCard>
      ) : (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-gray-200">
              <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
                <th className="text-left px-4 py-3 w-20">№</th>
                <th className="text-left px-4 py-3 w-32">Дата</th>
                <th className="text-left px-4 py-3">Описание</th>
                <th className="text-right px-4 py-3 w-44"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {addendums.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-orbitron text-content-primary">№{a.number}</td>
                  <td className="px-4 py-3 text-content-secondary">
                    {a.date ? a.date.split('-').reverse().join('.') : '—'}
                  </td>
                  <td className="px-4 py-3 text-content-secondary text-xs">
                    {a.description || <span className="text-content-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleGenerate(a.id)}
                      disabled={generatingId === a.id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-neon-orange/40 text-neon-orange rounded hover:bg-neon-orange/10 disabled:opacity-50"
                    >
                      {generatingId === a.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <FileDown className="w-3 h-3" />
                      )}
                      DOCX
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.number)}
                      disabled={deletingId === a.id}
                      className="inline-flex p-1.5 text-red-400 hover:text-red-600 disabled:opacity-50"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CyberpunkCard>
      )}

      {creating && (
        <CreateDialog
          dealId={dealId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateDialog({
  dealId,
  onClose,
  onCreated,
}: {
  dealId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createAddendum(dealId, { date, description });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`ДС№${res.data.number} создано`);
      onCreated();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Новое доп. соглашение
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="ds-date">Дата</Label>
            <NeonInput
              id="ds-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending}
              required
            />
          </div>
          <div>
            <Label htmlFor="ds-desc">Описание изменений</Label>
            <textarea
              id="ds-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isPending}
              placeholder="Например: добавлен новый объект «Склад на ул. Заводской», корректировка тарифа на дезинсекцию"
              className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Отмена
            </button>
            <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Создаём…' : 'Создать ДС'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
