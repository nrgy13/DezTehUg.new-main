'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ruLocale from '@fullcalendar/core/locales/ru';
import type { EventClickArg, EventContentArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Search, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Phone, Wrench, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { updateDealDates } from '@/app/(crm)/manager/deals/actions';
import './calendar.css';

// ─── Types ───────────────────────────────────────────────────
export type SerializedDealEvent = {
  id: string;
  contractNumber: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  clientShortName: string | null;
  clientPhone: string | null;
  masterName: string | null;
  managerName: string | null;
  health: 'past' | 'today' | 'soon' | 'future' | 'no-date';
};

// ─── Маппинги цвет/иконка ────────────────────────────────────
const STATUS_BORDER: Record<string, string> = {
  draft: '#94a3b8',       // gray-400 — незаконченный
  sent: '#06b6d4',        // cyan-500 — отправлен
  signed: '#8b5cf6',      // violet-500 — подписан
  active: '#FF6B35',      // neon-orange — в работе (главный акцент)
  completed: '#10b981',   // emerald-500 — выполнен
  terminated: '#ef4444',  // red-500 — расторгнут
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  signed: 'Подписан',
  active: 'В работе',
  completed: 'Выполнен',
  terminated: 'Расторгнут',
};

const STATUS_ICON: Record<string, string> = {
  draft: '○',
  sent: '◐',
  signed: '✓',
  active: '⚡',
  completed: '★',
  terminated: '✕',
};

const HEALTH_BG: Record<SerializedDealEvent['health'], string> = {
  past: '#f8fafc',
  today: 'rgba(57, 255, 20, 0.10)',     // poison-green wash
  soon: 'rgba(245, 158, 11, 0.08)',     // amber wash
  future: '#ffffff',
  'no-date': '#f8fafc',
};

const HEALTH_LABEL: Record<SerializedDealEvent['health'], string> = {
  past: 'прошло',
  today: 'сегодня',
  soon: 'скоро',
  future: 'позже',
  'no-date': 'без даты',
};

// ─── Component ────────────────────────────────────────────────
export function CalendarFull({
  events,
  dealHrefBase,
  canDragDates = false,
}: {
  events: SerializedDealEvent[];
  dealHrefBase: string;
  /** Может ли пользователь переносить даты drag-n-drop (manager/admin = true, master = false) */
  canDragDates?: boolean;
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [, startTransition] = useTransition();

  // Фильтры
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [healthFilter, setHealthFilter] = useState<Set<SerializedDealEvent['health']>>(new Set());
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${e.contractNumber} ${e.clientShortName ?? ''} ${e.clientPhone ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter.size > 0 && !statusFilter.has(e.status)) return false;
      if (healthFilter.size > 0 && !healthFilter.has(e.health)) return false;
      return true;
    });
  }, [events, search, statusFilter, healthFilter]);

  // Подготовка событий для FullCalendar
  const fcEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => e.startDate || e.endDate)
        .map((e) => {
          const start = e.startDate ?? e.endDate!;
          let end: string | undefined = undefined;
          if (e.endDate) {
            const ed = new Date(e.endDate);
            ed.setDate(ed.getDate() + 1);
            end = ed.toISOString().slice(0, 10);
          }
          return {
            id: e.id,
            title: `${e.contractNumber} · ${e.clientShortName ?? '—'}`,
            start,
            end,
            allDay: true,
            backgroundColor: HEALTH_BG[e.health],
            borderColor: STATUS_BORDER[e.status] ?? '#94a3b8',
            textColor: '#1e293b',
            classNames: e.health === 'today' ? ['fc-event--today-pulse'] : [],
            extendedProps: { ...e },
          };
        }),
    [filteredEvents],
  );

  const noDateEvents = filteredEvents.filter((e) => !e.startDate && !e.endDate);

  // Stats
  const stats = useMemo(
    () => ({
      total: events.length,
      today: events.filter((e) => e.health === 'today').length,
      soon: events.filter((e) => e.health === 'soon').length,
      noDate: events.filter((e) => e.health === 'no-date').length,
    }),
    [events],
  );

  // Status counts (для сайдбара)
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) m[e.status] = (m[e.status] ?? 0) + 1;
    return m;
  }, [events]);

  function toggleStatus(s: string) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleHealth(h: SerializedDealEvent['health']) {
    setHealthFilter((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter(new Set());
    setHealthFilter(new Set());
  }

  // Mini-calendar navigation
  function gotoDate(date: Date) {
    calendarRef.current?.getApi().gotoDate(date);
    setCurrentDate(date);
  }

  // Event click → открыть сделку
  function handleEventClick(arg: EventClickArg) {
    router.push(`${dealHrefBase}/${arg.event.id}`);
  }

  // Drag-n-drop переноса даты
  function handleEventDrop(info: EventDropArg) {
    if (!canDragDates) {
      info.revert();
      return;
    }
    const start = info.event.start;
    const end = info.event.end;
    if (!start) {
      info.revert();
      return;
    }
    const startISO = start.toISOString().slice(0, 10);
    // FullCalendar end exclusive → -1 день
    let endISO: string | null = null;
    if (end) {
      const e = new Date(end);
      e.setDate(e.getDate() - 1);
      endISO = e.toISOString().slice(0, 10);
    }

    startTransition(async () => {
      const res = await updateDealDates(info.event.id, { startDate: startISO, endDate: endISO });
      if (!res.ok) {
        toast.error(res.error ?? 'Не удалось перенести');
        info.revert();
      } else {
        toast.success(`Перенесено на ${startISO}`);
        router.refresh();
      }
    });
  }

  // Title sync с FullCalendar
  function handleDatesSet(arg: DatesSetArg) {
    setCurrentTitle(arg.view.title);
    setCurrentDate(arg.view.currentStart);
  }

  function renderEventContent(arg: EventContentArg) {
    const ext = arg.event.extendedProps as SerializedDealEvent;
    const icon = STATUS_ICON[ext.status] ?? '·';
    return (
      <Tooltip.Root delayDuration={150}>
        <Tooltip.Trigger asChild>
          <div className="fc-event-chip">
            <span className="fc-event-chip__num">{ext.contractNumber}</span>
            <span className="fc-event-chip__client">{ext.clientShortName ?? '—'}</span>
            <span className="fc-event-chip__icon" style={{ color: STATUS_BORDER[ext.status] }}>
              {icon}
            </span>
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            align="start"
            sideOffset={8}
            className="z-50 max-w-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="bg-white rounded-lg border border-gray-200 shadow-xl p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_BORDER[ext.status] }}
                />
                <span className="font-mono font-semibold text-content-primary">
                  {ext.contractNumber}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-content-muted font-orbitron">
                  {STATUS_LABEL[ext.status] ?? ext.status}
                </span>
              </div>
              <div className="text-content-primary font-medium">
                {ext.clientShortName ?? '—'}
              </div>
              {ext.clientPhone && (
                <div className="flex items-center gap-1.5 text-content-secondary">
                  <Phone className="w-3 h-3" />
                  {ext.clientPhone}
                </div>
              )}
              {(ext.startDate || ext.endDate) && (
                <div className="flex items-center gap-1.5 text-content-secondary">
                  <CalendarIcon className="w-3 h-3" />
                  {formatPeriod(ext.startDate, ext.endDate)}
                </div>
              )}
              {ext.masterName && (
                <div className="flex items-center gap-1.5 text-content-muted">
                  <Wrench className="w-3 h-3" />
                  Мастер: {ext.masterName}
                </div>
              )}
              {ext.managerName && (
                <div className="flex items-center gap-1.5 text-content-muted">
                  <UserIcon className="w-3 h-3" />
                  Менеджер: {ext.managerName}
                </div>
              )}
              <div className="pt-1.5 mt-1.5 border-t border-gray-100 text-[10px] text-content-muted">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium"
                  style={{
                    backgroundColor: HEALTH_BG[ext.health],
                    color: STATUS_BORDER[ext.status],
                  }}
                >
                  {HEALTH_LABEL[ext.health]}
                </span>
                <span className="ml-2">Клик — открыть сделку</span>
              </div>
            </div>
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return (
    <Tooltip.Provider>
      <div className="flex gap-4 items-start">
        {/* ─── Сайдбар ────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 space-y-4 sticky top-4">
          {/* Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
              Сводка
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <StatChip label="Всего" value={stats.total} accent="muted" />
              <StatChip label="Сегодня" value={stats.today} accent="green" />
              <StatChip label="Скоро" value={stats.soon} accent="orange" />
              <StatChip label="Без даты" value={stats.noDate} accent="muted" />
            </div>
          </div>

          {/* Mini calendar */}
          <MiniCalendar currentDate={currentDate} onDateClick={gotoDate} events={events} />

          {/* Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
              Поиск
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Номер / клиент / телефон"
                className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-poison-green/60 focus:ring-1 focus:ring-poison-green/30"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
              Статус сделки
            </div>
            <div className="space-y-1">
              {Object.entries(STATUS_LABEL).map(([key, label]) => {
                const cnt = statusCounts[key] ?? 0;
                const active = statusFilter.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleStatus(key)}
                    disabled={cnt === 0}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      active
                        ? 'bg-neon-orange/10 text-neon-orange'
                        : cnt === 0
                        ? 'text-content-muted/40 cursor-not-allowed'
                        : 'text-content-secondary hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_BORDER[key] }}
                    />
                    <span className="flex-1 text-left">{label}</span>
                    <span className="text-[10px] tabular-nums opacity-70">{cnt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Health filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
              Срочность
            </div>
            <div className="flex flex-wrap gap-1">
              {(['today', 'soon', 'future', 'past', 'no-date'] as const).map((h) => {
                const cnt = events.filter((e) => e.health === h).length;
                const active = healthFilter.has(h);
                return (
                  <button
                    key={h}
                    onClick={() => toggleHealth(h)}
                    disabled={cnt === 0}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-poison-green/15 text-emerald-700 ring-1 ring-emerald-400/40'
                        : cnt === 0
                        ? 'bg-gray-50 text-content-muted/40 cursor-not-allowed'
                        : 'bg-gray-100 text-content-secondary hover:bg-gray-200'
                    }`}
                  >
                    {HEALTH_LABEL[h]} · {cnt}
                  </button>
                );
              })}
            </div>
          </div>

          {(search || statusFilter.size > 0 || healthFilter.size > 0) && (
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 text-xs text-neon-orange hover:bg-neon-orange/5 rounded border border-neon-orange/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-3 h-3" />
              Сбросить фильтры
            </button>
          )}

          {canDragDates && (
            <div className="text-[10px] text-content-muted px-2 leading-relaxed">
              💡 Перетаскивай выезды между датами для быстрого переноса
            </div>
          )}
        </aside>

        {/* ─── Основной грид ──────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="fc-deztech-wrapper bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              locale={ruLocale}
              firstDay={1}
              height="auto"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
              }}
              buttonText={{
                today: 'Сегодня',
                month: 'Месяц',
                week: 'Неделя',
                day: 'День',
                list: 'Список',
              }}
              events={fcEvents}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              eventDrop={handleEventDrop}
              datesSet={handleDatesSet}
              editable={canDragDates}
              droppable={canDragDates}
              dayMaxEvents={3}
              weekends
              nowIndicator
              dayHeaderFormat={{ weekday: 'short', day: 'numeric', omitCommas: true }}
              noEventsContent="Выездов нет"
              eventDisplay="block"
            />
          </div>

          {/* Сделки без дат */}
          {noDateEvents.length > 0 && (
            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Без планируемых дат · {noDateEvents.length}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {noDateEvents.map((e) => (
                  <a
                    key={e.id}
                    href={`${dealHrefBase}/${e.id}`}
                    className="block px-3 py-2 rounded border border-gray-200 hover:border-neon-orange/40 hover:bg-neon-orange/5 transition-colors text-sm"
                    style={{ borderLeftWidth: 3, borderLeftColor: STATUS_BORDER[e.status] ?? '#94a3b8' }}
                  >
                    <div className="font-mono text-xs text-content-primary truncate flex items-center gap-1.5">
                      <span style={{ color: STATUS_BORDER[e.status] }}>{STATUS_ICON[e.status] ?? '·'}</span>
                      {e.contractNumber}
                    </div>
                    <div className="text-xs text-content-muted truncate">{e.clientShortName ?? '—'}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Tooltip.Provider>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return 'Без даты';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) {
    if (start === end) return fmt(start);
    return `${fmt(start)} — ${fmt(end)}`;
  }
  return start ? `с ${fmt(start)}` : `до ${fmt(end!)}`;
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'muted' | 'green' | 'orange';
}) {
  const accentClasses = {
    muted: 'text-content-primary',
    green: 'text-emerald-600',
    orange: 'text-neon-orange',
  };
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-[9px] uppercase tracking-wider text-content-muted font-orbitron">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${accentClasses[accent]}`}>{value}</div>
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────
function MiniCalendar({
  currentDate,
  onDateClick,
  events,
}: {
  currentDate: Date;
  onDateClick: (d: Date) => void;
  events: SerializedDealEvent[];
}) {
  const [viewDate, setViewDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

  useEffect(() => {
    setViewDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate]);

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.startDate) set.add(e.startDate);
      if (e.endDate && e.endDate !== e.startDate) set.add(e.endDate);
    }
    return set;
  }, [events]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // понедельник как первый
  const totalDays = lastDay.getDate();

  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  function prev() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function next() {
    setViewDate(new Date(year, month + 1, 1));
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prev}
          className="p-1 hover:bg-gray-100 rounded text-content-muted hover:text-content-primary"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="text-[11px] font-orbitron tracking-wider uppercase text-content-primary text-center capitalize flex-1">
          {monthLabel}
        </div>
        <button
          onClick={next}
          className="p-1 hover:bg-gray-100 rounded text-content-muted hover:text-content-primary"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-[9px] text-content-muted text-center mb-1">
        {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="h-6" />;
          const dateKey = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}-${String(c.date.getDate()).padStart(2, '0')}`;
          const isToday = dateKey === todayKey;
          const hasEvents = eventDays.has(dateKey);
          const isCurrent =
            c.date.getDate() === currentDate.getDate() &&
            c.date.getMonth() === currentDate.getMonth() &&
            c.date.getFullYear() === currentDate.getFullYear();
          return (
            <button
              key={i}
              onClick={() => onDateClick(c.date)}
              className={`h-6 text-[10px] rounded transition-colors relative tabular-nums ${
                isCurrent
                  ? 'bg-neon-orange text-white font-bold'
                  : isToday
                  ? 'bg-neon-orange/10 text-neon-orange font-semibold'
                  : 'text-content-secondary hover:bg-gray-100'
              }`}
            >
              {c.day}
              {hasEvents && !isCurrent && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-poison-green" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
