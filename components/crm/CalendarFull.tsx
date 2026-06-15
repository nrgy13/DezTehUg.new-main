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
import { Search, X, Calendar as CalendarIcon, Phone, Wrench, User as UserIcon, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { updateVisitPlannedAt } from '@/app/(crm)/manager/deals/[id]/visits-actions';
import './calendar.css';

// ─── Types ───────────────────────────────────────────────────
// Sprint 6: события календаря = выезды (work_logs), не периоды договоров.
// id = workLogId, dealId = для href на карточку сделки.
export type SerializedDealEvent = {
  id: string;
  dealId: string;
  contractNumber: string;
  startDate: string | null;
  endDate: string | null;
  /** ISO 8601 timestamp с UTC offset, либо null. */
  startAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  /** Статус выезда: planned | in_progress | completed. */
  status: string;
  clientShortName: string | null;
  clientPhone: string | null;
  masterName: string | null;
  managerName: string | null;
  /** Название услуги (короткое). */
  serviceTitle: string;
  /** Объект работ (адрес). */
  objectName: string | null;
  health: 'past' | 'today' | 'soon' | 'future' | 'no-date';
};

const CALENDAR_TZ = 'Europe/Moscow';

// ─── Маппинги цвет/иконка (статусы ВЫЕЗДА, не сделки) ─────────
const STATUS_BORDER: Record<string, string> = {
  planned: '#f59e0b', // amber — запланирован
  in_progress: '#06b6d4', // cyan — в работе
  completed: '#10b981', // green — выполнен
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Выполнен',
};

const STATUS_ICON: Record<string, string> = {
  planned: '○',
  in_progress: '⚡',
  completed: '✓',
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

// Время HH:MM из ISO-строки (локальный TZ браузера = МСК)
function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// Дата выезда (для группировки/фильтра/подсветки) → Date или null
function eventDate(e: SerializedDealEvent): Date | null {
  const iso = e.startAt ?? (e.startDate ? `${e.startDate}T00:00:00` : null);
  return iso ? new Date(iso) : null;
}

type VisitDayGroup = { dayKey: string; label: string; events: SerializedDealEvent[] };

// Группирует выезды по дню (ключ = локальный YYYY-MM-DD, совпадает с FC data-date).
function groupVisitsByDay(events: SerializedDealEvent[]): VisitDayGroup[] {
  const map = new Map<string, SerializedDealEvent[]>();
  for (const e of events) {
    const d = eventDate(e);
    if (!d) continue;
    const key = toLocalISO(d);
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return Array.from(map.keys())
    .sort()
    .map((key) => {
      const d = new Date(`${key}T00:00:00`);
      const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
      const evs = map
        .get(key)!
        .slice()
        .sort((a, b) => {
          const ta = a.startAt ? new Date(a.startAt).getTime() : 0;
          const tb = b.startAt ? new Date(b.startAt).getTime() : 0;
          return ta - tb;
        });
      return { dayKey: key, label, events: evs };
    });
}

function visitHref(dealHrefBase: string, e: SerializedDealEvent): string {
  return dealHrefBase === '/master/visits'
    ? `/master/visits/${e.id}`
    : `${dealHrefBase}/${e.dealId}?tab=visits`;
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
  // Обёртка FullCalendar — для императивной подсветки ячейки дня по ховеру списка.
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  // Видимый диапазон календаря (синхронизация списка справа) + заголовок вида.
  const [viewRange, setViewRange] = useState<{ start: number; end: number } | null>(null);
  const [viewTitle, setViewTitle] = useState('');

  // Подсветка дня в календаре при наведении на строку списка (YYYY-MM-DD).
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

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
        const haystack =
          `${e.contractNumber} ${e.clientShortName ?? ''} ${e.clientPhone ?? ''} ${e.masterName ?? ''} ${e.serviceTitle} ${e.objectName ?? ''}`.toLowerCase();
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
            title: `${e.serviceTitle} · ${e.objectName ?? e.clientShortName ?? '—'}`,
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

  // Выезды видимого диапазона календаря (список справа синхронен с открытым месяцем/неделей/днём).
  const visibleEvents = useMemo(() => {
    // При активном текстовом поиске показываем ВСЕ совпадения (как в списке клиентов),
    // а не только видимый месяц — иначе найденный выезд из другого месяца не виден.
    if (search.trim()) return filteredEvents;
    if (!viewRange) return [] as SerializedDealEvent[];
    return filteredEvents.filter((e) => {
      const d = eventDate(e);
      if (!d) return false;
      const t = d.getTime();
      return t >= viewRange.start && t < viewRange.end;
    });
  }, [filteredEvents, viewRange, search]);

  const dayGroups = useMemo(() => groupVisitsByDay(visibleEvents), [visibleEvents]);

  // Императивная подсветка ячейки дня в FullCalendar по hoveredDate.
  // DOM-подход надёжнее, чем dayCellClassNames — не зависит от внутренней
  // реактивности FC и работает в month/week/day (ячейки имеют data-date).
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    root.querySelectorAll('.fc-day-hovered').forEach((el) => el.classList.remove('fc-day-hovered'));
    if (hoveredDate) {
      root
        .querySelectorAll(`[data-date="${hoveredDate}"]`)
        .forEach((el) => el.classList.add('fc-day-hovered'));
    }
  }, [hoveredDate, viewRange, fcEvents]);

  // Status counts (для фильтра статусов)
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

  // Event click → открыть выезд (для master) или сделку (для manager)
  function handleEventClick(arg: EventClickArg) {
    hideTooltip();
    const ext = arg.event.extendedProps as SerializedDealEvent;
    // dealHrefBase: '/manager/deals' → переходим на сделку с табом «Выезды»
    //              '/master/visits' → переходим на саму страницу выезда
    if (dealHrefBase === '/master/visits') {
      router.push(`/master/visits/${arg.event.id}`);
    } else {
      router.push(`${dealHrefBase}/${ext.dealId}?tab=visits`);
    }
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

    // Sprint 6: всегда точечное событие выезда (work_log).
    // start/end это Date в локальной TZ браузера, соответствуют моменту МСК.
    const startAtUTC = start.toISOString();
    const endAtUTC = end ? end.toISOString() : null;
    const fmt = new Intl.DateTimeFormat('ru-RU', {
      timeZone: CALENDAR_TZ,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const toastLabel = `Перенесено на ${fmt.format(start)} (МСК)`;

    setIsSavingDrop(true);
    startTransition(async () => {
      try {
        const res = await updateVisitPlannedAt(info.event.id, {
          startAtIso: startAtUTC,
          endAtIso: endAtUTC,
        });
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
        // пересоздать FC events с актуальными данными.
        setTimeout(() => setIsSavingDrop(false), 350);
      }
    });
  }

  // Sync видимого диапазона + заголовка с FullCalendar
  function handleDatesSet(arg: DatesSetArg) {
    setViewTitle(arg.view.title);
    setViewRange({ start: arg.start.getTime(), end: arg.end.getTime() });
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
        <span className="fc-event-chip__num">{ext.serviceTitle}</span>
        <span className="fc-event-chip__client">
          {ext.objectName ?? ext.clientShortName ?? '—'}
        </span>
        <span className="fc-event-chip__icon" style={{ color: STATUS_BORDER[ext.status] }}>
          {icon}
        </span>
      </div>
    );
  }

  const hasActiveFilters = search || statusFilter.size > 0 || healthFilter.size > 0;

  return (
    <>
      {/* ─── Компактная панель: поиск + фильтры ──────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-2.5 mb-4 flex flex-col lg:flex-row lg:items-center gap-2.5">
        {/* Поиск */}
        <div className="relative lg:w-72 flex-shrink-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Номер / клиент / телефон / мастер / услуга"
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

        {/* Статусы выезда */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(STATUS_LABEL).map(([key, label]) => {
            const cnt = statusCounts[key] ?? 0;
            const active = statusFilter.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleStatus(key)}
                disabled={cnt === 0}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
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
                {label}
                <span className="text-[9px] tabular-nums opacity-70">{cnt}</span>
              </button>
            );
          })}
        </div>

        {/* Срочность */}
        <div className="flex flex-wrap gap-1 lg:ml-auto">
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

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex-shrink-0 px-2.5 py-1 text-[10px] text-neon-orange hover:bg-neon-orange/5 rounded border border-neon-orange/20 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Сбросить
          </button>
        )}
      </div>

      {/* ─── Список (слева) + Календарь (справа), равной высоты ─── */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
        {/* Список выездов — слева, основная рабочая зона.
            lg:relative + внутренний lg:absolute inset-0 → высоту колонки задаёт
            календарь (справа), а список ровно под неё со скроллом. */}
        <aside className="w-full lg:w-[30rem] xl:w-[34rem] lg:flex-shrink-0 lg:relative">
          <div className="flex flex-col gap-3 lg:absolute lg:inset-0">
          <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted truncate">
                Выезды{viewTitle ? ` · ${viewTitle}` : ''}
              </div>
              <span className="text-[10px] text-content-muted tabular-nums flex-shrink-0 ml-2">
                {visibleEvents.length}
              </span>
            </div>
            <div className="relative overflow-y-auto flex-1 min-h-0 pr-1">
              <VisitsList groups={dayGroups} dealHrefBase={dealHrefBase} onHoverDay={setHoveredDate} />
            </div>
          </div>

          {/* Выезды без дат */}
          {noDateEvents.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 flex-shrink-0">
              <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Без планируемых дат · {noDateEvents.length}
              </div>
              <div className="space-y-1">
                {noDateEvents.map((e) => (
                  <a
                    key={e.id}
                    href={visitHref(dealHrefBase, e)}
                    className="block px-2.5 py-1.5 rounded border border-gray-200 hover:border-neon-orange/40 hover:bg-neon-orange/5 transition-colors"
                    style={{ borderLeftWidth: 3, borderLeftColor: STATUS_BORDER[e.status] ?? '#94a3b8' }}
                  >
                    <div className="text-xs text-content-primary truncate flex items-center gap-1.5">
                      <span style={{ color: STATUS_BORDER[e.status] }}>{STATUS_ICON[e.status] ?? '·'}</span>
                      {e.serviceTitle}
                    </div>
                    <div className="text-[11px] text-content-muted truncate pl-[18px]">
                      {e.objectName ?? e.clientShortName ?? '—'}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          </div>
        </aside>

        {/* Календарь — справа */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div
            ref={wrapperRef}
            className="fc-deztech-wrapper bg-white rounded-lg border border-gray-200 shadow-sm p-4"
          >
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

          {canDragDates && (
            <div className="text-[10px] text-content-muted px-1">
              💡 Перетаскивай выезды прямо в календаре для быстрого переноса дат
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

// ─── Список выездов справа ─────────────────────────────────────
function VisitsList({
  groups,
  dealHrefBase,
  onHoverDay,
}: {
  groups: VisitDayGroup[];
  dealHrefBase: string;
  /** Подсветить день в календаре (key=YYYY-MM-DD) или снять подсветку (null). */
  onHoverDay: (key: string | null) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="text-xs text-content-muted px-1 py-8 text-center">
        В этом периоде выездов нет
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.dayKey}>
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm text-[10px] font-orbitron uppercase tracking-wider text-content-muted py-1">
            {g.label}
          </div>
          <div
            className="space-y-1 mt-1"
            onMouseEnter={() => onHoverDay(g.dayKey)}
            onMouseLeave={() => onHoverDay(null)}
          >
            {g.events.map((e) => (
              <a
                key={e.id}
                href={visitHref(dealHrefBase, e)}
                className="block px-3 py-2.5 rounded-lg border border-gray-200 hover:border-neon-orange/40 hover:bg-neon-orange/5 transition-colors"
                style={{ borderLeftWidth: 3, borderLeftColor: STATUS_BORDER[e.status] ?? '#94a3b8' }}
              >
                {/* Шапка: время + статус + срочность */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex-shrink-0" style={{ color: STATUS_BORDER[e.status] }}>
                      {STATUS_ICON[e.status] ?? '·'}
                    </span>
                    {e.startAt && (
                      <span className="text-xs font-semibold text-content-primary tabular-nums flex-shrink-0">
                        {timeOnly(e.startAt)}
                      </span>
                    )}
                    <span
                      className="text-[9px] uppercase tracking-wider px-1.5 py-px rounded-full border font-orbitron whitespace-nowrap"
                      style={{
                        color: STATUS_BORDER[e.status],
                        borderColor: `${STATUS_BORDER[e.status] ?? '#94a3b8'}55`,
                      }}
                    >
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-content-muted flex-shrink-0">
                    {HEALTH_LABEL[e.health]}
                  </span>
                </div>

                {/* Услуги */}
                <div className="text-sm font-medium text-content-primary leading-snug">
                  {e.serviceTitle}
                </div>

                {/* Объект */}
                {e.objectName && (
                  <div className="mt-1 text-xs text-content-secondary flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-content-muted" />
                    <span className="break-words">{e.objectName}</span>
                  </div>
                )}

                {/* Клиент + договор */}
                <div className="mt-0.5 text-xs text-content-muted flex items-center gap-1 truncate">
                  <UserIcon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {e.clientShortName ?? '—'}
                    {e.contractNumber && e.contractNumber !== '—' ? ` · ${e.contractNumber}` : ''}
                  </span>
                </div>

                {/* Телефон + мастер */}
                {(e.clientPhone || e.masterName) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-content-muted">
                    {e.clientPhone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {e.clientPhone}
                      </span>
                    )}
                    {e.masterName && (
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {e.masterName}
                      </span>
                    )}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
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
        <span className="font-semibold text-content-primary">{ev.serviceTitle}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-content-muted font-orbitron">
          {STATUS_LABEL[ev.status] ?? ev.status}
        </span>
      </div>
      {ev.objectName && (
        <div className="flex items-center gap-1.5 text-content-primary">
          <MapPin className="w-3 h-3 text-content-muted" />
          {ev.objectName}
        </div>
      )}
      <div className="text-content-secondary">
        {ev.clientShortName ?? '—'}
        <span className="ml-1.5 text-content-muted font-mono text-[10px]">
          · {ev.contractNumber}
        </span>
      </div>
      {ev.clientPhone && (
        <div className="flex items-center gap-1.5 text-content-secondary">
          <Phone className="w-3 h-3" />
          {ev.clientPhone}
        </div>
      )}
      {(ev.startAt || ev.endAt) && (
        <div className="flex items-center gap-1.5 text-content-secondary">
          <CalendarIcon className="w-3 h-3" />
          {formatVisitWhen(ev.startAt, ev.endAt)}
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
        <span className="ml-2">Клик — открыть выезд</span>
      </div>
    </div>,
    document.body,
  );
}

function formatVisitWhen(startAt: string | null, endAt: string | null): string {
  if (!startAt && !endAt) return '';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  if (startAt && endAt) {
    return `${fmt(startAt)} — ${new Date(endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return fmt(startAt ?? endAt!);
}
