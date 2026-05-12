/**
 * GET /api/storage/checklist/[...path]
 *
 * Раздаёт фото пунктов чеклиста. Доступ:
 * - admin — всем фото
 * - manager — фото сделок где он assigned_manager
 * - master — фото своих выездов
 *
 * Путь после /checklist/ имеет формат {workLogId}/{itemId}/{filename}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { dealWorkLogs, deals } from '@/lib/db/schema/deals';
import { getStorage } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  if (path.length < 1) {
    return NextResponse.json({ error: 'bad_path' }, { status: 400 });
  }
  const workLogId = path[0];

  // Авторизация по сделке
  const [wl] = await db
    .select({
      masterId: dealWorkLogs.masterId,
      managerId: deals.assignedManagerId,
    })
    .from(dealWorkLogs)
    .leftJoin(deals, eq(deals.id, dealWorkLogs.dealId))
    .where(eq(dealWorkLogs.id, workLogId))
    .limit(1);
  if (!wl) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const role = session.user.role;
  const uid = session.user.id;
  const allowed =
    role === 'admin' ||
    (role === 'master' && wl.masterId === uid) ||
    (role === 'manager' && wl.managerId === uid);
  if (!allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Читаем файл из storage
  const key = `checklist/${path.join('/')}`;
  try {
    const storage = await getStorage();
    if (!(await storage.exists(key))) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const buf = await storage.get(key);
    // Простой определитель MIME по расширению.
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'heic' || ext === 'heif'
              ? 'image/heic'
              : 'application/octet-stream';

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('[storage/checklist] read failed:', err);
    return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  }
}
