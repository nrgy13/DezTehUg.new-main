import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documentTemplates, type DocumentType, type DocumentTemplate } from '@/lib/db/schema/documents';
import { getStorage } from '@/lib/storage';

/**
 * Получить активный шаблон для типа документа.
 *
 * Сначала ищет в БД (`document_templates` WHERE type=? AND is_active=true) —
 * последняя версия побеждает. Если запись с префиксом `seed:` — читает файл
 * из репозитория /templates. Иначе из storage.
 *
 * Если в БД нет ни одной активной записи → fallback на дефолтный файл по
 * соглашению об именах. Это значит, что сразу после миграции (без seed) всё
 * равно работает.
 */
export async function getActiveTemplate(type: DocumentType): Promise<{
  templateId: string | null;
  version: number;
  buffer: Buffer;
  source: 'storage' | 'seed' | 'fallback';
}> {
  const rows = await db
    .select()
    .from(documentTemplates)
    .where(and(eq(documentTemplates.type, type), eq(documentTemplates.isActive, true)))
    .orderBy(desc(documentTemplates.version))
    .limit(1);

  const tpl = rows[0] as DocumentTemplate | undefined;

  if (tpl) {
    if (tpl.s3Key.startsWith('seed:')) {
      const filename = tpl.s3Key.slice('seed:'.length);
      const buffer = await readSeedFile(filename);
      return { templateId: tpl.id, version: tpl.version, buffer, source: 'seed' };
    }
    const storage = await getStorage();
    const buffer = await storage.get(tpl.s3Key);
    return { templateId: tpl.id, version: tpl.version, buffer, source: 'storage' };
  }

  // Fallback: пытаемся прочитать дефолт из репо по типу
  const fallbackFile = DEFAULT_FILENAME[type];
  if (!fallbackFile) {
    throw new Error(`No active template for type "${type}" and no fallback registered`);
  }
  const buffer = await readSeedFile(fallbackFile);
  return { templateId: null, version: 0, buffer, source: 'fallback' };
}

const DEFAULT_FILENAME: Record<DocumentType, string> = {
  contract: 'contract-services.docx',
  addendum: 'agreement-addendum.docx',
  act_work: 'work-completion-report.docx',
  act_inspection: 'inspection-report.docx',
  invoice: 'invoice.docx',
  commercial_offer: 'commercial-offer.docx',
  upd: 'upd.docx',
  other: 'contract-services.docx', // не должно использоваться, но не падаем
};

async function readSeedFile(filename: string): Promise<Buffer> {
  const safeName = path.basename(filename); // защита от ../
  const filepath = path.resolve('templates', safeName);
  return fs.readFile(filepath);
}
