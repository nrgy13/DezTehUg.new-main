import { NextRequest, NextResponse } from 'next/server';
import {
  BOOKING_FALLBACK_VIA,
  createSiteLead,
  findSiteLeadByPhoneSince,
  isMatchablePhone,
  logSkippedBookingFallback,
} from '@/lib/leads/site-lead';

// Заявка с формы сайта уходит ОДНОВРЕМЕННО: прямой Telegram владельцу и n8n
// (n8n → таблица заявок + уведомление + лид в CRM через /api/leads/inbound).
// Раньше шли по очереди: Telegram висел до 10с, и только потом заявка уходила в n8n
// (27.10.2026 клиент 11 секунд смотрел на крутилку).
// n8n не принял заявку или не довёз лид ⟹ страховка: лид пишется в CRM напрямую
// (иначе заявка пропала бы молча — повторов у формы нет).
const TELEGRAM_TIMEOUT_MS = 8_000;
// n8n отвечает сразу при получении (Webhook v2.1, режим ответа по умолчанию «Immediately»), обычно < 1с.
const N8N_TIMEOUT_MS = 10_000;
// Через сколько сверяться, что принятая n8n заявка дошла до CRM (обычно он довозит за 2–5с).
// Переопределение — только для локальных тестов; на проде переменной нет.
const LEAD_CHECK_DELAY_MS = Number(process.env.BOOKING_LEAD_CHECK_DELAY_MS) || 90_000;
// Лид этой заявки не может появиться раньше отправки формы; запас — на двойной клик.
const SAME_REQUEST_MARGIN_MS = 30_000;

interface BookingRequest {
  service: string;
  objectType: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  preferredTime?: string;
  message?: string;
}

async function sendToTelegram(data: BookingRequest): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram credentials not configured');
    return false;
  }

  try {
    const message = `
🆕 *Новая заявка с сайта*

*Услуга:* ${data.service}
*Тип объекта:* ${data.objectType}

*Контактные данные:*
👤 Имя: ${data.name}
📞 Телефон: ${data.phone}
${data.email ? `📧 Email: ${data.email}` : ''}
${data.address ? `📍 Адрес: ${data.address}` : ''}
${data.preferredTime ? `⏰ Удобное время: ${data.preferredTime}` : ''}

${data.message ? `💬 Сообщение:\n${data.message}` : ''}
    `.trim();

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending to Telegram:', error);
    return false;
  }
}

async function sendToWhatsApp(data: BookingRequest): Promise<boolean> {
  // Placeholder for WhatsApp Business API integration
  // This would require WhatsApp Business API setup
  console.log('WhatsApp integration not yet implemented', data);
  return false;
}

type N8nResult = { ok: true } | { ok: false; reason: string };

async function sendToN8n(data: BookingRequest): Promise<N8nResult> {
  // Переопределение адреса — только для локальных тестов страховки; на проде переменной нет.
  const webhookUrl = process.env.N8N_BOOKING_WEBHOOK_URL || 'https://n8n.lex1case.ru/webhook/DTU_zayavki';
  // Using the token from the screenshot (without Bearer prefix in variable, added in header)
  const token = 'R3sFtTCpEPywoYYy1ph4MYhQYv4oWXfg8tuFmrttOdewcH7vCkUlIbUoZ11lj1uQ';
  
  // Получаем Chat ID из переменных окружения
  const chatId = process.env.TELEGRAM_CHAT_ID;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Using 'Authorization' as per updated n8n configuration
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...data,
        chatId: chatId // Передаем chatId в n8n, чтобы использовать {{ $json.chatId }}
      }),
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`N8n webhook returned status ${response.status}. Body: ${errorText.slice(0, 500)}`);
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error('Error sending to N8n:', error);
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, reason: name === 'TimeoutError' ? `timeout ${N8N_TIMEOUT_MS}ms` : String(error).slice(0, 200) };
  }
}

type RequestMeta = { ip: string | null; userAgent: string | null };

/**
 * Страховка: пишем лид в CRM напрямую, менеджеру уходит уведомление.
 * Сначала смотрим, не довёз ли n8n эту заявку сам — иначе будет два лида.
 *   mode 'n8n-failed' — n8n не принял заявку (ошибка/таймаут/обрыв);
 *   mode 'lead-check' — n8n ответил «принял», но лида в CRM так и нет.
 * Не бросает.
 */
