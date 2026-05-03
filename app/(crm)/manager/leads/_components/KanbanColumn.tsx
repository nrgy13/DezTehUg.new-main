'use client';

import { useDroppable } from '@dnd-kit/core';
import type { LeadStatus } from '@/lib/db/schema/leads';
import { LeadCard, type BoardLead } from './LeadCard';

export type ColumnDef = {
  id: LeadStatus;
  label: string;
  accent: string; // tailwind border/text color
  bgAccent: string; // tailwind bg color (subtle)
};

export function KanbanColumn({ column, leads }: { column: ColumnDef; leads: BoardLead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-0">
      <div className={`mb-1.5 px-2 py-1.5 rounded-md border-2 ${column.accent} ${column.bgAccent}`}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-orbitron font-semibold uppercase tracking-wider truncate">
            {column.label}
          </span>
          <span
            className={`inline-flex items-center justify-center min-w-[20px] h-4 px-1 rounded-full text-[9px] font-orbitron font-bold ${column.bgAccent} ${column.accent} border shrink-0`}
          >
            {leads.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[180px] p-1.5 space-y-1.5 rounded-md border-2 border-dashed transition-colors ${
          isOver
            ? 'border-poison-green bg-poison-green/5'
            : 'border-gray-200 bg-bg-tertiary/30'
        }`}
      >
        {leads.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[10px] text-content-muted/60 italic">
            пусто
          </div>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
