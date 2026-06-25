'use client';

import { useMemo, useState } from 'react';
import { Search, X, MapPin, Wrench, User as UserIcon, FlaskConical, ListChecks } from 'lucide-react';
import type { SerializedVisitHistoryItem } from '@/lib/calendar/deal-events';

// Ссылка на выезд: у мастера — на страницу выезда, у менеджера — на сделку (таб «Выезды»).
function historyHref(hrefBase: string, item: SerializedVisitHistoryItem): string {
  return hrefBase === '/master/visits'
    ? `/master/visits/${item.id}`
    : `${hrefBase}/${item.dealId}?tab=visits`;
}

type DayGroup = { dayKey: string; label: string; items: SerializedVisitHistoryItem[] };

// Локальная (МСК = browser TZ) дата YYYY-MM-DD. Группируем по ней, а НЕ по UTC-срезу
// ISO-строки: иначе выезды, завершённые ночью (00:00–03:00 МСК), уезжали бы в предыдущий
// день — рассинхрон со временем в карточке. Тот же подход, что в CalendarFull.
function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Группировка по дню выполнения, новые сверху (DESC). «Без даты» — в конце.
function groupByDayDesc(items: SerializedVisitHistoryItem[]): DayGroup[] {
  const map = new Map<string, SerializedVisitHistoryItem[]>();
  for (const it of items) {
    const key = it.completedAt ? toLocalISO(new Date(it.completedAt)) : 'no-date';
    const arr = map.get(key) ?? [];
    arr.push(it);
    map.set(key, arr);
  }
  const keys = Array.from(map.keys())
    .filter((k) => k !== 'no-date')
    .sort()
    .reverse();
  const groups: DayGroup[] = keys.map((key) => {
    const d = new Date(`${key}T00:00:00`);
    const label = d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'short',
    });
    return { dayKey: key, label, items: map.get(key)! };
  });
  if (map.has('no-date')) {
    groups.push({ dayKey: 'no-date', label: 'Без даты', items: map.get('no-date')! });
  }
  return groups;
}

function timeOnly(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function VisitHistoryList({
  items,
  hrefBase,
}: {
  items: SerializedVisitHistoryItem[];
  hrefBase: string;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const haystack =
        `${it.contractNumber} ${it.clientShortName ?? ''} ${it.masterName ?? ''} ${it.services.join(' ')} ${it.objectName ?? ''} ${it.preparations ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const groups = useMemo(() => groupByDayDesc(filtered), [filtered]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      {/* Шапка: счётчик + поиск */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="text-[10px] font-orbitron tracking-wider uppercase text-content-muted">
          История выполненных · {filtered.length}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Клиент / договор / мастер / услуга / объект"
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-poison-green/60 focus:ring-1 focus:ring-poison-green/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
              aria-label="Очистить поиск"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-xs text-content-muted px-1 py-10 text-center">
          {items.length === 0 ? 'Выполненных выездов пока нет' : 'Ничего не найдено'}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.dayKey}>
              <div className="text-[10px] font-orbitron uppercase tracking-wider text-content-muted py-1 border-b border-gray-100 mb-2">
                {g.label}
              </div>
              <div className="space-y-2">
                {g.items.map((it) => (
                  <a
                    key={it.id}
                    href={historyHref(hrefBase, it)}
                    className="block px-3 py-2.5 rounded-lg border border-gray-200 hover:border-neon-orange/40 hover:bg-neon-orange/5 transition-colors"
                    style={{ borderLeftWidth: 3, borderLeftColor: '#10b981' }}
                  >
                    {/* Шапка карточки: время + бейдж «Выполнен» + чеклист */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-emerald-600 flex-shrink-0">✓</span>
                        {it.completedAt && (
                          <span className="text-xs font-semibold text-content-primary tabular-nums flex-shrink-0">
                            {timeOnly(it.completedAt)}
                          </span>
                        )}
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-px rounded-full border font-orbitron whitespace-nowrap text-emerald-700 border-emerald-200 bg-emerald-50">
                          Выполнен
                        </span>
                      </div>
                      {it.checklistTotal > 0 && (
                        <span className="text-[10px] text-content-muted inline-flex items-center gap-1 flex-shrink-0">
                          <ListChecks className="w-3 h-3" />
                          {it.checklistDone}/{it.checklistTotal}
                        </span>
                      )}
                    </div>

                    {/* Услуги */}
                    <div className="text-sm font-medium text-content-primary leading-snug">
                      {it.services.join(', ')}
                    </div>

                    {/* Объект */}
                    {it.objectName && (
                      <div className="mt-1 text-xs text-content-secondary flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-content-muted" />
                        <span className="break-words">{it.objectName}</span>
                      </div>
                    )}

                    {/* Клиент + договор */}
                    <div className="mt-0.5 text-xs text-content-muted flex items-center gap-1 truncate">
                      <UserIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {it.clientShortName ?? '—'}
                        {it.contractNumber && it.contractNumber !== '—'
                          ? ` · ${it.contractNumber}`
                          : ''}
                      </span>
                    </div>

                    {/* Мастер + препараты */}
                    {(it.preparations || it.masterName) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-content-muted">
                        {it.masterName && (
                          <span className="inline-flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {it.masterName}
                          </span>
                        )}
                        {it.preparations && (
                          <span className="inline-flex items-center gap-1">
                            <FlaskConical className="w-3 h-3" />
                            {it.preparations}
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
      )}
    </div>
  );
}
