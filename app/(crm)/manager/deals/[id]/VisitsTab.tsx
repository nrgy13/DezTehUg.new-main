'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  MinusCircle,
  Camera,
  MapPin,
  Wrench,
  FlaskConical,
} from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { WorkOrderDialog } from '@/components/crm/WorkOrderDialog';
import { deleteWorkOrder, type WorkOrderFormData } from '@/app/(crm)/manager/calendar/work-order-actions';

export type VisitItemView = {
  id: string;
  source: 'template' | 'manager' | 'master';
  position: number;
  title: string;
  description: string | null;
  required: boolean;
  status: 'pending' | 'done' | 'na';
  note: string | null;
  photosCount: number;
};

export type VisitView = {
  id: string;
  status: 'planned' | 'in_progress' | 'completed';
  plannedAt: string | null;
  startedAt: string | null;
  finalizedAt: string | null;
  performedAt: string | null;
  masterName: string | null;
  services: string[];
  preparations: string | null;
  items: VisitItemView[];
};

/** Группа выездов (заказ-нарядов) по объекту. objectId=null — выезды без объекта (legacy). */
export type ObjectVisitGroup = {
  objectId: string | null;
  objectName: string | null;
  address: string | null;
  visits: VisitView[];
};

type Props = {
  dealId: string;
  clientId: string;
  formData: WorkOrderFormData;
  groups: ObjectVisitGroup[];
};

const STATUS_LABEL: Record<VisitView['status'], string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Выполнен',
};

const STATUS_COLOR: Record<VisitView['status'], string> = {
  planned: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function VisitsTab({ dealId, clientId, formData, groups }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggle(workLogId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workLogId)) next.delete(workLogId);
      else next.add(workLogId);
      return next;
    });
  }

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

  const hasAnyVisit = groups.some((g) => g.visits.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-content-muted">
          Заказ-наряды (выезды мастеров) по объектам этого договора.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
        >
          <Plus className="w-3.5 h-3.5" />
          Заказ-наряд
        </button>
      </div>

      {!hasAnyVisit ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-6 text-center">
          <p className="text-sm text-content-muted">
            Выездов по договору пока нет. Нажми «Заказ-наряд» — выбери объект, услуги, препараты,
            дату и мастера. Выезд появится здесь и в календаре.
          </p>
        </CyberpunkCard>
      ) : (
        groups
          .filter((g) => g.visits.length > 0)
          .map((g) => (
            <CyberpunkCard
              key={g.objectId ?? 'none'}
              variant="default"
              hoverEffect={false}
              className="p-0 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-200 bg-bg-secondary flex items-start gap-2">
                <MapPin className="w-4 h-4 text-neon-orange flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-content-primary">
                    {g.objectName ?? 'Без объекта'}
                  </div>
                  {g.address && (
                    <div className="text-xs text-content-muted mt-0.5">{g.address}</div>
                  )}
                </div>
              </div>

              <ul className="divide-y divide-gray-100">
                {g.visits.map((v) => {
                  const isOpen = expanded.has(v.id);
                  const doneCount = v.items.filter((i) => i.status === 'done').length;
                  const naCount = v.items.filter((i) => i.status === 'na').length;
                  return (
                    <li key={v.id}>
                      <div className="w-full px-4 py-3 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggle(v.id)}
                          className="flex items-start gap-3 flex-1 min-w-0 text-left"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-content-muted" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-content-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] uppercase font-orbitron font-semibold tracking-wider px-1.5 py-0.5 rounded border ${STATUS_COLOR[v.status]}`}
                              >
                                {STATUS_LABEL[v.status]}
                              </span>
                              <span className="text-xs text-content-secondary">{fmtVisitDate(v)}</span>
                              {v.masterName && (
                                <span className="text-xs text-content-muted inline-flex items-center gap-1">
                                  <Wrench className="w-3 h-3" />
                                  {v.masterName}
                                </span>
                              )}
                            </div>
                            {v.services.length > 0 && (
                              <div className="text-xs text-content-secondary mt-1">
                                {v.services.join(', ')}
                              </div>
                            )}
                            {v.preparations && (
                              <div className="text-xs text-content-muted mt-0.5 inline-flex items-center gap-1">
                                <FlaskConical className="w-3 h-3" />
                                {v.preparations}
                              </div>
                            )}
                            {v.items.length > 0 && (
                              <div className="text-xs text-content-muted mt-1">
                                Чеклист: {doneCount}/{v.items.length} выполнено
                                {naCount > 0 ? `, ${naCount} N/A` : ''}
                              </div>
                            )}
                          </div>
                        </button>
                        {v.status === 'planned' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id)}
                            disabled={isPending && deletingId === v.id}
                            className="flex-shrink-0 p-1.5 text-content-muted hover:text-red-600 hover:bg-red-50 rounded border border-gray-200 disabled:opacity-50"
                            title="Удалить выезд"
                            aria-label="Удалить выезд"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {isOpen && v.items.length > 0 && (
                        <ul className="px-4 pb-3 pl-11 space-y-2">
                          {v.items.map((it) => (
                            <li key={it.id} className="flex items-start gap-2 text-sm">
                              <span className="flex-shrink-0 mt-0.5">
                                {it.status === 'done' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : it.status === 'na' ? (
                                  <MinusCircle className="w-4 h-4 text-content-muted" />
                                ) : (
                                  <Circle className="w-4 h-4 text-content-muted" />
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={
                                    it.status === 'done'
                                      ? 'text-content-secondary'
                                      : it.status === 'na'
                                        ? 'text-content-muted line-through'
                                        : 'text-content-primary'
                                  }
                                >
                                  {it.title}
                                  {it.required && (
                                    <span className="text-[10px] ml-1.5 px-1 py-px rounded bg-red-50 text-red-600 border border-red-100">
                                      обяз.
                                    </span>
                                  )}
                                  {it.source === 'manager' && (
                                    <span className="text-[10px] ml-1.5 text-content-muted">(менеджер)</span>
                                  )}
                                  {it.source === 'master' && (
                                    <span className="text-[10px] ml-1.5 text-content-muted">(мастер)</span>
                                  )}
                                </div>
                                {it.description && (
                                  <div className="text-xs text-content-muted mt-0.5">{it.description}</div>
                                )}
                                {it.note && (
                                  <div className="text-xs text-content-secondary mt-1 italic">{it.note}</div>
                                )}
                                {it.photosCount > 0 && (
                                  <div className="text-xs text-content-muted mt-1 inline-flex items-center gap-1">
                                    <Camera className="w-3 h-3" />
                                    {it.photosCount} фото
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CyberpunkCard>
          ))
      )}

      {open && (
        <WorkOrderDialog
          data={formData}
          preset={{ clientId, dealId }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function fmtVisitDate(v: VisitView): string {
  const iso = v.performedAt || v.finalizedAt || v.startedAt || v.plannedAt;
  if (!iso) return 'без даты';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
