'use client';

import { useRouter } from 'next/navigation';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Phone, MapPin, Calendar, Clock } from 'lucide-react';
import type { LeadStatus } from '@/lib/db/schema/leads';
import { badgeClassesForLead, formatDays, stageHealthLevel } from '@/lib/lead-stages';

export type BoardLead = {
  id: string;
  status: LeadStatus;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  requestedAddress: string | null;
  channel: string | null;
  managerName: string | null;
  isMine: boolean;
  createdAt: Date;
  daysInStage?: number; // подгружается отдельно в page.tsx через getDaysInStageBatch
};

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function LeadCard({ lead, isOverlay = false }: { lead: BoardLead; isOverlay?: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { fromStatus: lead.status, lead },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging && !isOverlay ? 0.4 : 1,
  };

  // Вся карточка — drag target. Клик (без движения >5px) → переход на детальную.
  // PointerSensor с activationConstraint distance:5 разделяет click и drag.
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isOverlay ? attributes : {})}
      {...(!isOverlay ? listeners : {})}
      onClick={() => {
        if (isOverlay) return;
        router.push(`/manager/leads/${lead.id}`);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Лид ${lead.contactName ?? 'без имени'}`}
      className={`group bg-bg-primary border border-gray-200 rounded-md p-2 transition-all select-none ${
        isOverlay
          ? 'shadow-2xl ring-2 ring-neon-orange rotate-1 cursor-grabbing'
          : 'hover:shadow-md hover:border-poison-green/40 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-neon-orange/40'
      }`}
    >
      <LeadCardBody lead={lead} />
    </div>
  );
}

/**
 * Презентационное тело карточки лида (без drag/click) — переиспользуется
 * в desktop-канбане (внутри draggable LeadCard) и в мобильном вертикальном
 * списке (MobileLeadBoard). Имя подсвечивается на group-hover, поэтому
 * родитель должен иметь класс `group`.
 */
export function LeadCardBody({ lead }: { lead: BoardLead }) {
  return (
    <>
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <div className="font-medium text-xs text-content-primary group-hover:text-neon-orange transition-colors line-clamp-1 flex-1">
          {lead.contactName ?? '— без имени —'}
        </div>
        {/* Бейдж дней на стадии. Не показываем для финальных стадий. */}
        {typeof lead.daysInStage === 'number' &&
          stageHealthLevel(lead.status, lead.daysInStage) !== 'final' && (
            <DaysBadge status={lead.status} days={lead.daysInStage} />
          )}
      </div>

      <div className="mt-1.5 space-y-0.5 text-[11px] text-content-muted">
        {lead.contactPhone && (
          <div className="flex items-center gap-1">
            <Phone className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{lead.contactPhone}</span>
          </div>
        )}
        {lead.requestedAddress && (
          <div className="flex items-start gap-1">
            <MapPin className="w-2.5 h-2.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-tight">{lead.requestedAddress}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[9px] text-content-muted/80 pt-0.5">
          <Calendar className="w-2.5 h-2.5 shrink-0" />
          <span>{dateFmt.format(lead.createdAt)}</span>
          {lead.channel && (
            <span className="ml-auto font-mono text-[8px] px-1 py-0.5 bg-gray-100 rounded truncate max-w-[60px]">
              {lead.channel}
            </span>
          )}
        </div>
        {lead.managerName && (
          <div className="text-[9px] truncate">
            <span className="text-content-muted/60">мен.:</span>{' '}
            <span className={lead.isMine ? 'text-poison-green font-medium' : 'text-content-secondary'}>
              {lead.managerName}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function DaysBadge({ status, days }: { status: LeadStatus; days: number }) {
  const c = badgeClassesForLead(status, days);
  const health = stageHealthLevel(status, days);
  return (
    <span
      title={
        health === 'stale'
          ? `⚠ Зависший лид: ${days} дн. на стадии`
          : health === 'warn'
            ? `Внимание: ${days} дн. на стадии`
            : `${days} дн. на текущей стадии`
      }
      className={`shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-orbitron font-semibold ${c.bg} ${c.text} ${c.ringPulse ?? ''}`}
    >
      <span className={`w-1 h-1 rounded-full ${c.dot} shrink-0`}></span>
      <Clock className="w-2 h-2 shrink-0" />
      {formatDays(days)}
    </span>
  );
}
