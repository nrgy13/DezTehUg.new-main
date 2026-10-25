/**
 * Подготовка текста для таблицы объектов в АО/АВР.
 *
 * Адреса и названия часто набиты без пробелов после запятых:
 * «г.Анапа,ст.Анапская,ул.Ландышевая,д.1». Для LibreOffice это одно «слово»,
 * а в узкую ячейку оно не влезает, и LibreOffice рвёт его посреди
 * («Ланды|шевая»). Так было в 50 актах из 267 (жалоба Регины 13.10.2026).
 * Пробел после запятой даёт место для переноса.
 *
 * Десятичную запятую между цифрами («827,7») не трогаем.
 */
export function spaceAfterCommas(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += ch;
    if (ch !== ',' || i + 1 >= s.length) continue;
    const next = s[i + 1];
    const prev = i > 0 ? s[i - 1] : '';
    if (!/[0-9A-Za-zА-Яа-яЁё(«№"]/.test(next)) continue;
    if (/[0-9]/.test(prev) && /[0-9]/.test(next)) continue;
    out += ' ';
  }
  return out;
}

/**
 * Контакт заказчика-физлица в АВР. У физлица в блоке «Заказчик» печатаются
 * только «Контакт» и «Мобильный» (без названия и ИНН), поэтому пустой контакт
 * объекта оставил бы заказчика безымянным. Тогда берём имя и телефон из карточки
 * клиента: у физлица он сам и есть контактное лицо.
 */
export function actContact(input: {
  isIndividual: boolean;
  contactName: string | null | undefined;
  contactPhone: string | null | undefined;
  clientName: string | null | undefined;
  clientPhone: string | null | undefined;
}): { name: string; phone: string } {
  const name = input.contactName?.trim() ?? '';
  const phone = input.contactPhone?.trim() ?? '';
  if (!input.isIndividual) return { name, phone };
  return {
    name: name || input.clientName?.trim() || '',
    phone: phone || input.clientPhone?.trim() || '',
  };
}
