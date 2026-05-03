import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema/clients';
import { activityLog } from '@/lib/db/schema/activity';
import { CONTRACT_PROVIDER } from '@/lib/contract-provider';
import { renderDocx } from '@/lib/render-docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Генерация DOCX-документа по шаблону. POST { type, clientId, params }.
 *
 * Сейчас активна только одна генерация — `contract` (договор на оказание услуг).
 * Остальные типы (addendum, inspection, work, offer, invoice) добавим в Спринт 3,
 * когда будут реализованы модули сделок и актов: им нужны деньги/работы/объекты,
 * а это отдельные сущности БД, которых пока нет в UI.
 */

const ALLOWED_TYPES = ['contract'] as const;
type DocType = (typeof ALLOWED_TYPES)[number];

const inputSchema = z.object({
  type: z.enum(ALLOWED_TYPES),
  clientId: z.string().uuid(),
  // Поля для договора. Для других типов будут свои наборы.
  contract: z
    .object({
      number: z.string().trim().min(1).max(64),
      date: z.string().trim().min(1).max(64), // отображаемая строка, например «28 января 2026 г.»
      place: z.string().trim().min(1).max(128),
      endDate: z.string().trim().min(1).max(64),
    })
    .optional(),
});

const TEMPLATE_FILE: Record<DocType, string> = {
  contract: 'contract-services.docx',
};

const FILENAME_PREFIX: Record<DocType, string> = {
  contract: 'Договор',
};

function safeFileSegment(s: string): string {
  // Убираем символы, недопустимые в имени файла (Windows + Linux)
  return s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

export async function POST(request: Request) {
  // 1. Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Нет прав' }, { status: 403 });
  }

  // 2. Parse
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0].message, field: parsed.error.errors[0].path.join('.') },
      { status: 400 }
    );
  }
  const { type, clientId, contract } = parsed.data;

  if (type === 'contract' && !contract) {
    return NextResponse.json({ ok: false, error: 'contract: данные обязательны для типа contract' }, { status: 400 });
  }

  // 3. Load client from DB
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) {
    return NextResponse.json({ ok: false, error: 'Клиент не найден' }, { status: 404 });
  }

  // 4. Load template
  const templatePath = path.resolve('templates', TEMPLATE_FILE[type]);
  if (!fs.existsSync(templatePath)) {
    console.error(`[documents/generate] template not found: ${templatePath}`);
    return NextResponse.json({ ok: false, error: 'Шаблон не найден на сервере' }, { status: 500 });
  }
  const template = fs.readFileSync(templatePath);

  // 5. Build data for docxtemplater
  const data: Record<string, unknown> = {
    contract: contract ?? {},
    provider: CONTRACT_PROVIDER,
    client: {
      shortName: client.shortName ?? '',
      fullName: client.fullName ?? client.shortName ?? '',
      directorName: client.directorName ?? '',
      directorRole: client.directorRole ?? '',
      actingBasis: client.actingBasis ?? '',
      legalAddress: client.legalAddress ?? '',
      postalAddress: client.postalAddress ?? '',
      inn: client.inn ?? '',
      kpp: client.kpp ?? '',
      ogrn: client.ogrn ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      bankName: client.bankName ?? '',
      bankAccount: client.bankAccount ?? '',
      bankBik: client.bankBik ?? '',
      bankCorrAccount: client.bankCorrAccount ?? '',
    },
    // priceItems пока пустой массив — менеджер дозаполнит Приложение № 2 в Word.
    // В Спринте 3 будем подтягивать из deal_price_items.
    priceItems: [],
  };

  // 6. Render
  let buffer: Buffer;
  try {
    buffer = renderDocx({ template, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Render error';
    console.error('[documents/generate] render error:', err);
    return NextResponse.json({ ok: false, error: `Ошибка генерации: ${msg}` }, { status: 500 });
  }

  // 7. Activity log
  try {
    await db.insert(activityLog).values({
      userId: session.user.id,
      action: 'document.generate',
      entityType: 'client',
      entityId: clientId,
      changesJson: { type, contractNumber: contract?.number ?? null },
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    });
  } catch (err) {
    // log only, не валим запрос
    console.warn('[documents/generate] activity log failed:', err);
  }

  // 8. Return as download
  const fileName =
    type === 'contract'
      ? `${FILENAME_PREFIX[type]} ${safeFileSegment(client.shortName)} ${safeFileSegment(contract!.number)}.docx`
      : `${FILENAME_PREFIX[type]} ${safeFileSegment(client.shortName)}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
