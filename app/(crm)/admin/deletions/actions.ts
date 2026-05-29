'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema/documents';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { executeDocumentDeletion } from '@/lib/documents/deletion';

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  // Sprint 9: manager (Регина) одобряет/отклоняет запросы на удаление наравне с admin.
  if (
    !session?.user?.id ||
    (session.user.role !== 'admin' && session.user.role !== 'manager')
  )
    return null;
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
    entityType: 'document',
    entityId,
    changesJson: (changes as object) ?? null,
    ip,
    userAgent,
  });
}

/**
 * Одобрить запрос на удаление документа: реально удалить файлы из storage
 * и запись из БД. Доступно только admin.
 */
export async function approveDocumentDeletion(documentId: string): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: 'Только админ может одобрять удаления' };

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      type: documents.type,
      dealId: documents.dealId,
      clientId: documents.clientId,
      deletionStatus: documents.deletionStatus,
      deletionReason: documents.deletionReason,
      deletionRequestedById: documents.deletionRequestedById,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = rows[0];

  if (doc.deletionStatus !== 'pending') {
    return {
      ok: false,
      error: `Запрос не в статусе pending (сейчас: ${doc.deletionStatus})`,
    };
  }

  const result = await executeDocumentDeletion(documentId);
  if (!result.ok) return result;

  await logActivity(actor.id, 'document.deletion_approve', doc.dealId ?? doc.clientId ?? documentId, {
    documentId,
    number: doc.number,
    type: doc.type,
    requestedById: doc.deletionRequestedById,
    reason: doc.deletionReason,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  if (doc.clientId) revalidatePath(`/manager/clients/${doc.clientId}`);
  revalidatePath('/admin/deletions');
  revalidatePath('/admin');
  revalidatePath('/manager/documents');

  return { ok: true };
}

/**
 * Отклонить запрос на удаление. Документ остаётся в обращении.
 * Admin может оставить заметку manager'у (например "перенеси в архив вместо удаления").
 */
export async function rejectDocumentDeletion(
  documentId: string,
  adminNote: string,
): Promise<Result> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: 'Только админ может отклонять удаления' };

  const trimmedNote = adminNote.trim();
  if (trimmedNote.length === 0) {
    return { ok: false, error: 'Объясни manager\'у почему отклоняешь (минимум 1 символ)' };
  }
  if (trimmedNote.length > 1000) {
    return { ok: false, error: 'Заметка слишком длинная (максимум 1000 символов)' };
  }

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      dealId: documents.dealId,
      clientId: documents.clientId,
      deletionStatus: documents.deletionStatus,
      deletionRequestedById: documents.deletionRequestedById,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = rows[0];

  if (doc.deletionStatus !== 'pending') {
    return {
      ok: false,
      error: `Запрос не в статусе pending (сейчас: ${doc.deletionStatus})`,
    };
  }

  await db
    .update(documents)
    .set({
      deletionStatus: 'rejected',
      deletionResolvedAt: new Date(),
      deletionResolvedById: actor.id,
      deletionAdminNote: trimmedNote,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  await logActivity(actor.id, 'document.deletion_reject', doc.dealId ?? doc.clientId ?? documentId, {
    documentId,
    number: doc.number,
    requestedById: doc.deletionRequestedById,
    adminNote: trimmedNote,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  if (doc.clientId) revalidatePath(`/manager/clients/${doc.clientId}`);
  revalidatePath('/admin/deletions');
  revalidatePath('/admin');

  return { ok: true };
}
