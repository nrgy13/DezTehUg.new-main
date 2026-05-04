import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { documentTemplates } from '@/lib/db/schema/documents';
import { getStorage } from '@/lib/storage';
import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Только для администратора' }, { status: 403 });
  }

  const { id } = await params;
  const rows = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id)).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 });
  }
  const tpl = rows[0];

  let buffer: Buffer;
  if (tpl.s3Key.startsWith('seed:')) {
    const filename = path.basename(tpl.s3Key.slice('seed:'.length));
    buffer = await fs.readFile(path.resolve('templates', filename));
  } else {
    const storage = await getStorage();
    buffer = await storage.get(tpl.s3Key);
  }

  const filename = `${tpl.type}-v${tpl.version}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
