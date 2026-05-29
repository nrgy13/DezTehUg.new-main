'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { db } from '@/lib/db';
import { documentTemplates, documentTypeEnum, type DocumentType } from '@/lib/db/schema/documents';
import { activityLog } from '@/lib/db/schema/activity';
import { auth } from '@/lib/auth';
import { getStorage } from '@/lib/storage';

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Sprint 9: Регина (manager) управляет шаблонами документов наравне с admin.
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
  await db.insert(activityLog).values({
    userId,
    action,
    entityType: 'document_template',
    entityId,
    changesJson: (changes as object) ?? null,
    ip: headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
    userAgent: headersList.get('user-agent') ?? null,
  });
}

/**
 * Минимальные тестовые данные для валидации шаблона. Если render не падает на
 * этом наборе — считаем что шаблон валиден (синтаксически).
 */
function makeTestData(): Record<string, unknown> {
  return {
    contract: { number: 'TEST-001', date: '01 января 2026 г.', place: 'г. Тест', endDate: '31 декабря 2026 г.' },
    addendum: { number: 1, date: '01 января 2026 г.', place: 'г. Тест' },
    act: { number: 'TEST-001', date: '01 января 2026 г.', qualityCheck: 'тест', areaCheck: 'тест', actualArea: 100, discrepancy: '', disinfector: 'тест', responsibleName: 'тест', responsibleRole: 'тест', responsiblePhone: 'тест' },
    report: { number: 'TEST', date: '01 января 2026 г.', objectStatus: 'тест', deviations: '', description: '', recommendation: '', infestationLevel: 'тест', hasJournal: 'нет', journalStatus: '' },
    invoice: { number: 'TEST', date: '01 января 2026 г.', dueDate: '02 января 2026 г.', basis: 'тест', totalNet: '0', vatAmount: '0', totalGross: '0', totalInWords: '' },
    offer: { number: 'TEST', date: '01 января 2026 г.', validUntil: '15 января 2026 г.', intro: '', totalNet: '0', totalGross: '0', totalInWords: '' },
    provider: { brand: 'TEST', shortName: 'ИП Тест', fullName: 'ИП Тест', signatoryFullName: 'Тест Т.Т.', signatoryShort: 'Т.Т.Тест', licenseNumber: '', licenseDate: '', licenseAuthority: '', ogrnip: '', inn: '', legalAddress: '', bankName: '', bankAccount: '', bankBik: '', bankCorrAccount: '', phone: '', email: '' },
    client: { shortName: 'ТестКлиент', fullName: 'ТестКлиент', directorName: 'Тест', directorRole: 'Тест', actingBasis: '', legalAddress: '', postalAddress: '', inn: '', kpp: '', ogrn: '', phone: '', email: '', bankName: '', bankAccount: '', bankBik: '', bankCorrAccount: '' },
    objects: [{ index: 1, name: 'Тест', address: 'Тест', area: 100, service: 'Тест' }],
    priceItems: [{ index: 1, serviceName: 'Тест', objectName: 'Тест', area: 100, method: 'Тест', frequency: 'Тест', priceNet: '0,00', priceGross: '0,00', vatRate: 5, quantity: 1, unit: 'шт.', amount: '0,00' }],
    workLogs: [{ index: 1, date: '01 января 2026 г.', description: 'Тест', area: 100, master: 'Тест', notes: '' }],
    totalNet: '0,00', totalGross: '0,00', vatAmount: '0,00',
  };
}

export async function uploadTemplate(formData: FormData): Promise<Result<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const type = formData.get('type');
  const name = formData.get('name');
  const file = formData.get('file');

  if (typeof type !== 'string' || !documentTypeEnum.enumValues.includes(type as DocumentType)) {
    return { ok: false, error: 'Неверный тип документа' };
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    return { ok: false, error: 'Введи название шаблона (минимум 2 символа)' };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: 'Файл не прикреплён' };
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return { ok: false, error: 'Только .docx файлы' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'Файл слишком большой (>10 МБ)' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Валидация: пытаемся прочитать через docxtemplater и отрендерить с тестовыми данными
  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      parser: (tag: string) => ({
        get(scope: unknown) {
          if (tag === '.') return scope;
          const parts = tag.split('.');
          let value: unknown = scope;
          for (const key of parts) {
            if (value == null) return '';
            value = (value as Record<string, unknown>)[key];
          }
          return value ?? '';
        },
      }),
    });
    doc.render(makeTestData());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Не удалось прочитать DOCX';
    return { ok: false, error: `Шаблон не прошёл валидацию: ${msg}` };
  }

  // Сохраняем в storage
  const docType = type as DocumentType;
  const storage = await getStorage();
  const id = randomUUID();
  const storageKey = `templates/${docType}/${id}.docx`;
  await storage.put(storageKey, buffer);

  // Деактивируем все предыдущие активные шаблоны для этого type
  await db
    .update(documentTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(documentTemplates.type, docType), eq(documentTemplates.isActive, true)));

  // Узнаём текущую max версию
  const lastVersion = await db
    .select({ version: documentTemplates.version })
    .from(documentTemplates)
    .where(eq(documentTemplates.type, docType))
    .orderBy(desc(documentTemplates.version))
    .limit(1);
  const nextVersion = (lastVersion[0]?.version ?? 0) + 1;

  const [created] = await db
    .insert(documentTemplates)
    .values({
      type: docType,
      name: name.trim(),
      description: null,
      s3Key: storageKey,
      isActive: true,
      version: nextVersion,
      uploadedById: actor.id,
    })
    .returning({ id: documentTemplates.id });

  await logActivity(actor.id, 'template.upload', created.id, {
    type: docType,
    version: nextVersion,
    name: name.trim(),
  });

  revalidatePath('/admin/templates');
  return { ok: true, data: { id: created.id } };
}

export async function setTemplateActive(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const rows = await db
    .select({ id: documentTemplates.id, type: documentTemplates.type })
    .from(documentTemplates)
    .where(eq(documentTemplates.id, id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Шаблон не найден' };

  const tplType = rows[0].type;

  await db
    .update(documentTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(documentTemplates.type, tplType));

  await db
    .update(documentTemplates)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(documentTemplates.id, id));

  await logActivity(actor.id, 'template.activate', id, { type: tplType });
  revalidatePath('/admin/templates');
  return { ok: true, data: undefined };
}

export async function deleteTemplate(id: string): Promise<Result> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Доступ только для администратора' };

  const rows = await db
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.id, id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Шаблон не найден' };
  const tpl = rows[0];

  if (tpl.isActive) {
    return { ok: false, error: 'Нельзя удалить активный шаблон. Сначала активируй другой.' };
  }
  if (tpl.s3Key.startsWith('seed:')) {
    return { ok: false, error: 'Базовые шаблоны нельзя удалить, только деактивировать' };
  }

  // Удаляем файл из storage (если был)
  try {
    const storage = await getStorage();
    await storage.delete(tpl.s3Key);
  } catch (err) {
    console.warn('[deleteTemplate] storage delete failed:', err);
  }

  await db.delete(documentTemplates).where(eq(documentTemplates.id, id));

  await logActivity(actor.id, 'template.delete', id, { type: tpl.type });
  revalidatePath('/admin/templates');
  return { ok: true, data: undefined };
}
