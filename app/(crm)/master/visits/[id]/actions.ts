'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealWorkLogs } from '@/lib/db/schema/deals';
import { dealChecklistItems, type ChecklistPhoto } from '@/lib/db/schema/checklists';
import {
  saveChecklistPhoto,
  deleteChecklistPhoto as deletePhotoFromStorage,
  PHOTO_MAX_PER_ITEM,
} from '@/lib/storage/checklist-photos';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getMaster() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== 'master' && session.user.role !== 'admin') return null;
  return session.user;
}

type EditableWorkLog = {
  id: string;
  dealId: string;
  masterId: string;
  status: 'planned' | 'in_progress' | 'completed';
  finalizedAt: Date | null;
};

type LoadResult =
  | { ok: true; wl: EditableWorkLog }
  | { ok: false; error: string };

/**
 * Проверка: actor имеет право редактировать work_log (он мастер этого выезда),
 * и выезд ещё не финализирован.
 */
async function loadEditableWorkLog(
  workLogId: string,
  actorId: string,
  actorRole: string,
): Promise<LoadResult> {
  const [wl] = await db
    .select({
      id: dealWorkLogs.id,
      dealId: dealWorkLogs.dealId,
      masterId: dealWorkLogs.masterId,
      status: dealWorkLogs.status,
      finalizedAt: dealWorkLogs.finalizedAt,
    })
    .from(dealWorkLogs)
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) return { ok: false, error: 'Выезд не найден' };
  if (actorRole !== 'admin' && wl.masterId !== actorId) {
    return { ok: false, error: 'Этот выезд назначен не на тебя' };
  }
  // Блокируем правки и по finalizedAt, и по status='completed' (legacy work_logs из
  // миграции 0012 имеют completed без finalizedAt — иначе их можно править/финализировать повторно).
  if (wl.finalizedAt || wl.status === 'completed') {
    return { ok: false, error: 'Выезд уже завершён, изменения недоступны' };
  }
  return { ok: true, wl };
}

// ============== startVisit ====================================================

export async function startVisit(workLogId: string): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const r = await loadEditableWorkLog(workLogId, actor.id, actor.role);
  if (!r.ok) return { ok: false, error: r.error };

  if (r.wl.status === 'planned') {
    await db
      .update(dealWorkLogs)
      .set({ status: 'in_progress', startedAt: new Date() })
      .where(eq(dealWorkLogs.id, workLogId));
  }

  revalidatePath(`/master/visits/${workLogId}`);
  revalidatePath('/master');
  return { ok: true, data: undefined };
}

// ============== setChecklistItemStatus =======================================

const setStatusSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(['pending', 'done', 'na']),
  note: z.string().max(2000).optional(),
});

export async function setChecklistItemStatus(input: unknown): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const [item] = await db
    .select({ id: dealChecklistItems.id, workLogId: dealChecklistItems.workLogId })
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.id, parsed.data.itemId))
    .limit(1);
  if (!item) return { ok: false, error: 'Пункт не найден' };

  const guard = await loadEditableWorkLog(item.workLogId, actor.id, actor.role);
  if (!guard.ok) return { ok: false, error: guard.error };

  // Авто-стартуем выезд при первой отметке.
  if (guard.wl.status === 'planned') {
    await db
      .update(dealWorkLogs)
      .set({ status: 'in_progress', startedAt: new Date() })
      .where(eq(dealWorkLogs.id, item.workLogId));
  }

  await db
    .update(dealChecklistItems)
    .set({
      status: parsed.data.status,
      note: parsed.data.note?.trim() || null,
      doneAt: parsed.data.status === 'done' ? new Date() : null,
      doneByUserId: parsed.data.status === 'done' ? actor.id : null,
      updatedAt: new Date(),
    })
    .where(eq(dealChecklistItems.id, parsed.data.itemId));

  revalidatePath(`/master/visits/${item.workLogId}`);
  return { ok: true, data: undefined };
}

// ============== addMasterChecklistItem ========================================

