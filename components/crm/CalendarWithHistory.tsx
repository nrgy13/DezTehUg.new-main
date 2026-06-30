'use client';

import { useState } from 'react';
import { CalendarDays, History } from 'lucide-react';
import { CalendarFull, type SerializedDealEvent } from '@/components/crm/CalendarFull';
import { VisitHistoryList } from '@/components/crm/VisitHistoryList';
import type { SerializedVisitHistoryItem } from '@/lib/calendar/deal-events';

type Tab = 'active' | 'history';

/**
 * Обёртка календаря с переключателем «Активные | История».
 * Активные (planned/in_progress) — обычный календарь с сеткой.
 * История (completed) — список выездов по дням, новые сверху, read-only.
 * Переиспользуется для менеджера (canDragDates) и мастера.
 */
export function CalendarWithHistory({
  active,
  history,
  dealHrefBase,
  canDragDates = false,
  canGenerateActs = false,
}: {
  active: SerializedDealEvent[];
  history: SerializedVisitHistoryItem[];
  dealHrefBase: string;
  canDragDates?: boolean;
  /** Кнопки генерации актов (АО/АВР) на карточках выездов — только manager/admin. */
  canGenerateActs?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('active');

  return (
    <div className="space-y-4">
      {/* Таб-переключатель */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            tab === 'active'
              ? 'bg-neon-orange/10 text-neon-orange'
              : 'text-content-secondary hover:bg-gray-50'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Активные
          <span className="text-[10px] tabular-nums opacity-70">{active.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
            tab === 'history'
              ? 'bg-emerald-500/10 text-emerald-700'
              : 'text-content-secondary hover:bg-gray-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          История
          <span className="text-[10px] tabular-nums opacity-70">{history.length}</span>
        </button>
      </div>

      {tab === 'active' ? (
        <CalendarFull
          events={active}
          dealHrefBase={dealHrefBase}
          canDragDates={canDragDates}
          canGenerateActs={canGenerateActs}
        />
      ) : (
        <VisitHistoryList items={history} hrefBase={dealHrefBase} canGenerateActs={canGenerateActs} />
      )}
    </div>
  );
}
