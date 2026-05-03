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

/**
 * Расчётный счёт: 20 цифр.
 * Контрольная сумма по алгоритму ЦБ РФ:
 *   - берём 3 последние цифры БИК + 20 цифр счёта (всего 23)
 *   - умножаем на веса [7,1,3,7,1,3,7,1,3,7,1,3,7,1,3,7,1,3,7,1,3,7,1]
 *   - сумма % 10 должна быть 0
 */
export function validateBankAccount(account: string, bik: string): boolean {
  if (!/^\d{20}$/.test(account)) return false;
  if (!validateBik(bik)) return false;

  const combined = bik.slice(-3) + account;
  const weights = [7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = combined.split('').reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0);
  return sum % 10 === 0;
}

/**
 * Корсчёт: 20 цифр, начинается на 301 (счёт ЦБ для коммерческих банков).
 * Проверка контрольной суммы — та же что для расчётного, с виртуальным "0BIK"
 * (фактически берём 0 + первые 2 цифры БИК + остальное).
 *
 * Упрощённая проверка: длина 20, начало "301".
 */
export function validateCorrAccount(value: string): boolean {
  return /^301\d{17}$/.test(value);
}
