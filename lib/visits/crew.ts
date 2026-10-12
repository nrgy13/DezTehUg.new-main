/**
 * Бригада заказ-наряда (10.2026, запрос Сани: «есть объекты, где мастера трудятся вместе»).
 *
 * Основной мастер — deal_work_logs.master_id, напарники — deal_work_log_masters.
 * Члены бригады равноправны: каждый видит наряд у себя (список, календарь, история),
 * отмечает чеклист, грузит фото и может завершить выезд. Везде, где раньше стояло
 * «work_log.master_id = я», теперь проверяется членство в бригаде.
 */

import 'server-only';
import { and, asc, eq, exists, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { dealWorkLogs, dealWorkLogMasters } from '@/lib/db/schema/deals';
import { users } from '@/lib/db/schema/users';

export type CrewMember = { id: string; fullName: string };

/** Защита от мусора в форме: в бригаде больше 10 напарников не бывает. */
export const MAX_PARTNERS = 10;

/**
 * SQL-условие для where по deal_work_logs: юзер — член бригады наряда
 * (основной мастер ИЛИ напарник).
 */
export function workLogHasMember(userId: string): SQL {
  return or(
    eq(dealWorkLogs.masterId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(dealWorkLogMasters)
        .where(
          and(
            eq(dealWorkLogMasters.workLogId, dealWorkLogs.id),
            eq(dealWorkLogMasters.userId, userId),
          ),
        ),
    ),
  ) as SQL;
}

/** Юзер — напарник в наряде (основного вызывающий сверяет сам по master_id). */
export async function isWorkLogPartner(workLogId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ one: sql<number>`1` })
    .from(dealWorkLogMasters)
    .where(and(eq(dealWorkLogMasters.workLogId, workLogId), eq(dealWorkLogMasters.userId, userId)))
    .limit(1);
  return !!row;
}

/** Юзер — член бригады наряда: основной мастер или напарник. */
export async function isWorkLogMember(
  wl: { id: string; masterId: string },
  userId: string,
): Promise<boolean> {
  if (wl.masterId === userId) return true;
  return isWorkLogPartner(wl.id, userId);
}

/** Напарники нарядов (без основного), в порядке добавления. Нарядов без напарников в Map нет. */
export async function getPartnersByWorkLogIds(
  workLogIds: string[],
): Promise<Map<string, CrewMember[]>> {
  const out = new Map<string, CrewMember[]>();
  const ids = Array.from(new Set(workLogIds.filter(Boolean)));
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      workLogId: dealWorkLogMasters.workLogId,
      id: users.id,
      fullName: users.fullName,
    })
    .from(dealWorkLogMasters)
    .innerJoin(users, eq(users.id, dealWorkLogMasters.userId))
    .where(inArray(dealWorkLogMasters.workLogId, ids))
    .orderBy(asc(dealWorkLogMasters.createdAt), asc(users.fullName));
  rows.forEach((r) => {
    const list = out.get(r.workLogId) ?? [];
    list.push({ id: r.id, fullName: r.fullName });
    out.set(r.workLogId, list);
  });
  return out;
}

/** id всех членов бригады: основной первым, затем напарники. Для push всей бригаде. */
export async function getCrewIds(workLogId: string, primaryMasterId: string): Promise<string[]> {
  const partners = await getPartnersByWorkLogIds([workLogId]);
  return [primaryMasterId, ...(partners.get(workLogId) ?? []).map((p) => p.id)];
}

/** «Денисов Юрий + Нечепоренко Дмитрий»: основной первым. null — мастера нет вовсе. */
export function crewLabel(
  primaryName: string | null | undefined,
  partners: CrewMember[] | undefined,
): string | null {
  const names = [primaryName, ...(partners ?? []).map((p) => p.fullName)].filter(
    (n): n is string => !!n && n.trim().length > 0,
  );
  return names.length > 0 ? names.join(' + ') : null;
}

const partnerIdsSchema = z.array(z.string().uuid('Некорректный мастер в бригаде'));

/**
 * Основной мастер наряда — существующий АКТИВНЫЙ мастер. Раньше держалось только на FK
 * (можно было подсунуть id любого юзера, а мусорная строка роняла insert ошибкой БД).
 */
export async function isActiveMaster(userId: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(userId).success) return false;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, 'master'), eq(users.isActive, true)))
    .limit(1);
  return !!row;
}

/**
 * Нормализует напарников из формы: дедуп, без основного мастера, только существующие
 * АКТИВНЫЕ мастера. Пустой список — наряд на одного.
 */
export async function resolvePartnerIds(
  primaryMasterId: string,
  partnerIds: string[] | undefined | null,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const parsed = partnerIdsSchema.safeParse(partnerIds ?? []);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const ids = Array.from(new Set(parsed.data)).filter((id) => id !== primaryMasterId);
  if (ids.length === 0) return { ok: true, ids: [] };
  if (ids.length > MAX_PARTNERS) {
    return { ok: false, error: `Слишком много напарников (максимум ${MAX_PARTNERS})` };
  }
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.role, 'master'), eq(users.isActive, true)));
  if (found.length !== ids.length) {
    return { ok: false, error: 'Напарник не найден или не активный мастер' };
  }
  return { ok: true, ids };
}
