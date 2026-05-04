import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema/documents';
import { clients } from '@/lib/db/schema/clients';
import { getStorage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Скачивание сгенерированного документа.
 * GET /api/documents/[id]/download?format=docx|pdf (default: docx)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') ?? 'docx') as 'docx' | 'pdf';

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      type: documents.type,
      docxS3Key: documents.docxS3Key,
      pdfS3Key: documents.pdfS3Key,
      clientId: documents.clientId,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 });
  }
  const doc = rows[0];

  const key = format === 'pdf' ? doc.pdfS3Key : doc.docxS3Key;
  if (!key) {
    return NextResponse.json(
      { error: `Файл ${format.toUpperCase()} для этого документа не сохранён` },
      { status: 404 },
    );
  }

  // Имя клиента — для красивого имени файла
  let clientShortName = 'client';
  if (doc.clientId) {
    const c = await db
      .select({ shortName: clients.shortName })
      .from(clients)
      .where(eq(clients.id, doc.clientId))
      .limit(1);
    if (c[0]?.shortName) clientShortName = c[0].shortName;
  }

  try {
    const storage = await getStorage();
    const buffer = await storage.get(key);

    const safeName = `${doc.number ?? doc.id} ${clientShortName}`
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim();
    const filename = `${safeName}.${format}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'IO error';
    console.error('[documents/download] error:', err);
    return NextResponse.json({ error: `Не удалось прочитать файл: ${msg}` }, { status: 500 });
  }
}
