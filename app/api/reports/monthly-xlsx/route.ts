/**
 * GET /api/reports/monthly-xlsx?month=YYYY-MM
 *
 * Excel-выгрузка ежемесячной управленческой сводки (11.2026): менеджер скачивает .xlsx и шлёт
 * директору/партнёрам. Данные — getMonthlyReport (тот же источник, что страница «Сводка месяца»),
 * книга — buildMonthlyWorkbook (lib/finance/excel.ts).
 *
 * Доступ: manager и admin. Неавторизован — 401 JSON, другая роль (мастер) — 403 JSON
 * (в выгрузке выручка, маржа и зарплаты всех мастеров).
 * Некорректный/пустой month — текущий месяц по МСК.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMonthlyReport, isValidMonth, currentMskMonth } from '@/lib/finance/monthly';
import { buildMonthlyWorkbook } from '@/lib/finance/excel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Недостаточно прав' }, { status: 403 });
  }

  const raw = new URL(request.url).searchParams.get('month');
  const month = isValidMonth(raw) ? raw : currentMskMonth();

  try {
    const report = await getMonthlyReport(month);
    const buf = await buildMonthlyWorkbook(report);
    const asciiName = `svodka-${month}.xlsx`;
    const ruName = encodeURIComponent(`Сводка ДезТехЮг ${month}.xlsx`);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${ruName}`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[monthly-xlsx] Ошибка сборки выгрузки', month, e);
    return NextResponse.json({ ok: false, error: 'Не удалось собрать выгрузку' }, { status: 500 });
  }
}
