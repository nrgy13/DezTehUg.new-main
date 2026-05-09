import Link from 'next/link';
import { Calendar, Phone, User as UserIcon, Wrench } from 'lucide-react';
import type { DealEvent, EventGroup } from '@/lib/calendar/deal-events';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';

const HEALTH_COLOR: Record<DealEvent['health'], string> = {
  past: 'border-l-gray-300 bg-gray-50/40',
  today: 'border-l-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-300/40',
  soon: 'border-l-amber-500 bg-amber-50/40',
  future: 'border-l-blue-400 bg-white',
  'no-date': 'border-l-gray-200 bg-gray-50/20',
};

const HEALTH_LABEL: Record<DealEvent['health'], string> = {
  past: 'прошло',
  today: 'сегодня',
  soon: 'скоро',
  future: 'позже',
  'no-date': 'без даты',
};

const HEALTH_BADGE: Record<DealEvent['health'], string> = {
  past: 'bg-gray-100 text-gray-600',
  today: 'bg-emerald-100 text-emerald-700',
  soon: 'bg-amber-100 text-amber-700',
  future: 'bg-blue-50 text-blue-700',
  'no-date': 'bg-gray-100 text-gray-500',
};

export function CalendarList({
  groups,
  dealHrefBase,
}: {
  groups: EventGroup[];
  dealHrefBase: string; // '/manager/deals' или '/master/deals'
}) {
  if (groups.length === 0) {
    return (
      <CyberpunkCard variant="default" hoverEffect={false} className="p-8 text-center">
        <p className="text-content-muted text-sm">Выездов не запланировано.</p>
      </CyberpunkCard>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <h2 className="text-[11px] font-orbitron tracking-wider uppercase text-content-muted mb-2 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            {group.label}
            <span className="text-content-muted/60 normal-case font-sans">
              · {group.events.length} {pluralize(group.events.length, ['выезд', 'выезда', 'выездов'])}
            </span>
          </h2>
          <div className="space-y-2">
            {group.events.map((e) => (
              <Link
                key={e.id}
                href={`${dealHrefBase}/${e.id}`}
                className={`block px-4 py-3 rounded border-l-4 ${HEALTH_COLOR[e.health]} border border-gray-200 hover:bg-poison-green/5 transition-colors`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-content-primary">
                        {e.contractNumber}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${HEALTH_BADGE[e.health]}`}
                      >
                        {HEALTH_LABEL[e.health]}
                      </span>
                      <span className="text-xs text-content-secondary">{e.periodLabel}</span>
                    </div>
                    <div className="mt-1.5 text-sm text-content-primary">
                      {e.clientShortName ?? '—'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-content-muted flex-wrap">
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
                      {e.managerName && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          {e.managerName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
