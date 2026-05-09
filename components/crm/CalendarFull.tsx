'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import ruLocale from '@fullcalendar/core/locales/ru';
import type { EventClickArg, EventContentArg } from '@fullcalendar/core';

// Sсериализованный DealEvent: даты приходят как ISO-строки от server-component
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

const HEALTH_COLOR: Record<SerializedDealEvent['health'], { bg: string; border: string; text: string }> = {
  past: { bg: '#e5e7eb', border: '#9ca3af', text: '#374151' },
  today: { bg: '#10b981', border: '#059669', text: '#ffffff' },
  soon: { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },
  future: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  'no-date': { bg: '#d1d5db', border: '#9ca3af', text: '#4b5563' },
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  signed: 'Подписан',
  active: 'В работе',
  completed: 'Выполнен',
  terminated: 'Расторгнут',
};

export function CalendarFull({
  events,
  dealHrefBase,
}: {
  events: SerializedDealEvent[];
  dealHrefBase: string; // '/manager/deals' или '/master/deals'
}) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Преобразуем в формат FullCalendar EventInput
  // Лиды без startDate в календаре не показываем — выводим отдельным блоком ниже.
  const fcEvents = events
    .filter((e) => e.startDate || e.endDate)
    .map((e) => {
      const colors = HEALTH_COLOR[e.health];
      const start = e.startDate ?? e.endDate!;
      // FullCalendar по дефолту трактует end как exclusive (показывает на день меньше).
      // Прибавляем 1 день к endDate чтобы корректно красить весь диапазон в month-view.
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
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        extendedProps: {
          dealId: e.id,
          health: e.health,
          status: e.status,
          clientShortName: e.clientShortName,
          clientPhone: e.clientPhone,
          masterName: e.masterName,
          managerName: e.managerName,
          contractNumber: e.contractNumber,
        },
      };
    });

  const noDateEvents = events.filter((e) => !e.startDate && !e.endDate);

  function handleEventClick(arg: EventClickArg) {
    const dealId = arg.event.extendedProps.dealId as string;
    router.push(`${dealHrefBase}/${dealId}`);
  }

  function renderEventContent(arg: EventContentArg) {
    const ext = arg.event.extendedProps as SerializedDealEvent & { contractNumber: string };
    return (
      <div className="px-1 py-0.5 text-[11px] leading-tight overflow-hidden cursor-pointer">
        <div className="font-mono font-medium truncate">{ext.contractNumber}</div>
        {ext.clientShortName && <div className="truncate opacity-90">{ext.clientShortName}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="fc-deztech-wrapper bg-white rounded-lg border border-gray-200 p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          locale={ruLocale}
          firstDay={1}
          height="auto"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth',
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
          dayMaxEvents={3}
          weekends
          eventMouseEnter={(arg) => setHoveredId(arg.event.id)}
          eventMouseLeave={() => setHoveredId(null)}
          noEventsContent="Выездов нет"
        />
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-3 text-[11px] mt-3 text-content-muted">
        <LegendItem color={HEALTH_COLOR.today.bg} label="Сегодня / в процессе" />
        <LegendItem color={HEALTH_COLOR.soon.bg} label="В течение 7 дней" />
        <LegendItem color={HEALTH_COLOR.future.bg} label="Позже" />
        <LegendItem color={HEALTH_COLOR.past.bg} label="Прошедшие" />
      </div>

      {/* Подробности выезда при наведении */}
      {hoveredId && (() => {
        const e = events.find((x) => x.id === hoveredId);
        if (!e) return null;
        return (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs space-y-1">
            <div className="font-mono font-medium">{e.contractNumber}</div>
            <div>
              <strong>Клиент:</strong> {e.clientShortName ?? '—'}
              {e.clientPhone && <span className="text-content-muted"> · {e.clientPhone}</span>}
            </div>
            <div className="text-content-muted">
              {e.masterName && <span>Мастер: {e.masterName}</span>}
              {e.masterName && e.managerName && ' · '}
              {e.managerName && <span>Менеджер: {e.managerName}</span>}
            </div>
            <div className="text-content-muted">Статус сделки: {STATUS_LABEL[e.status] ?? e.status}</div>
          </div>
        );
      })()}

      {/* Сделки без дат */}
      {noDateEvents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-orbitron tracking-wider uppercase text-content-muted mb-2">
            Без планируемых дат · {noDateEvents.length}
          </h3>
          <div className="space-y-2">
            {noDateEvents.map((e) => (
              <a
                key={e.id}
                href={`${dealHrefBase}/${e.id}`}
                className="block px-3 py-2 rounded border border-gray-200 hover:bg-gray-50 text-sm"
              >
                <span className="font-mono text-xs text-content-primary">{e.contractNumber}</span>
                <span className="text-content-muted"> · {e.clientShortName ?? '—'}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm border"
        style={{ backgroundColor: color, borderColor: color }}
      />
      {label}
    </span>
  );
}
