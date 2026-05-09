// Шаблоны body для писем клиентам.
// Каждый возвращает { text, html } для одновременной отправки plain и rich.
//
// Цели:
// - Анти-спам: пустой body часто бракуется Gmail/Yandex
// - UX: клиент видит человеческий текст, не голое вложение
// - Подпись с контактами компании (телефон, email)

import { CONTRACT_PROVIDER as P } from '@/lib/contract-provider';
import type { DocumentType } from '@/lib/db/schema/documents';

export type MailBody = { text: string; html: string };

type Ctx = {
  /** Имя клиента/получателя. Для юрлица — «ООО Аппетит», для физлица — «Иван Иванович». */
  clientName?: string;
  /** Номер документа: КП-2026-001, ДГ-2026-001 и т.д. */
  documentNumber?: string;
  /** Произвольный пост-скриптум менеджера, добавляется перед подписью. */
  customNote?: string;
};

const SIGNATURE_TEXT = `\n--\n${P.brand} · ${P.shortName}\nТел: ${P.phone}\nE-mail: ${P.email}`;

const SIGNATURE_HTML = `
<p style="margin-top:24px;color:#666;font-size:13px;line-height:1.5">
  --<br/>
  <strong>${P.brand}</strong> · ${P.shortName}<br/>
  Тел: <a href="tel:${P.phone.replace(/\D/g, '')}" style="color:#666">${P.phone}</a><br/>
  E-mail: <a href="mailto:${P.email}" style="color:#666">${P.email}</a>
</p>`;

