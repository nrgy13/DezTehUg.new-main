'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ruLocale from '@fullcalendar/core/locales/ru';
import type { EventClickArg, EventContentArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
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
  /** ISO 8601 timestamp с UTC offset, либо null. */
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  status: string;
  clientShortName: string | null;
  clientPhone: string | null;
  masterName: string | null;
  managerName: string | null;
  health: 'past' | 'today' | 'soon' | 'future' | 'no-date';
};

const CALENDAR_TZ = 'Europe/Moscow';

/** Date → 'YYYY-MM-DD' в TZ='Europe/Moscow'. */
function toMoscowDateISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}


// ─── Маппинги цвет/иконка ────────────────────────────────────
const STATUS_BORDER: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#06b6d4',
  signed: '#8b5cf6',
  active: '#FF6B35',
  completed: '#10b981',
  terminated: '#ef4444',
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
  today: 'rgba(57, 255, 20, 0.10)',
  soon: 'rgba(245, 158, 11, 0.08)',
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

const TOOLTIP_DELAY = 600;

// Локальная YYYY-MM-DD без UTC-конверсии (учитывает локальный TZ браузера)
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  ev: SerializedDealEvent | null;
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
  const [isPending, startTransition] = useTransition();
  // Lock на время save → router.refresh, иначе быстрые подряд-drop'ы попадают
  // в очередь startTransition и второй info.event ссылается на stale объект
  // (FC re-mount events после refresh).
  const [isSavingDrop, setIsSavingDrop] = useState(false);
  const dragLocked = isPending || isSavingDrop;

  // Фильтры
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [healthFilter, setHealthFilter] = useState<Set<SerializedDealEvent['health']>>(new Set());
  const [, setCurrentTitle] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Cursor-following tooltip
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, ev: null });
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showTooltipDelayed(ev: SerializedDealEvent, x: number, y: number) {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ visible: true, x, y, ev });
    }, TOOLTIP_DELAY);
  }

  function moveTooltip(x: number, y: number) {
    setTooltip((prev) => (prev.visible ? { ...prev, x, y } : prev));
  }

  function hideTooltip() {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltip({ visible: false, x: 0, y: 0, ev: null });
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, []);

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
        .filter((e) => e.startDate || e.endDate || e.startAt || e.endAt)
        .map((e) => {
          const allDay = e.isAllDay;
          let start: string;
          let end: string | undefined;
          if (allDay) {
            // Все события без времени — old-style: date 'YYYY-MM-DD'
            start = e.startDate ?? e.endDate!;
            if (e.endDate) {
              const ed = new Date(e.endDate);
              ed.setDate(ed.getDate() + 1);
              end = toLocalISO(ed);
            }
          } else {
            // Точечное событие с временем — ISO 8601 с offset, FullCalendar парсит в timeZone
            start = e.startAt ?? e.endAt!;
            end = e.endAt ?? undefined;
          }
          return {
            id: e.id,
            title: `${e.contractNumber} · ${e.clientShortName ?? '—'}`,
            start,
            end,
            allDay,
            backgroundColor: HEALTH_BG[e.health],
            borderColor: STATUS_BORDER[e.status] ?? '#94a3b8',
            textColor: '#1e293b',
            classNames: e.health === 'today' ? ['fc-event--today-pulse'] : [],
            extendedProps: { ...e },
          };
        }),
    [filteredEvents],
  );

  const noDateEvents = filteredEvents.filter(
    (e) => !e.startDate && !e.endDate && !e.startAt && !e.endAt,
  );

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
    hideTooltip();
    router.push(`${dealHrefBase}/${arg.event.id}`);
  }

  // Drag-n-drop переноса даты/времени — поддержка allDay и точечных событий
  function handleEventDrop(info: EventDropArg) {
    hideTooltip();
    if (!canDragDates) {
      info.revert();
      return;
    }
    if (dragLocked) {
      // Save предыдущего drag ещё не завершился. Откатываем чтобы избежать stale event.
      info.revert();
      toast.warning('Подожди — сохраняю предыдущий перенос');
      return;
    }
    const start = info.event.start;
    const end = info.event.end;
    if (!start) {
      info.revert();
      return;
    }

    const isAllDay = info.event.allDay;
    let payload: {
      startAt: string | null;
      endAt: string | null;
      isAllDay: boolean;
    };
    let toastLabel: string;

    if (isAllDay) {
      // event.start в TZ календаря (Europe/Moscow), 00:00. Конвертируем в UTC ISO.
      // FullCalendar end exclusive → -1 день для отображения.
      const startMSK = toMoscowDateISO(start);
      const startAtUTC = new Date(`${startMSK}T00:00:00+03:00`).toISOString();
      let endAtUTC: string | null = null;
      if (end) {
        const eDate = new Date(end);
        eDate.setDate(eDate.getDate() - 1);
        const endMSK = toMoscowDateISO(eDate);
        endAtUTC = new Date(`${endMSK}T23:59:59+03:00`).toISOString();
      }
      payload = { startAt: startAtUTC, endAt: endAtUTC, isAllDay: true };
      toastLabel = `Перенесено на ${startMSK}`;
    } else {
      // Точечное событие с временем — start/end это Date в локальной TZ браузера,
      // но соответствуют моменту в Europe/Moscow. .toISOString() = верный UTC.
      const startAtUTC = start.toISOString();
      const endAtUTC = end ? end.toISOString() : null;
      const fmt = new Intl.DateTimeFormat('ru-RU', {
        timeZone: CALENDAR_TZ,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      toastLabel = `Перенесено на ${fmt.format(start)} (МСК)`;
      payload = { startAt: startAtUTC, endAt: endAtUTC, isAllDay: false };
    }

    setIsSavingDrop(true);
    startTransition(async () => {
      try {
        const res = await updateDealDates(info.event.id, payload);
        if (!res.ok) {
          toast.error(res.error ?? 'Не удалось перенести');
          info.revert();
        } else {
          toast.success(toastLabel);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка переноса');
        info.revert();
      } finally {
        // Отпускаем lock с небольшой задержкой, чтобы router.refresh успел
        // пересоздать FC events с актуальными данными (иначе следующий drag
        // может работать со stale событиями).
        setTimeout(() => setIsSavingDrop(false), 350);
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
      <div
        className="fc-event-chip"
        onMouseEnter={(e) => showTooltipDelayed(ext, e.clientX, e.clientY)}
        onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
        onMouseLeave={hideTooltip}
        onMouseDown={hideTooltip}
      >
        <span className="fc-event-chip__num">{ext.contractNumber}</span>
        <span className="fc-event-chip__client">{ext.clientShortName ?? '—'}</span>
        <span className="fc-event-chip__icon" style={{ color: STATUS_BORDER[ext.status] }}>
          {icon}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 items-stretch">
        {/* ─── Сайдбар ────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 flex flex-col gap-4">
          {/* Stats — компактный inline-формат */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
              Сводка
            </div>
            <div className="grid grid-cols-2 gap-1.5">
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

          {/* Status filter — 2 колонки для компактности */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
              Статус сделки
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(STATUS_LABEL).map(([key, label]) => {
                const cnt = statusCounts[key] ?? 0;
                const active = statusFilter.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleStatus(key)}
                    disabled={cnt === 0}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] transition-colors min-w-0 ${
                      active
                        ? 'bg-neon-orange/10 text-neon-orange'
                        : cnt === 0
                        ? 'text-content-muted/40 cursor-not-allowed'
                        : 'text-content-secondary hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_BORDER[key] }}
                    />
                    <span className="flex-1 text-left truncate">{label}</span>
                    <span className="text-[9px] tabular-nums opacity-70 flex-shrink-0">{cnt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spacer — для выравнивания нижних блоков по низу календаря */}
          <div className="flex-1" />

          {/* Сбросить фильтры — внизу sidebar */}
          {(search || statusFilter.size > 0 || healthFilter.size > 0) && (
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 text-xs text-neon-orange hover:bg-neon-orange/5 rounded border border-neon-orange/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <X className="w-3 h-3" />
              Сбросить фильтры
            </button>
          )}
        </aside>

        {/* ─── Основной грид ──────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="fc-deztech-wrapper bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              locale={ruLocale}
              firstDay={1}
              height="auto"
              /* timeZone не задаём — полагаемся на browser TZ (МСК для всех пользователей) */
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
              editable={canDragDates && !dragLocked}
              droppable={canDragDates && !dragLocked}
              dayMaxEvents={3}
              weekends
              nowIndicator
              dayHeaderFormat={{ weekday: 'short', day: 'numeric', omitCommas: true }}
              noEventsContent="Выездов нет"
              eventDisplay="block"
              /* Day/Week view: рабочее окно 06:00–22:00, snap drag к часовой границе.
                 NB: FC v6.1.20 имеет визуальный offset в timeGrid render (event displays
                 ~42-60 min раньше API state). Drag сохраняет всё корректно — это исключительно
                 рендер. Время точно меняется через форму сделки. */
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              snapDuration="01:00:00"
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              allDayText="Весь день"
            />
          </div>

          {/* Срочность — перенесено из sidebar под календарь */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted">
                Срочность
              </div>
              {canDragDates && (
                <div className="text-[10px] text-content-muted">
                  💡 Перетаскивай выезды для быстрого переноса
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['today', 'soon', 'future', 'past', 'no-date'] as const).map((h) => {
                const cnt = events.filter((e) => e.health === h).length;
                const active = healthFilter.has(h);
                return (
                  <button
                    key={h}
                    onClick={() => toggleHealth(h)}
                    disabled={cnt === 0}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
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

          {/* Сделки без дат */}
          {noDateEvents.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
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

      {/* Cursor-following tooltip portal */}
      {tooltip.visible && tooltip.ev && (
        <CursorTooltip ev={tooltip.ev} x={tooltip.x} y={tooltip.y} />
      )}
    </>
  );
}

// ─── Cursor-following tooltip (react portal) ───────────────────
function CursorTooltip({
  ev,
  x,
  y,
}: {
  ev: SerializedDealEvent;
  x: number;
  y: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    // курсор касается левого нижнего угла → tooltip справа и выше курсора
    let left = x + 2;
    let top = y - rect.height - 2;
    // Если уходит за верх экрана — ставим под курсором
    if (top < 8) top = y + 16;
    // Если уходит за правый край — сдвигаем влево
    if (left + rect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - rect.width - 8);
    }
    setPos({ left, top });
  }, [x, y]);

  if (typeof document === 'undefined') return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos?.left ?? 0,
    top: pos?.top ?? 0,
    zIndex: 50,
    pointerEvents: 'none',
    visibility: pos ? 'visible' : 'hidden',
  };

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="deztech-tooltip-fade bg-white rounded-lg border border-gray-200 shadow-xl p-3 text-xs space-y-1.5 max-w-xs"
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: STATUS_BORDER[ev.status] }}
        />
        <span className="font-mono font-semibold text-content-primary">{ev.contractNumber}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-content-muted font-orbitron">
          {STATUS_LABEL[ev.status] ?? ev.status}
        </span>
      </div>
      <div className="text-content-primary font-medium">{ev.clientShortName ?? '—'}</div>
      {ev.clientPhone && (
        <div className="flex items-center gap-1.5 text-content-secondary">
          <Phone className="w-3 h-3" />
          {ev.clientPhone}
        </div>
      )}
      {(ev.startDate || ev.endDate) && (
        <div className="flex items-center gap-1.5 text-content-secondary">
          <CalendarIcon className="w-3 h-3" />
          {formatPeriod(ev.startDate, ev.endDate)}
        </div>
      )}
      {ev.masterName && (
        <div className="flex items-center gap-1.5 text-content-muted">
          <Wrench className="w-3 h-3" />
          Мастер: {ev.masterName}
        </div>
      )}
      {ev.managerName && (
        <div className="flex items-center gap-1.5 text-content-muted">
          <UserIcon className="w-3 h-3" />
          Менеджер: {ev.managerName}
        </div>
      )}
      <div className="pt-1.5 mt-1.5 border-t border-gray-100 text-[10px] text-content-muted">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium"
          style={{
            backgroundColor: HEALTH_BG[ev.health],
            color: STATUS_BORDER[ev.status],
          }}
        >
          {HEALTH_LABEL[ev.health]}
        </span>
        <span className="ml-2">Клик — открыть сделку</span>
      </div>
    </div>,
    document.body,
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
    <div className="bg-gray-50 rounded px-2 py-1 flex items-center justify-between">
      <span className="text-[9px] uppercase tracking-wider text-content-muted font-orbitron">
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${accentClasses[accent]}`}>{value}</span>
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
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d, date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const today = new Date();
  const todayKey = toLocalISO(today);

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
          const dateKey = toLocalISO(c.date);
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
