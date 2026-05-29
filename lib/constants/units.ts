// Sprint 9 — единицы измерения прайс-позиций и форматирование количеств.
import type { PriceItemUnit } from '@/lib/db/schema/deals';

export const UNIT_OPTIONS: { value: PriceItemUnit; label: string }[] = [
  { value: 'm2', label: 'м²' },
  { value: 'pcs', label: 'ед.' },
  { value: 'm3', label: 'м³' },
];

// Лейбл единицы. pcs → «ед.» (раньше было «шт»), m3 → «м³», иначе «м²».
export function unitLabel(unit: PriceItemUnit | string | null | undefined): string {
  if (unit === 'pcs') return 'ед.';
  if (unit === 'm3') return 'м³';
  return 'м²';
}

// Кол-во теперь дробное (numeric → string в Drizzle). Рендер в ru-формате
// без лишних нулей: 7.7 → «7,7», 816 → «816», 5 → «5».
export function formatQuantity(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
}
