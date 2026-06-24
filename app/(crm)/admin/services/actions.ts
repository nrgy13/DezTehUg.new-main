'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { services } from '@/lib/db/schema/services';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { serviceFormSchema } from './schemas';

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Sprint 9: Регина (manager) получила права администратора на каталог услуг.
  if (session.user.role !== 'admin' && session.user.role !== 'manager') return null;
  return session.user;
}

async function logActivity(
  userId: string,
  action: string,
  entityId: string,
  changes?: unknown,
) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'service',
    entityId,
    changesJson: (changes as object) ?? null,
    ip,
    userAgent,
  });
}

function emptyToNull<T extends string | undefined>(v: T): string | null {
  if (v === undefined || v === null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const normLabel = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
/**
 * Эффективный ярлык услуги — то, что реально видно в выпадашках (`shortName ?? name`).
 * По нему ловим дубли-тёзки: раньше форма проверяла только уникальность `code`, поэтому
 * в каталоге расплодились «Дезинсекция» ×4 / «Дезинфекция» ×3 (один ярлык, разный код) —
 * в списках выбора услуги это каша, непонятно что выбирать.
 */
const effectiveLabel = (name: string, shortName: string | null) =>
  normLabel(shortName) || normLabel(name);

export async function createService(input: unknown): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.code, data.code))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: `Услуга с кодом "${data.code}" уже существует`, field: 'code' };
  }

  // Превентив дублей-тёзок: не даём создать услугу с тем же ВИДИМЫМ названием.
  const shortName = emptyToNull(data.shortName);
  const newLabel = effectiveLabel(data.name, shortName);
  const catalog = await db
    .select({ id: services.id, name: services.name, shortName: services.shortName })
    .from(services);
  if (catalog.some((s) => effectiveLabel(s.name, s.shortName) === newLabel)) {
    return {
      ok: false,
      error: `В каталоге уже есть услуга «${shortName ?? data.name}». Выбери другое название или отредактируй существующую.`,
      field: shortName ? 'shortName' : 'name',
    };
  }

  const [created] = await db
    .insert(services)
    .values({
      code: data.code,
      name: data.name,
      shortName: emptyToNull(data.shortName),
      description: emptyToNull(data.description),
      defaultMethod: emptyToNull(data.defaultMethod),
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    })
    .returning({ id: services.id });

  await logActivity(actor.id, 'service.create', created.id, data);
  revalidatePath('/admin/services');

  return { ok: true, data: { id: created.id } };
}

export async function updateService(
  id: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first.message, field: first.path.join('.') };
  }
  const data = parsed.data;

  const existing = await db
    .select({
      id: services.id,
      code: services.code,
      name: services.name,
      shortName: services.shortName,
    })
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, error: 'Услуга не найдена' };
  }

  // Если меняется код — проверяем уникальность
  if (existing[0].code !== data.code) {
    const dup = await db
      .select({ id: services.id })
      .from(services)
      .where(eq(services.code, data.code))
      .limit(1);
    if (dup.length > 0) {
      return { ok: false, error: `Код "${data.code}" уже занят другой услугой`, field: 'code' };
    }
  }

  // Превентив дублей-тёзок при смене названия: блокируем только если ВИДИМЫЙ ярлык
  // реально меняется на чужой. Если ярлык не менялся — пропускаем (не ломаем сохранение
  // уже существующих дублей до их merge на проде).
  const newShort = emptyToNull(data.shortName);
  const oldLabel = effectiveLabel(existing[0].name, existing[0].shortName);
  const newLabel = effectiveLabel(data.name, newShort);
  if (oldLabel !== newLabel) {
    const catalog = await db
      .select({ id: services.id, name: services.name, shortName: services.shortName })
      .from(services);
    if (catalog.some((s) => s.id !== id && effectiveLabel(s.name, s.shortName) === newLabel)) {
      return {
        ok: false,
        error: `Уже есть услуга «${newShort ?? data.name}». Выбери другое название.`,
        field: newShort ? 'shortName' : 'name',
      };
    }
  }

  await db
    .update(services)
    .set({
      code: data.code,
      name: data.name,
      shortName: emptyToNull(data.shortName),
      description: emptyToNull(data.description),
      defaultMethod: emptyToNull(data.defaultMethod),
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(services.id, id));

  await logActivity(actor.id, 'service.update', id, data);
  revalidatePath('/admin/services');

  return { ok: true, data: { id } };
}

export async function toggleServiceActive(
  id: string,
  active: boolean,
): Promise<Result<{ active: boolean }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  if (existing.length === 0) return { ok: false, error: 'Услуга не найдена' };

  await db
    .update(services)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(services.id, id));

  await logActivity(actor.id, 'service.toggle_active', id, { active });
  revalidatePath('/admin/services');

  return { ok: true, data: { active } };
}
