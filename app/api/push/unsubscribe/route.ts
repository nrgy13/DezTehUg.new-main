/**
 * POST /api/push/unsubscribe
 *
 * Удаляет push-подписку с переданным endpoint для текущего юзера.
 * Если endpoint не передан — удаляет все подписки юзера (например, при logout-from-all).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema/push';

const UnsubscribeBody = z.object({
  endpoint: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = UnsubscribeBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  if (parsed.data.endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );
  } else {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, session.user.id));
  }

  return NextResponse.json({ ok: true });
}