async function saveLeadDirectly(
  data: BookingRequest,
  n8nReason: string,
  startedAt: Date,
  meta: RequestMeta,
  mode: 'n8n-failed' | 'lead-check',
): Promise<boolean> {
  const what = mode === 'n8n-failed' ? `n8n не принял заявку (${n8nReason})` : n8nReason;
  try {
    const existing = await findSiteLeadByPhoneSince(
      data.phone,
      new Date(startedAt.getTime() - SAME_REQUEST_MARGIN_MS),
    );
    if (existing) {
      if (mode === 'n8n-failed') {
        console.info(`[booking] n8n не ответил (${n8nReason}), но лид от него уже в CRM: ${existing} — второй не пишем`);
        await logSkippedBookingFallback(existing, n8nReason);
      }
      return true;
    }
    // existing === undefined — проверка не удалась: пишем (лишний лид лучше потерянного).

    const created = await createSiteLead(
      {
        contactName: data.name.trim() || undefined,
        contactPhone: data.phone.trim(),
        contactEmail: data.email?.trim() || undefined,
        serviceTypes: data.service ? [data.service] : null,
        requestedAddress: data.address?.trim() || null,
        message: data.message?.trim() || null,
        source: 'website',
        channel: 'site_form',
        rawPayload: { ...data, via: BOOKING_FALLBACK_VIA, n8nError: n8nReason },
      },
      {
        action: 'lead.create_from_booking_fallback',
        ip: meta.ip,
        userAgent: meta.userAgent,
        // Клиент ждёт ответа формы — уведомления уходят в фоне, итог всё равно в activity_log.
        awaitNotify: false,
        logTag: 'booking-fallback',
      },
    );
    console.warn(`[booking] ${what} — лид записан в CRM напрямую: ${created.id}`);
    return true;
  } catch (error) {
    console.error(`[booking] ${what}, и запись в CRM напрямую не удалась:`, error);
    return false;
  }
}

/**
 * n8n ответил «принял», но лид в CRM он довозит ВТОРЫМ запросом (→ /api/leads/inbound) уже после
 * ответа форме. Если тот запрос не дойдёт, заявка пропала бы молча — поэтому через паузу сверяемся
 * и при отсутствии лида пишем его сами. Если n8n довезёт ещё позже, inbound увидит наш лид (дубль не создаст).
 * Таймер живёт в процессе: перезапуск контейнера в эти полторы минуты сверку теряет.
 */
function scheduleLeadCheck(data: BookingRequest, startedAt: Date, meta: RequestMeta): void {
  if (!isMatchablePhone(data.phone)) return; // по такому телефону не сверить — не рискуем дублем
  const timer = setTimeout(() => {
    void saveLeadDirectly(
      data,
      `n8n принял заявку, но лида в CRM нет через ${Math.round(LEAD_CHECK_DELAY_MS / 1000)}с`,
      startedAt,
      meta,
      'lead-check',
    );
  }, LEAD_CHECK_DELAY_MS);
  timer.unref?.();
}

export async function POST(request: NextRequest) {
  try {
    const data: BookingRequest = await request.json();

    // Validate required fields
    if (!data.service || !data.objectType || !data.name || !data.phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    // Страховка работает со строками (trim/телефон) — нестроковые поля сюда не пускаем.
    if ([data.service, data.objectType, data.name, data.phone].some((v) => typeof v !== 'string')) {
      return NextResponse.json(
        { error: 'Invalid field types' },
        { status: 400 }
      );
    }

    const startedAt = new Date();
    const meta: RequestMeta = {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
      userAgent: request.headers.get('user-agent') ?? null,
    };

    // Все каналы одновременно: медленный Telegram больше не задерживает n8n.
    const telegram = sendToTelegram(data);
    const whatsapp = sendToWhatsApp(data);
    const n8n = await sendToN8n(data);

    let leadSaved: boolean;
    if (n8n.ok) {
      leadSaved = true;
      scheduleLeadCheck(data, startedAt, meta);
    } else {
      leadSaved = await saveLeadDirectly(data, n8n.reason, startedAt, meta, 'n8n-failed');
    }

    // Лид сохранён — клиенту отвечаем сразу, Telegram владельцу доезжает в фоне
    // (обе функции не бросают). Ждём их, только если лид сохранить не удалось.
    if (leadSaved) {
      return NextResponse.json(
        { success: true, message: 'Booking request sent successfully' },
        { status: 200 }
      );
    }

    const [telegramSent, whatsappSent] = await Promise.all([telegram, whatsapp]);
    if (telegramSent || whatsappSent) {
      return NextResponse.json(
        { success: true, message: 'Booking request sent successfully' },
        { status: 200 }
      );
    }

    // Заявка не ушла никуда — честно говорим форме, она предложит клиенту позвонить.
    console.error('[booking] заявка не доставлена ни в один канал. Данные:', data);
    return NextResponse.json(
      { error: 'Booking delivery failed' },
      { status: 502 }
    );
  } catch (error) {
    console.error('Error processing booking request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

