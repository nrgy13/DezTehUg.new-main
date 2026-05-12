import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema/documents';
import { getStorage } from '@/lib/storage';

/**
 * Реально удалить документ из storage + БД. Используется только из admin
 * actions (approveDocumentDeletion). НЕ доступно manager напрямую.
 *
 * Идемпотентно: если файла в storage нет — не падает.
 */
export async function executeDocumentDeletion(documentId: string): Promise<{
  ok: true;
  doc: { dealId: string | null; clientId: string | null; number: string | null };
} | { ok: false; error: string }> {
  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      type: documents.type,
      dealId: documents.dealId,
      clientId: documents.clientId,
      docxS3Key: documents.docxS3Key,
      pdfS3Key: documents.pdfS3Key,
      signedScanS3Key: documents.signedScanS3Key,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: 'Документ не найден' };
  const doc = rows[0];

  const storage = await getStorage();
  for (const key of [doc.docxS3Key, doc.pdfS3Key, doc.signedScanS3Key]) {
    if (!key) continue;
    try {
      await storage.delete(key);
    } catch (err) {
      console.warn(`[executeDocumentDeletion] storage.delete(${key}) failed:`, err);
    }
  }

  await db.delete(documents).where(eq(documents.id, documentId));

  return {
    ok: true,
    doc: { dealId: doc.dealId, clientId: doc.clientId, number: doc.number },
  };
}

/**
 * Количество документов с pending запросом на удаление.
 * Используется в Sidebar admin (бейдж) и в /admin/deletions.
 */
export async function getPendingDeletionsCount(): Promise<number> {
  const result = await db.execute<{ cnt: number }>(sql`
    SELECT COUNT(*)::int AS cnt
    FROM documents
    WHERE deletion_status = 'pending'
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<{
    cnt: number;
  }>;
  return rows[0]?.cnt ?? 0;
}
