'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flag, CalendarClock, Plus } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { WorkOrderDialog } from '@/components/crm/WorkOrderDialog';
import type { ObjectReminder, ReminderHealth } from '@/lib/calendar/object-reminders';
import type { WorkOrderFormData } from './work-order-actions';

const HEALTH: Record<ReminderHealth, { label: string; badge: string; dot: string }> = {
  overdue: { label: 'просрочено', badge: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' },
  today: { label: 'сегодня', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  soon: { label: 'скоро', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  future: { label: 'позже', badge: 'bg-gray-50 text-content-muted border-gray-200', dot: 'bg-gray-300' },
};

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

export function ObjectRemindersPanel({
  reminders,
  formData,
}: {
  reminders: ObjectReminder[];
  formData: WorkOrderFormData;
}) {
  const [active, setActive] = useState<ObjectReminder | null>(null);

  if (reminders.length === 0) return null;

  return (
    <>
      <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flag className="w-4 h-4 text-neon-orange" />
          <h3 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase">
            По графику нужен заказ-наряд
          </h3>
          <span className="text-xs text-content-muted tabular-nums">{reminders.length}</span>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {reminders.map((r) => {
            const h = HEALTH[r.health];
            return (
              <div
                key={r.key}
                className="flex items-center gap-3 px-3 py-2 rounded-md border border-gray-200 hover:border-neon-orange/40 hover:bg-neon-orange/[0.03] transition-colors"
              >
                {/* Дата + срочность */}
                <div className="flex flex-col items-center w-14 flex-shrink-0">
                  <span className="text-sm font-semibold text-content-primary tabular-nums">
                    {fmtDate(r.date)}
                  </span>
                  <span
                    className={`mt-0.5 text-[9px] uppercase tracking-wider px-1 py-px rounded border ${h.badge}`}
                  >
                    {h.label}
                  </span>
                </div>

                {/* Услуги + объект */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-content-primary truncate">{r.servicesLabel}</div>
                  <div className="text-xs text-content-muted truncate">
                    <Link
                      href={`/manager/objects/${r.objectId}`}
                      className="hover:text-neon-orange"
                    >
                      {r.objectName}
                    </Link>
                    {' · '}
                    {r.clientShortName}
                    {r.contractNumber ? ` · ${r.contractNumber}` : ''}
                  </div>
                </div>

                {/* Оформить */}
                <button
                  type="button"
                  onClick={() => setActive(r)}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
                >
                  <Plus className="w-3 h-3" />
                  Оформить
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-[11px] text-content-muted flex items-center gap-1">
          <CalendarClock className="w-3 h-3" />
          Из периодичности услуг объектов. Оформишь наряд — флажок этой даты исчезнет.
        </p>
      </CyberpunkCard>

      {active && (
        <WorkOrderDialog
          data={formData}
          preset={{
            clientId: active.clientId,
            dealId: active.dealId ?? undefined,
            objectId: active.objectId,
            plannedAtLocal: `${active.date}T09:00`,
          }}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
