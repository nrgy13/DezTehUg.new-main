'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema/documents';
import { clients } from '@/lib/db/schema/clients';
import { activityLog, notificationLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { getMailer } from '@/lib/mailer';
import { bodyForDocumentType } from '@/lib/mailer/templates';
import { getAccountantEmail } from '@/lib/notifications/accountant';

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const sendSchema = z.object({
  to: z.string().email('Невалидный email'),
  subject: z.string().min(1).max(255).optional(),
  format: z.enum(['docx', 'pdf']).default('docx'),
});

export async function sendDocumentToClient(
  documentId: string,
  input: unknown,
): Promise<Result<{ messageId: string; transport: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Нет доступа' };
  if (session.user.role !== 'manager' && session.user.role !== 'admin') {
    return { ok: false, error: 'Нет доступа' };
  }

  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { to, subject, format } = parsed.data;

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (docRows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = docRows[0];

  const storageKey = format === 'pdf' ? doc.pdfS3Key : doc.docxS3Key;
  if (!storageKey) {
    return { ok: false, error: `Файл ${format.toUpperCase()} не сохранён для этого документа` };
  }

  // Имя клиента для красивого имени файла
  let clientName = 'client';
  if (doc.clientId) {
    const c = await db
      .select({ shortName: clients.shortName })
      .from(clients)
      .where(eq(clients.id, doc.clientId))
      .limit(1);
    if (c[0]?.shortName) clientName = c[0].shortName;
  }

  let buffer: Buffer;
  try {
    const storage = await getStorage();
    buffer = await storage.get(storageKey);
  } catch (err) {
    return { ok: false, error: `Не удалось прочитать файл: ${err instanceof Error ? err.message : 'IO'}` };
  }

  const filename = `${doc.number ?? doc.id} ${clientName}.${format}`.replace(
    /[\\/:*?"<>|]+/g,
    '-',
  );

  const finalSubject =
    subject?.trim() || `Документ ${doc.number ?? ''} от ДезТехЮг`;

  let result: { messageId: string; transport: string };
  try {
    const mailer = await getMailer();
    const body = bodyForDocumentType(doc.type, {
      clientName,
      documentNumber: doc.number ?? undefined,
    });
    result = await mailer.send({
      to,
      subject: finalSubject,
      text: body.text,
      html: body.html,
      attachments: [
        {
          filename,
          content: buffer,
          contentType:
            format === 'pdf'
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: `Mailer error: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  // Обновляем документ
  await db
    .update(documents)
    .set({
      status: 'sent',
      sentAt: new Date(),
      sentToEmail: to,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;

  // notification_log (status enum: queued|sent|failed; для noop ставим sent — мы залогировали как «отправили»)
  await db.insert(notificationLog).values({
    channel: 'email',
    subject: finalSubject,
    body: `Прикреплён файл ${filename}`,
    payloadJson: {
      recipient: to,
      transport: result.transport,
      messageId: result.messageId,
    },
    relatedEntityType: 'document',
    relatedEntityId: documentId,
    sentAt: new Date(),
    status: 'sent',
  });

  // activity_log
  await db.insert(activityLog).values({
    userId: session.user.id,
    action: 'document.send',
    entityType: 'document',
    entityId: documentId,
    changesJson: { to, transport: result.transport, format },
    ip,
    userAgent,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  if (doc.clientId) revalidatePath(`/manager/clients/${doc.clientId}`);

  return { ok: true, data: result };
}

/**
 * Sprint 8: отправить документ (счёт/УПД) на email бухгалтера ДезТехЮг.
 * Email берётся из app_settings.accountant_email (настраивается в /admin/settings).
 * Доступно manager и admin.
 */
export async function sendDocumentToAccountant(
  documentId: string,
): Promise<Result<{ messageId: string; transport: string; email: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Нет доступа' };
  if (session.user.role !== 'manager' && session.user.role !== 'admin') {
    return { ok: false, error: 'Нет доступа' };
  }

  const accountantEmail = await getAccountantEmail();
  if (!accountantEmail) {
    return {
      ok: false,
      error: 'Email бухгалтера не настроен. Зайди в /admin/settings и впиши его.',
    };
  }

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (docRows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = docRows[0];

  if (doc.type !== 'invoice' && doc.type !== 'upd') {
    return { ok: false, error: 'Бухгалтеру можно отправлять только счёт и УПД' };
  }

  // Предпочитаем PDF, fallback DOCX
  const storageKey = doc.pdfS3Key ?? doc.docxS3Key;
  const format = doc.pdfS3Key ? 'pdf' : 'docx';
  if (!storageKey) {
    return { ok: false, error: 'Файл документа не сохранён' };
  }

  let clientName = 'client';
  if (doc.clientId) {
    const c = await db
      .select({ shortName: clients.shortName })
      .from(clients)
      .where(eq(clients.id, doc.clientId))
      .limit(1);
    if (c[0]?.shortName) clientName = c[0].shortName;
  }

  let buffer: Buffer;
  try {
    const storage = await getStorage();
    buffer = await storage.get(storageKey);
  } catch (err) {
    return { ok: false, error: `Не удалось прочитать файл: ${err instanceof Error ? err.message : 'IO'}` };
  }

  const typeLabel = doc.type === 'upd' ? 'УПД' : 'Счёт';
  const filename = `${typeLabel} ${doc.number ?? doc.id} ${clientName}.${format}`.replace(
    /[\\/:*?"<>|]+/g,
    '-',
  );
  const subject = `${typeLabel} ${doc.number ?? ''} · ${clientName}`.trim();

  let result: { messageId: string; transport: string };
  try {
    const mailer = await getMailer();
    result = await mailer.send({
      to: accountantEmail,
      subject,
      text: `Документ от ДезТехЮг для бухгалтерии.\n\nТип: ${typeLabel}\nНомер: ${doc.number ?? '—'}\nКлиент: ${clientName}\n\nФайл во вложении.`,
      html: `<p>Документ от ДезТехЮг для бухгалтерии.</p><ul><li>Тип: <b>${typeLabel}</b></li><li>Номер: <b>${doc.number ?? '—'}</b></li><li>Клиент: <b>${clientName}</b></li></ul><p>Файл во вложении.</p>`,
      attachments: [
        {
          filename,
          content: buffer,
          contentType:
            format === 'pdf'
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    });
  } catch (err) {
    return { ok: false, error: `Mailer error: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const userAgent = headersList.get('user-agent') ?? null;

  await db.insert(notificationLog).values({
    channel: 'email',
    subject,
    body: `${typeLabel} → бухгалтер ${accountantEmail}`,
    payloadJson: {
      recipient: accountantEmail,
      transport: result.transport,
      messageId: result.messageId,
      reason: 'accountant',
    },
    relatedEntityType: 'document',
    relatedEntityId: documentId,
    sentAt: new Date(),
    status: 'sent',
  });

  await db.insert(activityLog).values({
    userId: session.user.id,
    action: 'document.send_to_accountant',
    entityType: 'document',
    entityId: documentId,
    changesJson: { to: accountantEmail, transport: result.transport, type: doc.type },
    ip,
    userAgent,
  });

  if (doc.dealId) revalidatePath(`/manager/deals/${doc.dealId}`);
  return { ok: true, data: { ...result, email: accountantEmail } };
}
