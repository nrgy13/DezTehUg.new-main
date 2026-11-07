/**
 * Дата заказ-наряда — ОДНО правило для календаря, списков, истории, актов, сводки и отчётов.
 *
 * Дата наряда = ПЛАНОВАЯ (planned_at). «Начать» и «Завершить» у мастера её не двигают:
 * started_at / finalized_at / performed_at — это факт (когда нажали), а не дата наряда.
 * Раньше наряд «в работе» показывался по started_at, выполненный — по performed_at, и
 * наряд, начатый мастером заранее, в календаре уезжал на день нажатия (жалоба Регины
 * 07.11.2026: «когда человек берёт наряд в работу, дата и время должны быть неприкосновенны»).
 * Менять дату наряда может только менеджер (перенос / «Редактировать»).
 *
 * Без плановой даты (legacy-записи журнала мастера) — откат на факт.
 * Работает и с Date, и с ISO-строками (клиентские компоненты получают сериализованное).
 */
export function workOrderDate<T extends Date | string>(w: {
  plannedAt?: T | null;
  performedAt?: T | null;
  finalizedAt?: T | null;
  startedAt?: T | null;
}): T | null {
  return w.plannedAt || w.performedAt || w.finalizedAt || w.startedAt || null;
}

/** SQL-аналог workOrderDate для запросов по алиасу таблицы deal_work_logs (напр. 'w'). */
export function workOrderDateSql(alias: string): string {
  return `COALESCE(${alias}.planned_at, ${alias}.performed_at, ${alias}.finalized_at, ${alias}.started_at)`;
}
