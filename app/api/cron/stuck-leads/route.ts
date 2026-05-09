import { NextResponse } from 'next/server';
import { runStuckLeadsCheck } from '@/lib/notifications/stuck-leads';
import { activityLog } from '@/lib/db/schema/activity';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron-endpoint: проверить «зависшие» лиды и разослать дайджесты менеджерам.
 *
 * Аутентификация: заголовок X-Cron-Secret == process.env.CRON_SECRET.
 *
 * Триггеры:
 * - Локально: `curl -X POST -H "X-Cron-Secret: $CRON_SECRET" http://localhost:3000/api/cron/stuck-leads`
 * - На prod: Linux cron на VPS — `0 9 * * *`
 *
 * Параметры (query):
 * - `?dryRun=1` — не отправляет, только считает (для отладки)
 *
 * Ответ:
 * - 200 + { ok: true, totalStuck, emailsSent, recipients, errors }
 * - 401 если Secret не сошёлся
 * - 500 если в env нет CRON_SECRET
 */
export async function POST(request: Request) {
  // ─── 1. Аутентификация ────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/stuck-leads] CRON_SECRET не задан в env');
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 });
  }
  const provided = request.headers.get('x-cron-secret');
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ─── 2. Параметры ────────────────────────────────────────────
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  // ─── 3. Запуск ────────────────────────────────────────────────
  try {
    const result = await runStuckLeadsCheck({ dryRun });

    await db.insert(activityLog).values({
      userId: null,
      action: dryRun ? 'cron.stuck_leads.dry_run' : 'cron.stuck_leads.run',
      entityType: 'system',
      entityId: null,
      changesJson: {
        totalStuck: result.totalStuck,
        emailsSent: result.emailsSent,
        recipientsCount: result.recipients.length,
        errors: result.errors.length,
      },
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    });

    return NextResponse.json({ ok: true, dryRun, ...result }, { status: 200 });
  } catch (err) {
    console.error('[cron/stuck-leads] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

// GET — просто статус, без побочек, для healthcheck. Не требует секрета.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/cron/stuck-leads',
    method: 'POST',
    auth: 'X-Cron-Secret header required',
    queryParams: { dryRun: '1 to skip sending' },
  });
}