const addItemSchema = z.object({
  workLogId: z.string().uuid(),
  title: z.string().trim().min(2, 'Минимум 2 символа').max(200),
});

export async function addMasterChecklistItem(
  input: unknown,
): Promise<Result<{ id: string }>> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const guard = await loadEditableWorkLog(parsed.data.workLogId, actor.id, actor.role);
  if (!guard.ok) return { ok: false, error: guard.error };

  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${dealChecklistItems.position}), -1) + 1`,
    })
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.workLogId, parsed.data.workLogId));

  const [created] = await db
    .insert(dealChecklistItems)
    .values({
      workLogId: parsed.data.workLogId,
      source: 'master',
      position: Number(next ?? 0),
      title: parsed.data.title,
      required: false,
    })
    .returning({ id: dealChecklistItems.id });

  revalidatePath(`/master/visits/${parsed.data.workLogId}`);
  return { ok: true, data: { id: created.id } };
}

// ============== removeChecklistItem (master/master-source only) ===============

export async function removeOwnChecklistItem(itemId: string): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const [item] = await db
    .select({
      id: dealChecklistItems.id,
      workLogId: dealChecklistItems.workLogId,
      source: dealChecklistItems.source,
    })
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: 'Пункт не найден' };
  if (item.source !== 'master') {
    return { ok: false, error: 'Можно удалить только пункт, добавленный мастером' };
  }

  const guard = await loadEditableWorkLog(item.workLogId, actor.id, actor.role);
  if (!guard.ok) return { ok: false, error: guard.error };

  await db.delete(dealChecklistItems).where(eq(dealChecklistItems.id, itemId));
  revalidatePath(`/master/visits/${item.workLogId}`);
  return { ok: true, data: undefined };
}

// ============== uploadChecklistPhoto =========================================

export async function uploadChecklistPhoto(
  itemId: string,
  formData: FormData,
): Promise<Result<{ photo: ChecklistPhoto }>> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'Файл не передан' };
  }

  const [item] = await db
    .select({
      id: dealChecklistItems.id,
      workLogId: dealChecklistItems.workLogId,
      photos: dealChecklistItems.photos,
    })
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: 'Пункт не найден' };

  const guard = await loadEditableWorkLog(item.workLogId, actor.id, actor.role);
  if (!guard.ok) return { ok: false, error: guard.error };

  const currentPhotos = Array.isArray(item.photos) ? (item.photos as ChecklistPhoto[]) : [];
  if (currentPhotos.length >= PHOTO_MAX_PER_ITEM) {
    return {
      ok: false,
      error: `Не больше ${PHOTO_MAX_PER_ITEM} фото на пункт — удали старое`,
    };
  }

  let stored;
  try {
    stored = await saveChecklistPhoto({
      workLogId: item.workLogId,
      itemId,
      file,
      uploadedByUserId: actor.id,
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const nextPhotos = [...currentPhotos, stored];
  await db
    .update(dealChecklistItems)
    .set({ photos: nextPhotos, updatedAt: new Date() })
    .where(eq(dealChecklistItems.id, itemId));

  revalidatePath(`/master/visits/${item.workLogId}`);
  return { ok: true, data: { photo: stored } };
}

// ============== deletePhoto ==================================================

export async function deletePhoto(
  itemId: string,
  photoPath: string,
): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };

  const [item] = await db
    .select({
      id: dealChecklistItems.id,
      workLogId: dealChecklistItems.workLogId,
      photos: dealChecklistItems.photos,
    })
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.id, itemId))
    .limit(1);
  if (!item) return { ok: false, error: 'Пункт не найден' };

  const guard = await loadEditableWorkLog(item.workLogId, actor.id, actor.role);
  if (!guard.ok) return { ok: false, error: guard.error };

  const currentPhotos = Array.isArray(item.photos) ? (item.photos as ChecklistPhoto[]) : [];
  const target = currentPhotos.find((p) => p.path === photoPath);
  if (!target) return { ok: false, error: 'Фото не найдено' };

  // Удаляем из storage best-effort
  try {
    await deletePhotoFromStorage(photoPath);
  } catch (err) {
    console.warn('[deletePhoto] storage delete failed:', err);
  }

  const nextPhotos = currentPhotos.filter((p) => p.path !== photoPath);
  await db
    .update(dealChecklistItems)
    .set({ photos: nextPhotos, updatedAt: new Date() })
    .where(eq(dealChecklistItems.id, itemId));

  revalidatePath(`/master/visits/${item.workLogId}`);
  return { ok: true, data: undefined };
}

// ============== finalizeVisit ================================================

export async function finalizeVisit(workLogId: string): Promise<Result> {
  const actor = await getMaster();
  if (!actor) return { ok: false, error: 'Нет доступа' };
  const guard = await loadEditableWorkLog(workLogId, actor.id, actor.role);
  if (!guard.ok) return { ok: false, error: guard.error };

  // Проверка обязательных пунктов перед финализацией.
  const items = await db
    .select({
      id: dealChecklistItems.id,
      title: dealChecklistItems.title,
      required: dealChecklistItems.required,
      status: dealChecklistItems.status,
      note: dealChecklistItems.note,
    })
    .from(dealChecklistItems)
    .where(eq(dealChecklistItems.workLogId, workLogId));

  // 1) Обязательные не должны остаться нетронутыми (pending).
  const blocking = items.filter((i) => i.required && i.status === 'pending');
  if (blocking.length > 0) {
    return {
      ok: false,
      error: `Отметь обязательные пункты: ${blocking
        .map((b) => `«${b.title}»`)
        .join(', ')}`,
    };
  }

  // 2) Вариант A: «неприменимо» на обязательном пункте разрешено, но требует
  // заметку-обоснование — мастер вправе пометить na, но обязан объяснить почему.
  const naWithoutNote = items.filter(
    (i) => i.required && i.status === 'na' && !i.note?.trim(),
  );
  if (naWithoutNote.length > 0) {
    return {
      ok: false,
      error: `Обоснуй в заметке, почему неприменимо: ${naWithoutNote
        .map((b) => `«${b.title}»`)
        .join(', ')}`,
    };
  }

  // Атомарно: финализируем ТОЛЬКО если ещё не финализирован (защита от гонки/двойного тапа).
  // Если другой запрос успел раньше — returning пуст, выходим без повторного push.
  const finalized = await db
    .update(dealWorkLogs)
    .set({
      status: 'completed',
      finalizedAt: new Date(),
      performedAt: guard.wl.status === 'planned' ? new Date() : sql`COALESCE(performed_at, NOW())`,
    })
    .where(and(eq(dealWorkLogs.id, workLogId), isNull(dealWorkLogs.finalizedAt)))
    .returning({ id: dealWorkLogs.id });

  if (finalized.length === 0) {
    return { ok: false, error: 'Выезд уже завершён' };
  }

  // Push менеджеру: выезд завершён. Импорт лениво.
  try {
    const [wl] = await db
      .select({
        dealId: dealWorkLogs.dealId,
        managerId: sql<string | null>`(SELECT assigned_manager_id FROM deals WHERE id = ${dealWorkLogs.dealId})`,
        contractNumber: sql<string>`(SELECT contract_number FROM deals WHERE id = ${dealWorkLogs.dealId})`,
      })
      .from(dealWorkLogs)
      .where(eq(dealWorkLogs.id, workLogId))
      .limit(1);
    if (wl?.managerId) {
      const { sendPushToUser } = await import('@/lib/push/server');
      await sendPushToUser(wl.managerId, {
        title: 'Выезд завершён',
        body: `${actor.name} закрыл выезд по ${wl.contractNumber}`,
        url: `/manager/deals/${wl.dealId}?tab=visits`,
        tag: `visit-finalized-${workLogId}`,
      });
    }
  } catch (err) {
    console.warn('[finalizeVisit] push failed:', err);
  }

  revalidatePath(`/master/visits/${workLogId}`);
  revalidatePath('/master');
  return { ok: true, data: undefined };
}