function wrapHtml(body: string): string {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:600px">
${body}
${SIGNATURE_HTML}
</body></html>`;
}

function greeting(clientName?: string): string {
  if (!clientName) return 'Здравствуйте!';
  // Для юрлиц — обращение по компании, для физлиц по имени.
  // Простой эвристический выбор: если есть «ООО»/«ЗАО»/«ИП» — это компания.
  const isOrg = /\b(ООО|ЗАО|АО|ИП|НКО|ОАО|ПАО)\b/.test(clientName);
  return isOrg ? `Здравствуйте, уважаемые коллеги!` : `Здравствуйте, ${clientName}!`;
}

// =============================================================
// Commercial offer (КП)
// =============================================================
export function commercialOfferBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — наше коммерческое предложение${docInfo} на услуги санитарной обработки.

В предложении указана стоимость, способы и периодичность работ.
Если возникнут вопросы по составу работ или ценам — позвоните нам по телефону ${P.phone}.

Будем рады сотрудничеству.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — наше <strong>коммерческое предложение${docInfo}</strong> на услуги санитарной обработки.</p>
<p>В предложении указана стоимость, способы и периодичность работ.<br/>
Если возникнут вопросы по составу работ или ценам — позвоните нам по телефону <a href="tel:${P.phone.replace(/\D/g, '')}">${P.phone}</a>.</p>
<p>Будем рады сотрудничеству.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Договор
// =============================================================
export function contractBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — договор${docInfo} на оказание услуг санитарной обработки.

Просим:
1. Распечатать в двух экземплярах
2. Подписать со своей стороны и поставить печать (для юрлиц)
3. Направить один скан на этот email и оригиналы по почте

После получения подписанных оригиналов мы согласуем график работ.
По всем вопросам — ${P.phone}.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — <strong>договор${docInfo}</strong> на оказание услуг санитарной обработки.</p>
<p>Просим:</p>
<ol>
  <li>Распечатать в двух экземплярах</li>
  <li>Подписать со своей стороны и поставить печать (для юрлиц)</li>
  <li>Направить один скан на этот email и оригиналы по почте</li>
</ol>
<p>После получения подписанных оригиналов мы согласуем график работ.<br/>
По всем вопросам — <a href="tel:${P.phone.replace(/\D/g, '')}">${P.phone}</a>.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Доп. соглашение
// =============================================================
export function addendumBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — дополнительное соглашение${docInfo} к действующему договору.

В нём отражены изменения по составу объектов или тарифам.
Просим подписать и направить скан в ответ. По вопросам — ${P.phone}.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — <strong>дополнительное соглашение${docInfo}</strong> к действующему договору.</p>
<p>В нём отражены изменения по составу объектов или тарифам.<br/>
Просим подписать и направить скан в ответ. По вопросам — <a href="tel:${P.phone.replace(/\D/g, '')}">${P.phone}</a>.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Акт работ
// =============================================================
export function actWorkBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — акт о приёмке выполненных работ${docInfo}.

Работы выполнены в полном объёме, претензий по качеству нет (если иное —
свяжитесь с нами в течение 5 рабочих дней).

Просим подписать акт и направить скан в ответ.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — <strong>акт о приёмке выполненных работ${docInfo}</strong>.</p>
<p>Работы выполнены в полном объёме, претензий по качеству нет (если иное —
свяжитесь с нами в течение 5 рабочих дней).</p>
<p>Просим подписать акт и направить скан в ответ.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Акт обследования
// =============================================================
export function actInspectionBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — акт обследования объекта${docInfo}.

В акте отражено санитарно-эпидемиологическое состояние помещений
и рекомендации по обработке.

По любым вопросам — ${P.phone}.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — <strong>акт обследования объекта${docInfo}</strong>.</p>
<p>В акте отражено санитарно-эпидемиологическое состояние помещений
и рекомендации по обработке.</p>
<p>По любым вопросам — <a href="tel:${P.phone.replace(/\D/g, '')}">${P.phone}</a>.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Счёт на оплату
// =============================================================
export function invoiceBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — счёт${docInfo} на оплату услуг.

Реквизиты для оплаты указаны в счёте. После оплаты пришлите, пожалуйста,
платёжное поручение в ответ на это письмо — для ускорения сверки.

По вопросам оплаты — ${P.phone} или ${P.email}.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — <strong>счёт${docInfo}</strong> на оплату услуг.</p>
<p>Реквизиты для оплаты указаны в счёте. После оплаты пришлите, пожалуйста,
платёжное поручение в ответ на это письмо — для ускорения сверки.</p>
<p>По вопросам оплаты — <a href="tel:${P.phone.replace(/\D/g, '')}">${P.phone}</a> или
<a href="mailto:${P.email}">${P.email}</a>.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Generic — fallback для type='other' и неизвестных
// =============================================================
export function genericDocumentBody(ctx: Ctx): MailBody {
  const greet = greeting(ctx.clientName);
  const docInfo = ctx.documentNumber ? ` ${ctx.documentNumber}` : '';

  const text = `${greet}

Во вложении — документ${docInfo} от ${P.brand}.

По всем вопросам — ${P.phone} или ${P.email}.${ctx.customNote ? `\n\n${ctx.customNote}` : ''}${SIGNATURE_TEXT}`;

  const html = wrapHtml(`
<p>${greet}</p>
<p>Во вложении — <strong>документ${docInfo}</strong> от ${P.brand}.</p>
<p>По всем вопросам — <a href="tel:${P.phone.replace(/\D/g, '')}">${P.phone}</a> или
<a href="mailto:${P.email}">${P.email}</a>.</p>
${ctx.customNote ? `<p>${escapeHtml(ctx.customNote)}</p>` : ''}
`);

  return { text, html };
}

// =============================================================
// Дайджест зависших лидов (для менеджера)
// =============================================================
export type StuckLeadRow = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  statusLabel: string;
  days: number;
};

export function stuckLeadsDigestBody(args: {
  managerName: string;
  leads: StuckLeadRow[];
}): MailBody {
  const { managerName, leads } = args;
  const count = leads.length;
  const greet = `Здравствуйте, ${managerName}!`;
  const leadLine = (l: StuckLeadRow) => {
    const contact = [l.contactName, l.contactPhone, l.contactEmail]
      .filter(Boolean)
      .join(' · ');
    return `• [${l.statusLabel}, ${l.days}д] ${contact || '(без контактов)'}`;
  };

  const text = `${greet}

В воронке скопились лиды, которые слишком долго стоят без движения — всего ${count} шт.
Нужно с ними связаться или перевести в следующую стадию.

${leads.map(leadLine).join('\n')}

Открыть воронку: https://crm.дезтехюг.рф/manager/leads${SIGNATURE_TEXT}`;

  const rowsHtml = leads
    .map((l) => {
      const contact = [l.contactName, l.contactPhone, l.contactEmail]
        .filter((v): v is string => Boolean(v))
        .map(escapeHtml)
        .join(' · ');
      const colour = l.days >= 14 ? '#dc2626' : l.days >= 7 ? '#f59e0b' : '#0891b2';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px;color:${colour};white-space:nowrap">
          ${escapeHtml(l.statusLabel)} · ${l.days}д
        </td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee">${contact || '<em style="color:#999">без контактов</em>'}</td>
      </tr>`;
    })
    .join('');

  const html = wrapHtml(`
<p>${greet}</p>
<p>В воронке скопились лиды, которые слишком долго стоят без движения — <strong>${count} шт</strong>.<br/>
Нужно с ними связаться или перевести в следующую стадию.</p>
<table style="width:100%;border-collapse:collapse;margin-top:12px">
${rowsHtml}
</table>
<p style="margin-top:16px"><a href="https://crm.xn--c1abdaj0ewa6e.xn--p1ai/manager/leads" style="color:#0891b2">Открыть воронку →</a></p>
`);

  return { text, html };
}

// =============================================================
// Router: выбор шаблона по типу документа
// =============================================================
export function bodyForDocumentType(type: DocumentType, ctx: Ctx): MailBody {
  switch (type) {
    case 'commercial_offer':
      return commercialOfferBody(ctx);
    case 'contract':
      return contractBody(ctx);
    case 'addendum':
      return addendumBody(ctx);
    case 'act_work':
      return actWorkBody(ctx);
    case 'act_inspection':
      return actInspectionBody(ctx);
    case 'invoice':
      return invoiceBody(ctx);
    case 'other':
    default:
      return genericDocumentBody(ctx);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
