'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Copy,
  Loader2,
  CalendarClock,
  Wrench,
  FlaskConical,
  ListChecks,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { WorkOrderDialog } from '@/components/crm/WorkOrderDialog';
import { VisitActButtons } from '@/components/crm/VisitActButtons';
import {
  deleteWorkOrder,
  getWorkOrderDuplicateData,
  type WorkOrderFormData,
  type WorkOrderDuplicateData,
} from '@/app/(crm)/manager/calendar/work-order-actions';

export type ObjectVisitView = {
  id: string;
  status: 'planned' | 'in_progress' | 'completed';
  dateLabel: string;
  masterName: string | null;
  services: string[];
  preparations: string | null;
  checklistDone: number;
  checklistTotal: number;
  dealId: string | null;
};

const STATUS_LABEL: Record<ObjectVisitView['status'], string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Выполнен',
};
const STATUS_COLOR: Record<ObjectVisitView['status'], string> = {
  planned: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function ObjectVisitsSection({
  objectId,
  clientId,
  dealId,
  formData,
  visits,
}: {
  objectId: string;
  clientId: string;
  dealId: string | null;
  formData: WorkOrderFormData;
  visits: ObjectVisitView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Дублирование: снимок наряда + полное дерево → форма-копия (можно сменить цель).
  const [dup, setDup] = useState<Extract<WorkOrderDuplicateData, { ok: true }> | null>(null);
  const [dupLoadingId, setDupLoadingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Удалить запланированный выезд? Действие необратимо.')) return;
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteWorkOrder(id);
      if (res.ok) {
        toast.success('Выезд удалён');
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setDeletingId(null);
    });
  }

  function handleDuplicate(id: string) {
    if (dupLoadingId) return; // не плодим параллельные загрузки копии (гонка показа чужих данных)
    setDupLoadingId(id);
    startTransition(async () => {
      try {
        const res = await getWorkOrderDuplicateData(id);
        if (res.ok) setDup(res);
        else toast.error(res.error);
      } catch {
        toast.error('Не удалось загрузить наряд для копирования');
      } finally {
        setDupLoadingId(null);
      }
    });
  }

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase">
          Выезды по объекту
        </h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={dupLoadingId !== null || dup !== null}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="w-3.5 h-3.5" />
          Создать выезд
        </button>
      </div>

      {visits.length === 0 ? (
        <p className="text-sm text-content-muted">
          Выездов по объекту ещё нет. Оформи заказ-наряд — он появится здесь и в календаре.
        </p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <li
              key={v.id}
              className="rounded-md border border-gray-200 p-3 hover:border-neon-orange/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] uppercase font-orbitron font-semibold tracking-wider px-1.5 py-0.5 rounded border ${STATUS_COLOR[v.status]}`}
                  >
                    {STATUS_LABEL[v.status]}
                  </span>
                  <span className="text-xs text-content-secondary inline-flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    {v.dateLabel}
                  </span>
                  {v.masterName && (
                    <span className="text-xs text-content-muted inline-flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {v.masterName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {v.dealId && <VisitActButtons dealId={v.dealId} workLogId={v.id} />}
                  {v.dealId && (
                    <Link
                      href={`/manager/deals/${v.dealId}?tab=visits`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-content-secondary hover:text-neon-orange border border-gray-200 rounded"
                    >
                      <ExternalLink className="w-3 h-3" />В договоре
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDuplicate(v.id)}
                    disabled={dupLoadingId !== null}
                    className="p-1.5 text-content-muted hover:text-neon-orange hover:bg-neon-orange/10 rounded border border-gray-200 disabled:opacity-50"
                    title="Дублировать наряд (можно перенести на другой объект/договор)"
                    aria-label="Дублировать наряд"
                  >
                    {dupLoadingId === v.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {v.status === 'planned' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      disabled={isPending && deletingId === v.id}
                      className="p-1.5 text-content-muted hover:text-red-600 hover:bg-red-50 rounded border border-gray-200 disabled:opacity-50"
                      title="Удалить выезд"
                      aria-label="Удалить выезд"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {v.services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.services.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded bg-poison-green/10 text-poison-green border border-poison-green/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
                {v.preparations && (
                  <span className="inline-flex items-center gap-1">
                    <FlaskConical className="w-3 h-3" />
                    {v.preparations}
                  </span>
                )}
                {v.checklistTotal > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="w-3 h-3" />
                    Чеклист: {v.checklistDone}/{v.checklistTotal}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <WorkOrderDialog
          data={formData}
          preset={{ clientId, dealId: dealId ?? undefined, objectId }}
          onClose={() => setOpen(false)}
        />
      )}

      {dup && (
        <WorkOrderDialog
          data={dup.formData}
          duplicatePrefill={dup.prefill}
          onClose={() => setDup(null)}
        />
      )}
    </CyberpunkCard>
  );
}
