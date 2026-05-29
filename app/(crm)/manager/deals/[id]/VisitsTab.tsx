'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, MinusCircle, Camera } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { createNextVisitForPriceItem } from './visits-actions';
import { unitLabel, formatQuantity } from '@/lib/constants/units';
import type { PriceItemUnit } from '@/lib/db/schema/deals';

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
  items: VisitItemView[];
};

export type PriceItemGroup = {
  id: string;
  service: string;
  objectName: string | null;
  areaM2: string;
  unit: PriceItemUnit | null;
  visits: VisitView[];
};

type Props = {
  dealId: string;
  groups: PriceItemGroup[];
  hasMaster: boolean;
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

export function VisitsTab({ dealId, groups, hasMaster }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function toggle(workLogId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workLogId)) next.delete(workLogId);
      else next.add(workLogId);
      return next;
    });
  }

  function createNext(priceItemId: string) {
    startTransition(async () => {
      const res = await createNextVisitForPriceItem(priceItemId);
      if (res.ok) {
        toast.success('Выезд создан, чеклист скопирован из шаблона услуги');
      } else {
        toast.error(res.error);
      }
    });
  }

  if (groups.length === 0) {
    return (
      <CyberpunkCard variant="default" hoverEffect={false} className="p-6 text-center">
        <p className="text-sm text-content-muted">
          В сделке нет позиций прайса. Добавь их во вкладке «Прайс», затем
          назначь мастера — выезды создадутся автоматически.
        </p>
      </CyberpunkCard>
    );
  }

  if (!hasMaster) {
    return (
      <CyberpunkCard variant="default" hoverEffect={false} className="p-6 text-center">
        <p className="text-sm text-content-muted">
          На сделке не назначен мастер. Открой «Реквизиты» → «Исполнитель», выбери
          мастера — выезды создадутся автоматически по каждой позиции прайса.
        </p>
      </CyberpunkCard>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <CyberpunkCard
          key={g.id}
          variant="default"
          hoverEffect={false}
          className="p-0 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-200 bg-bg-secondary flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-content-primary">
                {g.service}
                <span className="text-content-muted font-normal"> · {formatQuantity(g.areaM2)} {unitLabel(g.unit)}</span>
              </div>
              {g.objectName && (
                <div className="text-xs text-content-muted mt-0.5">{g.objectName}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => createNext(g.id)}
              className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
            >
              <Plus className="w-3 h-3" />
              Новый выезд
            </button>
          </div>

          {g.visits.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm text-content-muted">
              Выездов по этой позиции пока нет.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {g.visits.map((v) => {
                const isOpen = expanded.has(v.id);
                const doneCount = v.items.filter((i) => i.status === 'done').length;
                const naCount = v.items.filter((i) => i.status === 'na').length;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => toggle(v.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-bg-secondary/50 text-left"
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
                          <span className="text-xs text-content-secondary">
                            {fmtVisitDate(v)}
                          </span>
                          {v.masterName && (
                            <span className="text-xs text-content-muted">
                              · {v.masterName}
                            </span>
                          )}
                        </div>
                        {v.items.length > 0 && (
                          <div className="text-xs text-content-muted mt-1">
                            Чеклист: {doneCount}/{v.items.length} выполнено
                            {naCount > 0 ? `, ${naCount} N/A` : ''}
                          </div>
                        )}
                      </div>
                    </button>

                    {isOpen && v.items.length > 0 && (
                      <ul className="px-4 pb-3 pl-11 space-y-2">
                        {v.items.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-start gap-2 text-sm"
                          >
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
                                  <span className="text-[10px] ml-1.5 text-content-muted">
                                    (менеджер)
                                  </span>
                                )}
                                {it.source === 'master' && (
                                  <span className="text-[10px] ml-1.5 text-content-muted">
                                    (мастер)
                                  </span>
                                )}
                              </div>
                              {it.description && (
                                <div className="text-xs text-content-muted mt-0.5">
                                  {it.description}
                                </div>
                              )}
                              {it.note && (
                                <div className="text-xs text-content-secondary mt-1 italic">
                                  {it.note}
                                </div>
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
          )}
        </CyberpunkCard>
      ))}
    </div>
  );
}

function fmtVisitDate(v: VisitView): string {
  // Финальная дата: для completed — performedAt/finalizedAt, для планируемого — plannedAt
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
