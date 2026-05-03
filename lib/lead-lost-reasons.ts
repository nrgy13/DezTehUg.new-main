import type { LeadLostReason } from '@/lib/db/schema/leads';

/**
 * Человеческие лейблы и подсказки для enum lead_lost_reason.
 * Используется в LostReasonModal (выбор причины) и в карточке лида (отображение).
 */
export const LEAD_LOST_REASONS: { code: LeadLostReason; label: string; hint: string }[] = [
  { code: 'price_too_high', label: 'Высокая цена', hint: 'Дорого по сравнению с конкурентами' },
  { code: 'chose_competitor', label: 'Выбрали конкурента', hint: 'Ушли к другому подрядчику' },
  { code: 'no_response', label: 'Не отвечает', hint: 'Перестал отвечать / не дозвонились' },
  { code: 'not_relevant', label: 'Потребность отпала', hint: 'Передумали, проблема решилась' },
  { code: 'postponed', label: 'Отложили решение', hint: '«Подумаем», бесконечное откладывание' },
  { code: 'diy_solved', label: 'Решили сами', hint: 'Купили химию и обработали самостоятельно' },
  { code: 'wrong_region', label: 'Не наш регион', hint: 'Объект вне зоны обслуживания' },
  { code: 'spam', label: 'Ошибочная заявка', hint: 'Спам, бот, неправильный номер' },
  { code: 'other', label: 'Другое', hint: 'Тогда заполни комментарий' },
];

export const LEAD_LOST_REASON_LABELS = Object.fromEntries(
  LEAD_LOST_REASONS.map((r) => [r.code, r.label])
) as Record<LeadLostReason, string>;
