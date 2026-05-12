import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema/settings';
import { STALE_THRESHOLDS } from '@/lib/lead-stages';
import type { LeadStatus } from '@/lib/db/schema/leads';

// Server-only: пороги «зависания» лидов с возможностью переопределения через
// /admin/settings (UI-edit). Если в БД нет — fallback на STALE_THRESHOLDS из
// lib/lead-stages.ts (хардкод, синхронизирован с UI индикаторами badge).

export const THRESHOLDS_KEY = 'notification_thresholds';

// Только статусы которые имеют пороги (не финальные)
export const THRESHOLD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'contract_signed',
  'works_completed',
] as const satisfies readonly LeadStatus[];

export type ThresholdStatus = (typeof THRESHOLD_STATUSES)[number];

export type StageThresholds = Record<ThresholdStatus, { warn: number; stale: number }>;

/** Хардкод-дефолты из lib/lead-stages.ts. Используются если в БД нет настроек. */
export function defaultThresholds(): StageThresholds {
  const out = {} as StageThresholds;
  for (const s of THRESHOLD_STATUSES) {
    const t = STALE_THRESHOLDS[s];
    out[s] = t ?? { warn: 0, stale: 999999 };
  }
  return out;
}

/**
 * Получить текущие пороги. Сначала пробуем БД, иначе хардкод.
 * Кэш в памяти НЕ делаем — таблица крошечная, запрос дешёвый, а инвалидация
 * после save сложнее.
 */
export async function getThresholds(): Promise<StageThresholds> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, THRESHOLDS_KEY))
    .limit(1);

  const fallback = defaultThresholds();
  if (rows.length === 0) return fallback;

  // Безопасный merge: для отсутствующих в БД ключей — берём из дефолтов.
  // Игнорируем мусор в JSON (некорректные числа, лишние ключи).
  const stored = rows[0].value as Partial<Record<ThresholdStatus, { warn?: number; stale?: number }>> | null;
  if (!stored || typeof stored !== 'object') return fallback;

  const result = {} as StageThresholds;
  for (const s of THRESHOLD_STATUSES) {
    const dbVal = stored[s];
    const def = fallback[s];
    const warn = typeof dbVal?.warn === 'number' && dbVal.warn >= 0 ? dbVal.warn : def.warn;
    const stale = typeof dbVal?.stale === 'number' && dbVal.stale >= 1 ? dbVal.stale : def.stale;
    result[s] = { warn, stale };
  }
  return result;
}

/**
 * Сохранить пороги в БД. Используется из admin UI.
 * Перезаписывает целиком — не делаем поэтапный merge.
 */
export async function saveThresholds(
  value: StageThresholds,
  updatedById: string,
): Promise<void> {
  // Валидация перед записью
  for (const s of THRESHOLD_STATUSES) {
    const t = value[s];
    if (!t || typeof t.warn !== 'number' || typeof t.stale !== 'number') {
      throw new Error(`Invalid threshold for ${s}`);
    }
    if (t.warn < 0 || t.stale < 1 || t.warn > t.stale) {
      throw new Error(`Invalid range for ${s}: warn=${t.warn}, stale=${t.stale}`);
    }
  }

  await db
    .insert(appSettings)
    .values({
      key: THRESHOLDS_KEY,
      value,
      updatedAt: new Date(),
      updatedById,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date(), updatedById },
    });
}

/**
 * Удалить настройки → возврат к хардкод-дефолтам.
 */
export async function resetThresholds(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, THRESHOLDS_KEY));
}
