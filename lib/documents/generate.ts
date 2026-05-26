import { db } from '@/lib/db';
import { documents, type DocumentType } from '@/lib/db/schema/documents';
import { renderDocx } from '@/lib/render-docx';
import { renderDocxToPdf } from '@/lib/render-pdf';
import { getStorage } from '@/lib/storage';
import { getActiveTemplate } from '@/lib/templates/get-template';
import { buildDocumentData } from '@/lib/templates/build-data';
import { nextDocumentNumber } from '@/lib/document-number';

export type GenerateDocumentInput = {
  type: DocumentType;
  dealId?: string;
  addendumId?: string;
  clientId?: string;
  format: 'docx' | 'pdf' | 'both';
  overrides?: Record<string, unknown>;
  actorId: string;
  /** Sprint 8: если задано — генерим только эти позиции прайса. Иначе все. */
  priceItemIds?: string[];
};

export type GenerateDocumentResult = {
  documentId: string;
  number: string;
  docxKey: string;
  pdfKey: string | null;
  docxBuffer: Buffer;
  pdfBuffer: Buffer | null;
};

/**
 * Сгенерировать документ: получить шаблон, отрендерить, сохранить в storage,
 * создать запись в БД. Возвращает буферы для дальнейшего использования
 * (например, чтобы сразу прикрепить к email без повторного чтения из storage).
 *
 * Используется и /api/documents/generate, и Server Actions (submitProposalForLead).
 * Не делает аутентификацию — caller отвечает за это.
 * Не пишет в activity_log — caller сам решает что и как логировать.
 */
export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  if (!input.dealId && !input.clientId) {
    throw new Error('Generate document requires dealId or clientId');
  }

  const now = new Date();
  const dateIso = now.toISOString().slice(0, 10);
  const documentNumber = await nextDocumentNumber(input.type, now);

  const { data, client, deal } = await buildDocumentData({
    type: input.type,
    dealId: input.dealId,
    addendumId: input.addendumId,
    clientId: input.clientId,
    documentNumber,
    documentDate: dateIso,
    overrides: input.overrides,
    priceItemIds: input.priceItemIds,
  });

  const tpl = await getActiveTemplate(input.type);
  const docxBuffer = renderDocx({ template: tpl.buffer, data });

  const storage = await getStorage();
  const year = now.getFullYear();
  const safeNumber = documentNumber.replace(/[/\\]/g, '-');
  const docxKey = `documents/${year}/${input.type}/${safeNumber}.docx`;
  await storage.put(docxKey, docxBuffer);

  let pdfKey: string | null = null;
  let pdfBuffer: Buffer | null = null;
  if (input.format === 'pdf' || input.format === 'both') {
    try {
      pdfBuffer = await renderDocxToPdf(docxBuffer);
      pdfKey = `documents/${year}/${input.type}/${safeNumber}.pdf`;
      await storage.put(pdfKey, pdfBuffer);
    } catch (err) {
      console.warn(
        '[generateDocument] PDF skipped:',
        err instanceof Error ? err.message : err,
      );
      pdfBuffer = null;
    }
  }

  const [created] = await db
    .insert(documents)
    .values({
      type: input.type,
      number: documentNumber,
      date: dateIso,
      title: `${typeLabel(input.type)} ${documentNumber}`,
      clientId: client?.id ?? null,
      dealId: deal?.id ?? null,
      leadId: null,
      templateId: tpl.templateId,
      variablesJson: data,
      docxS3Key: docxKey,
      pdfS3Key: pdfKey,
      status: 'generated',
      createdById: input.actorId,
    })
    .returning({ id: documents.id });

  return {
    documentId: created.id,
    number: documentNumber,
    docxKey,
    pdfKey,
    docxBuffer,
    pdfBuffer,
  };
}

function typeLabel(type: DocumentType): string {
  return (
    {
      contract: 'Договор',
      addendum: 'Доп. соглашение',
      act_work: 'Акт работ',
      act_inspection: 'Акт обследования',
      invoice: 'Счёт',
      commercial_offer: 'КП',
      upd: 'УПД',
      other: 'Документ',
    } as Record<DocumentType, string>
  )[type] ?? 'Документ';
}
