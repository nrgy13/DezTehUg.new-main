'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Search, X, Wrench, User as UserIcon, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { DealStatus } from '@/lib/db/schema/deals';
import { updateDealStatus } from '../actions';

export type BoardDeal = {
  id: string;
  contractNumber: string;
  contractDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: DealStatus;
  clientId: string | null;
  clientShortName: string | null;
  managerName: string | null;
  masterName: string | null;
};

type ColumnDef = {
  id: DealStatus;
  label: string;
  accent: string;
  textColor: string;
  bgWash: string;
  description: string;
};

const COLUMNS: ColumnDef[] = [
  {
    id: 'draft',
    label: 'Черновик',
    accent: '#94a3b8',
    textColor: '#64748b',
    bgWash: '#f8fafc',
    description: 'Готовится',
  },
  {
    id: 'sent',
    label: 'Отправлен',
    accent: '#06b6d4',
    textColor: '#0e7490',
    bgWash: '#ecfeff',
    description: 'Ждём подписи',
  },
  {
    id: 'signed',
    label: 'Подписан',
    accent: '#8b5cf6',
    textColor: '#6d28d9',
    bgWash: '#f5f3ff',
    description: 'Готов к работам',
  },
  {
    id: 'active',
    label: 'В работе',
    accent: '#FF6B35',
    textColor: '#c2410c',
    bgWash: '#fff7ed',
    description: 'Идут выезды',
  },
  {
    id: 'completed',
    label: 'Выполнен',
    accent: '#10b981',
    textColor: '#047857',
    bgWash: '#ecfdf5',
    description: 'Сделка закрыта',
  },
  {
    id: 'terminated',
    label: 'Расторгнут',
    accent: '#ef4444',
    textColor: '#b91c1c',
    bgWash: '#fef2f2',
    description: 'Прекращён',
  },
];

export function DealBoardClient({ initialDeals }: { initialDeals: BoardDeal[] }) {
  const router = useRouter();
  const [deals, setDeals] = useState<BoardDeal[]>(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      const haystack = `${d.contractNumber} ${d.clientShortName ?? ''} ${d.masterName ?? ''} ${d.managerName ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [deals, search]);

  const grouped = useMemo(() => {
    const acc: Record<DealStatus, BoardDeal[]> = {
      draft: [],
      sent: [],
      signed: [],
      active: [],
      completed: [],
      terminated: [],
    };
    for (const d of filtered) acc[d.status].push(d);
    (Object.keys(acc) as DealStatus[]).forEach((k) => {
      acc[k].sort((a, b) => {
        // Сначала по startDate (ближайшие сверху), затем по contractDate
        const aRef = a.startDate ?? a.contractDate ?? '';
        const bRef = b.startDate ?? b.contractDate ?? '';
        return aRef.localeCompare(bRef);
      });
    });
    return acc;
  }, [filtered]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const dealId = String(active.id);
    const newStatus = over.id as DealStatus;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.status === newStatus) return;

    // Optimistic update
    const prev = deals;
    setDeals((cur) => cur.map((d) => (d.id === dealId ? { ...d, status: newStatus } : d)));

    startTransition(async () => {
      const res = await updateDealStatus(dealId, { status: newStatus });
      if (!res.ok) {
        toast.error(res.error ?? 'Не удалось');
        setDeals(prev);
        return;
      }
      const colLabel = COLUMNS.find((c) => c.id === newStatus)?.label ?? newStatus;
      toast.success(`Сделка → «${colLabel}»`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Тулбар */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру / клиенту / мастеру"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-poison-green/60 focus:ring-1 focus:ring-poison-green/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-xs text-content-muted">
          Всего: <strong className="text-content-primary">{filtered.length}</strong>
          {filtered.length !== deals.length && <span> из {deals.length}</span>}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {COLUMNS.map((c) => (
            <DealColumn key={c.id} column={c} deals={grouped[c.id]} />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────
function DealColumn({ column, deals }: { column: ColumnDef; deals: BoardDeal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const totalAmount = deals.length;

  return (
    <div className="flex flex-col min-w-0 min-h-[400px]">
      {/* Header */}
      <div
        className="px-3 py-2 rounded-t-lg border-b-2 transition-all"
        style={{
          borderColor: column.accent,
          backgroundColor: column.bgWash,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div
              className="text-[10px] font-orbitron font-semibold uppercase tracking-wider truncate"
              style={{ color: column.textColor }}
            >
              {column.label}
            </div>
            <div className="text-[9px] text-content-muted truncate">
              {column.description}
            </div>
          </div>
          <span
            className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded text-[10px] font-orbitron font-bold tabular-nums"
            style={{
              backgroundColor: column.accent,
              color: '#ffffff',
            }}
          >
            {totalAmount}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 rounded-b-lg space-y-2 transition-colors min-h-[100px] border border-t-0 ${
          isOver
            ? 'border-neon-orange/50 bg-neon-orange/5'
            : 'border-gray-200 bg-gray-50/40'
        }`}
      >
        {deals.length === 0 ? (
          <div className="text-[10px] text-content-muted text-center py-6 italic">
            Перетащи сюда сделку
          </div>
        ) : (
          deals.map((d) => <DealCard key={d.id} deal={d} columnAccent={column.accent} />)
        )}
      </div>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────
function DealCard({
  deal,
  isOverlay = false,
  columnAccent,
}: {
  deal: BoardDeal;
  isOverlay?: boolean;
  columnAccent?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging && !isOverlay ? 0.4 : 1,
    borderLeftColor: columnAccent ?? '#94a3b8',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        group bg-white rounded-md border border-gray-200 p-2.5 cursor-grab active:cursor-grabbing
        border-l-[3px] transition-all
        hover:shadow-md hover:border-neon-orange/30
        ${isOverlay ? 'shadow-xl ring-2 ring-neon-orange/40 rotate-1 scale-105' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <Link
          href={`/manager/deals/${deal.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="font-mono text-[11px] font-semibold text-content-primary hover:text-neon-orange truncate"
        >
          {deal.contractNumber}
        </Link>
      </div>

      <div className="text-xs text-content-primary mb-1.5 line-clamp-2 leading-tight">
        {deal.clientShortName ?? '—'}
      </div>

      {(deal.startDate || deal.endDate) && (
        <div className="flex items-center gap-1 text-[10px] text-content-muted mb-1">
          <CalendarIcon className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{formatPeriod(deal.startDate, deal.endDate)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-content-muted/80">
        {deal.masterName && (
          <span className="inline-flex items-center gap-1 truncate min-w-0">
            <Wrench className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{deal.masterName}</span>
          </span>
        )}
        {deal.managerName && (
          <span className="inline-flex items-center gap-1 truncate min-w-0">
            <UserIcon className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{deal.managerName}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return 'Без даты';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  if (start && end) {
    if (start === end) return fmt(start);
    return `${fmt(start)} — ${fmt(end)}`;
  }
  return start ? `с ${fmt(start)}` : `до ${fmt(end!)}`;
}
