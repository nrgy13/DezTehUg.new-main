import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { documentTypeEnum } from '@/lib/db/schema/documents';
import { activityLog } from '@/lib/db/schema/activity';
import { generateDocument } from '@/lib/documents/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  type: z.enum(documentTypeEnum.enumValues),
  dealId: z.string().uuid().optional(),
  addendumId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  format: z.enum(['docx', 'pdf', 'both']).default('docx'),
  overrides: z.record(z.unknown()).optional(),
  priceItemIds: z.array(z.string().uuid()).optional(),
  objectId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.errors[0].message,
        field: parsed.error.errors[0].path.join('.'),
      },
      { status: 400 },
    );
  }
  const { type, dealId, addendumId, clientId, format, overrides, priceItemIds, objectId } =
    parsed.data;

  if (!dealId && !clientId) {
    return NextResponse.json(
      { ok: false, error: 'Укажи dealId или clientId' },
      { status: 400 },
    );
  }

  try {
    const result = await generateDocument({
      type,
      dealId,
      addendumId,
      clientId,
      format,
      overrides,
      actorId: session.user.id,
      priceItemIds,
      objectId,
    });

    await db.insert(activityLog).values({
      userId: session.user.id,
      action: 'document.generate',
      entityType: dealId ? 'deal' : 'client',
      entityId: dealId ?? clientId ?? '',
      changesJson: { documentId: result.documentId, type, number: result.number, format },
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    });

    return NextResponse.json({
      ok: true,
      data: {
        documentId: result.documentId,
        number: result.number,
        docxUrl: `/api/documents/${result.documentId}/download?format=docx`,
        pdfUrl: result.pdfKey ? `/api/documents/${result.documentId}/download?format=pdf` : null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[documents/generate] error:', err);
    return NextResponse.json(
      { ok: false, error: `Ошибка генерации: ${msg}` },
      { status: 500 },
    );
  }
}
