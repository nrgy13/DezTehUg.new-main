// Мгновенное уведомление менеджеров о новой заявке (сайт → n8n → /api/leads/inbound).
//
// Каналы на каждого активного менеджера — ВСЕ сразу, а не «TG, иначе email»:
//   • Telegram — если чат привязан в Профиле CRM;
//   • письмо — через SMTP CRM (Yandex 360, пароль приложения, не протухает);
//   • web-push — если менеджер подписался в Профиле.
// Admin сюда не входит: владельцу заявка уже летит напрямую из /api/booking и из n8n.
//
// Зачем (04.10.2026): до этого менеджер узнавал о заявке только из Gmail-ноды n8n,
// а её OAuth протух ещё в сентябре — 5 заявок подряд пришли без единого уведомления.
//
// Функция НЕ бросает: каждый канал изолирован, сбои собираются в errors.

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { getMailer } from '@/lib/mailer';
import { newLeadAlertBody } from '@/lib/mailer/templates';
import { sendTelegramMessage } from '@/lib/notifications/telegram';

export type NewLeadForAlert = {
  id: string;
  contactName: string | null;
  contactPhone: string;
  contactEmail: string | null;
  services: string[] | null;
  address: string | null;
  message: string | null;
};

export type NewLeadNotifyResult = {
  recipients: number;
  telegram: number;
  email: number;
  push: number;
  errors: string[];
};

function buildTelegramText(lead: NewLeadForAlert): string {
  const lines = [
    '🔔 Новая заявка с сайта',
    '',
    lead.contactName ? `👤 ${lead.contactName}` : null,
    `📞 ${lead.contactPhone}`,
    lead.contactEmail ? `📧 ${lead.contactEmail}` : null,
    lead.services?.length ? `🛠 ${lead.services.join(', ')}` : null,
    lead.address ? `📍 ${lead.address}` : null,
    lead.message ? `💬 ${lead.message}` : null,
    '',
    `Открыть в CRM: https://crm.дезтехюг.рф/manager/leads/${lead.id}`,
  ];
  return lines.filter((l): l is string => l !== null).join('\n');
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function notifyManagersAboutNewLead(
  lead: NewLeadForAlert,
): Promise<NewLeadNotifyResult> {
  const result: NewLeadNotifyResult = { recipients: 0, telegram: 0, email: 0, push: 0, errors: [] };

  const managers = await db
    .select({
      id: users.id,
      email: users.email,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(and(eq(users.role, 'manager'), eq(users.isActive, true)));
  result.recipients = managers.length;

  const tgText = buildTelegramText(lead);
  const mail = newLeadAlertBody({
    contactName: lead.contactName,
    contactPhone: lead.contactPhone,
    contactEmail: lead.contactEmail,
    services: lead.services,
    address: lead.address,
    message: lead.message,
    leadId: lead.id,
  });
  const subject = `Новая заявка с сайта: ${[lead.contactName, lead.services?.join(', ')]
    .filter(Boolean)
    .join(', ') || lead.contactPhone}`;
  const pushBody = [lead.contactName, lead.services?.join(', '), lead.contactPhone]
    .filter(Boolean)
    .join(' · ');

  await Promise.all(
    managers.map(async (m) => {
      const jobs: Promise<void>[] = [];

      if (m.telegramChatId) {
        const chatId = m.telegramChatId;
        jobs.push(
          sendTelegramMessage(chatId, tgText, { disableWebPagePreview: true }).then((ok) => {
            if (ok) result.telegram++;
            else result.errors.push(`telegram ${m.email}: чат недоступен (бот заблокирован?)`);
          }),
        );
      }

      jobs.push(
        getMailer()
          .then((mailer) => mailer.send({ to: m.email, subject, text: mail.text, html: mail.html }))
          .then((r) => {
            // noop-транспорт ничего не отправляет — не считаем его доставкой
            if (r.transport === 'noop') result.errors.push(`email ${m.email}: MAILER_TRANSPORT=noop`);
            else result.email++;
          }),
      );

      jobs.push(
        import('@/lib/push/server')
          .then(({ sendPushToUser }) =>
            sendPushToUser(m.id, {
              title: 'Новая заявка с сайта',
              body: pushBody,
              url: `/manager/leads/${lead.id}`,
              tag: `lead-${lead.id}`,
            }),
          )
          .then((r) => {
            result.push += r.sent;
          }),
      );

      const settled = await Promise.allSettled(jobs);
      for (const s of settled) {
        if (s.status === 'rejected') result.errors.push(`${m.email}: ${errText(s.reason)}`);
      }
    }),
  );

  return result;
}
