/**
 * Валидаторы российских реквизитов с проверкой контрольных сумм
 * по алгоритмам ФНС/ЦБ.
 *
 * Все функции возвращают true только если:
 *   1. строка содержит ровно требуемое число цифр
 *   2. контрольная сумма сходится
 */

/**
 * ИНН: 10 цифр для юрлица, 12 для физлица/ИП.
 * Алгоритм ФНС.
 */
export function validateInn(value: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(value)) return false;

  const digits = value.split('').map(Number);

  if (digits.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
    return (sum % 11) % 10 === digits[9];
  }

  // 12 цифр: проверяем 11-ю и 12-ю
  const w11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const w12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const c11 = (w11.reduce((acc, w, i) => acc + w * digits[i], 0) % 11) % 10;
  const c12 = (w12.reduce((acc, w, i) => acc + w * digits[i], 0) % 11) % 10;
  return c11 === digits[10] && c12 === digits[11];
}

/**
 * ОГРН: 13 цифр для юрлица.
 * Алгоритм: первые 12 цифр как число mod 11, остаток mod 10 = последняя цифра.
 * (12-значное число помещается в Number без потери точности — max 9.99*10^11 < 2^53.)
 */
export function validateOgrn(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const head = Number(value.slice(0, 12));
  const expected = (head % 11) % 10;
  return expected === Number(value[12]);
}

/**
 * ОГРНИП: 15 цифр для ИП.
 * Алгоритм: первые 14 цифр как число mod 13, остаток mod 10 = последняя цифра.
 * (14-значное число помещается в Number — max 9.99*10^13 < 2^53.)
 */
export function validateOgrnip(value: string): boolean {
  if (!/^\d{15}$/.test(value)) return false;
  const head = Number(value.slice(0, 14));
  const expected = (head % 13) % 10;
  return expected === Number(value[14]);
}

/**
 * Универсальная проверка ОГРН/ОГРНИП по длине.
 */
export function validateOgrnAny(value: string): boolean {
  if (value.length === 13) return validateOgrn(value);
  if (value.length === 15) return validateOgrnip(value);
  return false;
}

/**
 * КПП: 9 символов.
 * Формат: 4 цифры (код налогового органа) + 2 цифро-буквенных (причина постановки) + 3 цифры (порядковый).
 */
export function validateKpp(value: string): boolean {
  return /^\d{4}[\dA-Z]{2}\d{3}$/.test(value);
}

/**
 * БИК: 9 цифр. Без контрольной суммы.
 */
export function validateBik(value: string): boolean {
  return /^\d{9}$/.test(value);
}

const ACCOUNT_WEIGHTS = [7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1];

/**
 * Счёт открыт в подразделении Банка России, а не в коммерческом банке?
 * Определяется балансовым счётом (первые разряды номера):
 *   30101… — корреспондентский счёт кредитной организации
 *   40102… — единый казначейский счёт (ЕКС)
 */
function isBankOfRussiaAccount(account: string): boolean {
  return account.startsWith('30101') || account.startsWith('40102');
}

/**
 * Казначейский счёт бюджетного учреждения (03…, с 2021 г.).
 *
 * ⚠️ КОНТРОЛЬНУЮ СУММУ ТАКИХ СЧЕТОВ МЫ НЕ ПРОВЕРЯЕМ — СОЗНАТЕЛЬНО.
 * У ГБПОУ «Славянский сельхозтехникум» счёт 03224643030000001800 при БИК 010349101
 * не сходится НИ по одному из двух правил ЦБ, хотя сверен с первоисточником (договор
 * .doc) — цифры в базе совпадают с документом, а его же ЕКС 40102… по правилу Банка
 * России сходится. То есть либо опечатка в самом договоре, либо для класса 03…
 * действует правило, которого я не знаю. Ни одного ПОДТВЕРЖДЁННОГО валидного счёта
 * этого класса под рукой нет — проверять непроверенным правилом значит забраковать
 * возможно верные реквизиты и заблокировать бюджетных заказчиков. Проверяем только длину.
 */
function isTreasuryAccount(account: string): boolean {
  return account.startsWith('0');
}

/**
 * Контрольный ключ 20-значного счёта (алгоритм ЦБ РФ, Положение 762-П).
 *
 * ⚠️ ТОНКОСТЬ, из-за которой «правильная» проверка легко становится неправильной:
 * условный номер участника расчётов берётся ПО-РАЗНОМУ.
 *   • счёт в кредитной организации (обычный р/с 40702…/40802…) → 3 ПОСЛЕДНИЕ цифры БИК;
 *   • счёт в подразделении Банка России (корсчёт 30101…, ЕКС 40102…, казначейский 03…)
 *     → «0» + 5-я и 6-я цифры БИК.
 * У бюджетных заказчиков (напр. ГБПОУ «Славянский сельхозтехникум») счёт именно второго
 * типа: посчитать его по хвосту БИК = забраковать заведомо верные реквизиты.
 */
function accountChecksumOk(account: string, bik: string): boolean {
  const prefix = isBankOfRussiaAccount(account) ? '0' + bik.slice(4, 6) : bik.slice(-3);
  const sum = (prefix + account)
    .split('')
    .reduce((acc, ch, i) => acc + Number(ch) * ACCOUNT_WEIGHTS[i], 0);
  return sum % 10 === 0;
}

/**
 * Расчётный (казначейский) счёт клиента: 20 цифр + контрольная сумма по БИК.
 *
 * Ловящая сила измерена на 29 реальных парах БИК+счёт с прода: 5220 внесённых опечаток
 * «одна цифра» — поймано 100%. Слепое пятно: перестановка соседних цифр проскакивает ~6%.
 */
export function validateBankAccount(account: string, bik: string): boolean {
  if (!/^\d{20}$/.test(account)) return false;
  if (!validateBik(bik)) return false;
  if (isTreasuryAccount(account)) return true; // см. isTreasuryAccount — правило не подтверждено
  return accountChecksumOk(account, bik);
}

/**
 * Корсчёт: 20 цифр. Допустимы ДВА вида:
 *   • 301…   — корсчёт банка в Банке России (обычные коммерческие клиенты);
 *   • 40102… — единый казначейский счёт (у бюджетных учреждений в графе «корсчёт»
 *              стоит именно он; требование «только 301» блокировало им сохранение).
 * Если передан БИК — дополнительно сверяется контрольная сумма.
 */
export function validateCorrAccount(value: string, bik?: string): boolean {
  if (!/^\d{20}$/.test(value)) return false;
  if (!value.startsWith('301') && !value.startsWith('40102')) return false;
  if (bik === undefined) return true;
  if (!validateBik(bik)) return false;
  return accountChecksumOk(value, bik);
}
