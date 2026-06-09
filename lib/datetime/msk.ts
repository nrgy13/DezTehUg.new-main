// Время в CRM трактуется в Europe/Moscow: компания (ИП Белавина, Новороссийск) и
// все пользователи работают в МСК. МСК — фиксированный UTC+3 (РФ не переходит на
// летнее время с 2014), поэтому смещение — константа, без таблиц DST.
//
// Зачем модуль: дата выезда — операционная дата в МСК. Раньше она собиралась через
// new Date("YYYY-MM-DDTHH:mm").toISOString(), что трактует ввод в TZ БРАУЗЕРА. При
// браузере вне МСК дата наряда уезжала на соседний день → флажок напоминания
// «оформи наряд» (серия строится в МСК) не гас. Здесь — единая трактовка в МСК.

export const MSK_TZ = 'Europe/Moscow';
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Значение <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") трактуем как местное
 * МСК-время и переводим в UTC ISO — НЕ через new Date(), который зависит от TZ
 * браузера. На некорректном формате — fallback на прежнее поведение (на всякий).
 */
export function mskLocalToUtcISO(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return new Date(local).toISOString();
  const [, y, mo, d, hh, mm] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm) - MSK_OFFSET_MS).toISOString();
}
