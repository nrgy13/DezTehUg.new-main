'use client';

import { Clock, ArrowDown } from 'lucide-react';
import type { LeadStatus } from '@/lib/db/schema/leads';
import {
  STAGE_COLORS,
  badgeClassesForLead,
  daysSince,
  formatDays,
  stageHealthLevel,
} from '@/lib/lead-stages';

export type TimelineEntry = {
  id: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  changedAt: Date | string;
  changedByName: string | null;
  notes: string | null;
};

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function diffDays(a: Date | string, b: Date | string): number {
  const ad = typeof a === 'string' ? new Date(a) : a;
  const bd = typeof b === 'string' ? new Date(b) : b;
  return Math.max(0, Math.floor((bd.getTime() - ad.getTime()) / (1000 * 60 * 60 * 24)));
}

export function LeadHistoryTimeline({
  entries,
  currentStatus,
}: {
  entries: TimelineEntry[];
  currentStatus: LeadStatus;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-xs text-content-muted italic">История стадий пустая.</div>
    );
  }

  // Считаем для каждой записи сколько лид провёл в этом статусе
  // (от changedAt до changedAt следующей или до NOW для последней).
  const enriched = entries.map((e, i) => {
    const next = entries[i + 1];
    const endAt = next ? next.changedAt : new Date();
    const days = diffDays(e.changedAt, endAt);
    const isCurrent = i === entries.length - 1;
    return { ...e, days, isCurrent, endAt };
  });

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-content-secondary" />
        <h3 className="text-xs font-orbitron font-semibold uppercase tracking-wider text-content-secondary">
          История стадий ({entries.length})
        </h3>
      </div>
      {enriched.map((e, i) => {
        const c = STAGE_COLORS[e.toStatus];
        const badge = badgeClassesForLead(e.toStatus, e.days);
        const health = stageHealthLevel(e.toStatus, e.days);
        return (
          <div key={e.id}>
            <div className="flex items-start gap-3">
              {/* Точка стадии */}
              <div className="flex flex-col items-center pt-1">
                <span
                  className={`w-3 h-3 rounded-full ${c.dot} ring-2 ring-bg-primary shrink-0 ${
                    e.isCurrent ? 'animate-pulse' : ''
                  }`}
                ></span>
                {i < enriched.length - 1 && (
                  <span className="w-px flex-1 bg-gray-200 my-1 min-h-[20px]"></span>
                )}
              </div>
              {/* Контент */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-orbitron font-bold uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}
                  >
                    {c.label}
                  </span>
                  <span className="text-[10px] text-content-muted">
                    {dateFmt.format(new Date(e.changedAt))}
                  </span>
                  {/* Бейдж дней — только для прошлых стадий или для текущей если не финал */}
                  {(!e.isCurrent || health !== 'final') && (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${badge.bg} ${badge.text}`}
                    >
                      {e.isCurrent ? `${formatDays(e.days)} (текущая)` : `провёл ${formatDays(e.days)}`}
                    </span>
                  )}
                </div>
                {e.fromStatus && (
                  <div className="text-[10px] text-content-muted/70 mt-0.5">
                    из «{STAGE_COLORS[e.fromStatus].label}»
                    {e.changedByName && <span> · {e.changedByName}</span>}
                  </div>
                )}
                {e.notes && (
                  <div className="text-[10px] text-content-muted mt-1 italic">{e.notes}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
