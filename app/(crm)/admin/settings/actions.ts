'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import {
  saveThresholds,
  resetThresholds,
  THRESHOLD_STATUSES,
  type StageThresholds,
  type ThresholdStatus,
} from '@/lib/notifications/thresholds';
import {
  saveAccountantEmail,
  clearAccountantEmail,
} from '@/lib/notifications/accountant';

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') return null;
  return session.user;
}

async function logActivity(userId: string, action: string, changes?: unknown) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'app_settings',
    entityId: null,
    changesJson: (changes as object) ?? null,
    ip,
    userAgent,
  });
}

/**
 * Сохранить пороги «зависания» лидов. Принимает объект с парами warn/stale
 * для каждой стадии. Валидация: warn >= 0, stale >= 1, warn <= stale.
 */
export async function updateNotificationThresholds(
  input: Record<string, { warn: number; stale: number }>,
): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: 'Только админ может менять настройки' };

  // Собираем структуру строго из whitelisted статусов
  const value = {} as StageThresholds;
  for (const s of THRESHOLD_STATUSES) {
    const v = input[s];
    if (!v) return { ok: false, error: `Не указаны пороги для стадии ${s}` };
    const warn = Number(v.warn);
    const stale = Number(v.stale);
    if (!Number.isFinite(warn) || !Number.isFinite(stale)) {
      return { ok: false, error: `Пороги для ${s} должны быть числами` };
    }
    if (warn < 0 || stale < 1) {
      return { ok: false, error: `Пороги для ${s}: warn ≥ 0, stale ≥ 1` };
    }
    if (warn > stale) {
      return { ok: false, error: `Для ${s} warn (${warn}) не может быть больше stale (${stale})` };
    }
    value[s as ThresholdStatus] = { warn, stale };
  }

  try {
    await saveThresholds(value, actor.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить' };
  }

  await logActivity(actor.id, 'settings.notification_thresholds.update', value);
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function resetNotificationThresholds(): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: 'Только админ может менять настройки' };

  await resetThresholds();
  await logActivity(actor.id, 'settings.notification_thresholds.reset');
  revalidatePath('/admin/settings');
  return { ok: true };
}

/**
 * Sprint 8: сохранить email бухгалтера ДезТехЮг.
 * На этот email уходят счета/УПД по кнопке «Отправить буху».
 */
export async function updateAccountantEmail(email: string): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: 'Только админ может менять настройки' };

  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: 'Email не может быть пустым' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: 'Невалидный формат email' };
  }

  try {
    await saveAccountantEmail(trimmed, actor.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Не удалось сохранить' };
  }

  await logActivity(actor.id, 'settings.accountant_email.update', { email: trimmed });
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function resetAccountantEmail(): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: 'Только админ может менять настройки' };

  await clearAccountantEmail();
  await logActivity(actor.id, 'settings.accountant_email.reset');
  revalidatePath('/admin/settings');
  return { ok: true };
}
