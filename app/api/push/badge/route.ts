/**
 * GET /api/push/badge
 *
 * Цифра на иконке приложения для текущего юзера: { count }. Тот же подсчёт, что кладётся
 * в каждый push (lib/push/badge.ts), — открытое приложение ставит её через setAppBadge
 * (components/crm/AppBadgeSync.tsx), чтобы число на иконке совпадало с CRM.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBadgeCount } from '@/lib/push/badge';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const count = await getBadgeCount(session.user.id);
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
}
