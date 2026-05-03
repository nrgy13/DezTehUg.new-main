import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema/leads';
import { activityLog } from '@/lib/db/schema/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint для приёма заявок от n8n / лендинга.
 *
 * Аутентификация: заголовок X-N8N-Secret должен совпадать с env N8N_INBOUND_SECRET.
 *
 * Принимает JSON произвольной формы. Извлекаем стандартные поля по нескольким
 * вариантам ключей (customer_phone / phone / contact_phone и т.д.) — чтоб
 * терпимо относиться к разным схемам payload. Полный payload сохраняется
 * в leads.rawPayload (jsonb) для отладки и обогащения позже.
 *
 * Минимальное требование: должен быть хотя бы phone.
 */

// Помощник: достать строковое значение из объекта по списку возможных ключей
function pickStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) return t;
    }
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && !isNaN(v)) return Math.trunc(v);
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v.trim());
      if (!isNaN(n)) return Math.trunc(n);
    }
  }
  return undefined;
}

function pickArr(obj: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) {
      return v.map((x) => String(x)).filter((x) => x.length > 0);
    }
    if (typeof v === 'string' && v.trim()) {
      // запятая-разделённое
      return v
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return undefined;
}

const sourceSchema = z.enum(['website', 'phone', 'manager', 'recurring', 'referral', 'other']);

export async function POST(request: Request) {
  // ─── 1. Аутентификация ────────────────────────────────────────
  const secret = process.env.N8N_INBOUND_SECRET;
  if (!secret) {
    console.error('[leads/inbound] N8N_INBOUND_SECRET не задан в env');
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 });
  }
  const provided = request.headers.get('x-n8n-secret');
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ─── 2. Парсинг body ─────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ ok: false, error: 'Body must be a JSON object' }, { status: 400 });
  }

  // n8n часто оборачивает в { message: { content: {...} } } или { content: {...} }
  const root = raw as Record<string, unknown>;
  const inner =
    (root.message as Record<string, unknown>)?.content ??
    (root.content as Record<string, unknown>) ??
    root;
  const data = inner as Record<string, unknown>;

  // ─── 3. Извлечение полей ──────────────────────────────────────
  const phone = pickStr(data, ['phone', 'customer_phone', 'contact_phone', 'tel']);
  const name = pickStr(data, ['name', 'customer_name', 'contact_name', 'fullName']);
  const email = pickStr(data, ['email', 'customer_email', 'contact_email']);
  const address = pickStr(data, ['address', 'object_address', 'requested_address', 'location']);
  const message = pickStr(data, ['message', 'comment', 'note', 'description', 'text']);
  const services = pickArr(data, ['services', 'service_types', 'classified_service', 'service']);
  const area = pickNum(data, ['area', 'area_m2', 'area_m2_estimate', 'sqm']);
  const channel = pickStr(data, ['channel', 'form_type']) ?? 'site_form';

  const sourceRaw = pickStr(data, ['source']);
  const source = sourceRaw && sourceSchema.safeParse(sourceRaw).success
    ? (sourceRaw as z.infer<typeof sourceSchema>)
    : 'website';

  // ─── 4. Минимальная валидация ────────────────────────────────
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: 'Phone is required (any of: phone, customer_phone, contact_phone, tel)' },
      { status: 422 }
    );
  }

  if (!name && !email && !message && !services) {
    return NextResponse.json(
      { ok: false, error: 'At least one of name/email/message/services is required besides phone' },
      { status: 422 }
    );
  }

  // ─── 5. Создание lead ─────────────────────────────────────────
  try {
    const [created] = await db
      .insert(leads)
      .values({
        contactName: name?.slice(0, 255),
        contactPhone: phone.slice(0, 32),
        contactEmail: email?.slice(0, 255),
        serviceTypes: services ?? null,
        requestedAddress: address ?? null,
        areaM2Estimate: area ?? null,
        message: message ?? null,
        source,
        channel: channel.slice(0, 64),
        rawPayload: root,
        status: 'new',
      })
      .returning({ id: leads.id });

    // Запись в activity_log (без userId — это система)
    await db.insert(activityLog).values({
      userId: null,
      action: 'lead.create_from_n8n',
      entityType: 'lead',
      entityId: created.id,
      changesJson: { phone, name, channel },
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    });

    return NextResponse.json({ ok: true, leadId: created.id }, { status: 201 });
  } catch (err) {
    console.error('[leads/inbound] DB error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to create lead' }, { status: 500 });
  }
}
