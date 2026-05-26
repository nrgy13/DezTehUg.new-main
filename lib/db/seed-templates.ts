/**
 * Seed для documentTemplates.
 *
 * Заводит по одной записи на каждый из 6 типов документа, ссылающейся на
 * базовый файл из `/templates/`. Префикс `seed:` в s3Key — сигнал, что файл
 * лежит в репозитории, а не в storage. См. lib/templates/get-template.ts.
 *
 * Запуск: npm run db:seed:templates
 * Идемпотентно: если запись с таким (type, isActive=true) уже есть, пропускает.
 */

import { eq, and } from 'drizzle-orm';
import { db } from './index';
import { documentTemplates, type DocumentType } from './schema/documents';

type SeedTemplate = {
  type: DocumentType;
  name: string;
  filename: string;
  description: string;
};

const SEEDS: SeedTemplate[] = [
  {
    type: 'contract',
    name: 'Базовый: Договор на оказание услуг',
    filename: 'contract-services.docx',
    description: 'По образцу договора с ООО Аппетит. Юр. лица + ИП.',
  },
  {
    type: 'addendum',
    name: 'Базовый: Доп. соглашение',
    filename: 'agreement-addendum.docx',
    description: 'ДС к действующему договору. Изменение Приложения № 2.',
  },
  {
    type: 'act_work',
    name: 'Базовый: Акт о приёмке работ',
    filename: 'work-completion-report.docx',
    description: 'Акт сдачи-приёмки выполненных работ.',
  },
  {
    type: 'act_inspection',
    name: 'Базовый: Акт обследования',
    filename: 'inspection-report.docx',
    description: 'Первичное обследование объекта перед заключением договора.',
  },
  {
    type: 'invoice',
    name: 'Базовый: Счёт на оплату',
    filename: 'invoice.docx',
    description: 'Стандартная RU-форма счёта.',
  },
  {
    type: 'commercial_offer',
    name: 'Базовый: Коммерческое предложение',
    filename: 'commercial-offer.docx',
    description: 'КП с прайс-листом по объектам.',
  },
  {
    type: 'upd',
    name: 'Базовый: УПД',
    filename: 'upd.docx',
    description:
      'Универсальный передаточный документ. Базовая копия счёта — Регина перевыложит свой шаблон через /admin/templates.',
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const s3Key = `seed:${seed.filename}`;

    const existing = await db
      .select({ id: documentTemplates.id })
      .from(documentTemplates)
      .where(and(eq(documentTemplates.type, seed.type), eq(documentTemplates.s3Key, s3Key)))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(documentTemplates).values({
      type: seed.type,
      name: seed.name,
      description: seed.description,
      s3Key,
      isActive: true,
      version: 1,
      uploadedById: null,
    });
    created++;
  }

  console.log(`Templates seeded: ${created} created, ${skipped} skipped`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
