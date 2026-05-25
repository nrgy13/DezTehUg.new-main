'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { LeadStatus } from '@/lib/db/schema/leads';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LeadCardBody, type BoardLead } from './LeadCard';
import type { ColumnDef, ColumnSummary } from './KanbanColumn';

/**
 * Мобильный канбан лидов (<lg). Колонки превращаются в вертикальные секции
 * по статусам сверху вниз. Перетаскивание пальцем неудобно, поэтому статус
 * меняется через dropdown «Переместить» на карточке — он зовёт ту же
 * requestStatusChange (onMove), что и drag на десктопе, поэтому спец-переходы
 * (КП / конверт / «не состоялась») открывают свои модалки автоматически.
 */
export function MobileLeadBoard({
  columns,
  grouped,
  summaries,
  onMove,
}: {
  columns: ColumnDef[];
  grouped: Record<LeadStatus, BoardLead[]>;
  summaries?: Partial<Record<LeadStatus, ColumnSummary>>;
  onMove: (leadId: string, newStatus: LeadStatus) => void;
}) {
  return (
    <div className="space-y-4">
      {columns.map((col) => {
        const leads = grouped[col.id] ?? [];
        const summary = summaries?.[col.id];
        const isFinal = col.id === 'won' || col.id === 'lost';
        return (
          <section key={col.id}>
            <header
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border-2 ${col.accent} ${col.bgAccent}`}
            >
              <span className="text-xs font-orbitron font-semibold uppercase tracking-wider truncate">
                {col.label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {!isFinal && summary && summary.count > 0 && summary.staleCount > 0 && (
                  <span className="text-[10px] text-red-600 font-medium">
                    ⚠ {summary.staleCount}
                  </span>
                )}
                <span
                  className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-orbitron font-bold border ${col.accent} ${col.bgAccent}`}
                >
                  {leads.length}
                </span>
              </div>
            </header>

            <div className="mt-1.5 space-y-1.5">
              {leads.length === 0 ? (
                <div className="text-[11px] text-content-muted/60 italic px-2 py-2">
                  пусто
                </div>
              ) : (
                leads.map((lead) => (
                  <MobileLeadRow
                    key={lead.id}
                    lead={lead}
                    columns={columns}
                    onMove={onMove}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MobileLeadRow({
  lead,
  columns,
  onMove,
}: {
  lead: BoardLead;
  columns: ColumnDef[];
  onMove: (leadId: string, newStatus: LeadStatus) => void;
}) {
  return (
    <div className="bg-bg-primary border border-gray-200 rounded-lg p-2.5">
      <Link href={`/manager/leads/${lead.id}`} className="group block">
        <LeadCardBody lead={lead} />
      </Link>
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-content-secondary bg-bg-secondary border border-gray-200 hover:border-poison-green/40 active:bg-gray-100"
            >
              Переместить
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Переместить в</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns
              .filter((c) => c.id !== lead.status)
              .map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => onMove(lead.id, c.id)}
                  className="cursor-pointer"
                >
                  {c.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
