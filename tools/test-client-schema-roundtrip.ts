/**
 * ТЕСТ СВОЙСТВА СХЕМЫ: она обязана переваривать СВОЙ ЖЕ результат (round-trip).
 *
 * Зачем отдельный тест. В проде схема клиента парсится ДВА раза:
 *   1) в браузере — zodResolver отдаёт в onSubmit уже OUTPUT схемы (после .transform);
 *   2) на сервере — createClient/updateClient делают clientFormSchema.safeParse(того же объекта).
 * Если OUTPUT не является валидным INPUT, сохранение падает сырой англоязычной ошибкой zod,
 * а менеджер видит непонятное «Expected string, received null» и не может завести клиента.
 *
 * Ровно так сломался КПП у ИП (жалоба Регины 18.08.2026, ИП Самойлюк М.И.): kpp на выходе
 * даёт null, а optionalTrimmed был .optional() и null на входе не принимал. У организаций
 * не воспроизводилось — там КПП заполнен строкой.
 *
 * ⚠️ Обычные тесты этот класс НЕ ловят: они парсят ОДИН раз и проходят на сломанной схеме.
 *
 * Запуск: npx tsx tools/test-client-schema-roundtrip.ts
 */
import { clientFormSchema } from '../app/(crm)/manager/clients/schemas';

type Case = { name: string; input: Record<string, unknown> };

const base = {
  source: 'manager',
  status: 'lead',
  category: 'new',
};

const cases: Case[] = [
  {
    // Живой случай Регины: ИП, КПП пустой — именно он падал.
    name: 'ИП (ИНН 12), КПП пустой — случай ИП Самойлюк М.И.',
    input: {
      ...base, type: 'legal',
      shortName: 'ИП Самойлюк М.И.',
      fullName: 'Индивидуальный предприниматель Самойлюк Мария Ивановна',
      phone: '8-912-933-80-25',
      inn: '231511098659', kpp: '', ogrn: '326237500157942',
      legalAddress: 'г. Новороссийск, ул. Видова, 167, кв 242',
    },
  },
  {
    name: 'ИП, КПП не прислан вовсе (поля нет в объекте)',
    input: { ...base, type: 'legal', shortName: 'ИП Тест', inn: '231511098659' },
  },
  {
    name: 'Организация (ИНН 10) с КПП — не должна была сломаться',
    input: { ...base, type: 'legal', shortName: 'ООО Тест', inn: '7707083893', kpp: '773601001' },
  },
  {
    name: 'Организация с полными банковскими реквизитами',
    input: {
      ...base, type: 'legal', shortName: 'ООО Банк', inn: '7707083893', kpp: '773601001',
      bankName: 'АО РОССЕЛЬХОЗБАНК', bankBik: '040349602',
      bankAccount: '40802810330000166200', bankCorrAccount: '30101810100000000602',
    },
  },
  {
    name: 'Физлицо без ИНН (все optional-поля пустые)',
    input: { ...base, type: 'individual', shortName: 'Иванов И.И.' },
  },
  {
    name: 'Физлицо с ИНН',
    input: { ...base, type: 'individual', shortName: 'Петров П.П.', inn: '231511098659' },
  },
];

let failed = 0;

for (const c of cases) {
  const p1 = clientFormSchema.safeParse(c.input);
  if (!p1.success) {
    failed++;
    console.log(`❌ ${c.name}\n     парс #1 не прошёл: ${p1.error.issues[0].path.join('.')}: ${p1.error.issues[0].message}`);
    continue;
  }
  // Ключевая проверка: OUTPUT первого парса скармливаем схеме второй раз —
  // ровно это делает server action с тем, что прислала форма.
  const p2 = clientFormSchema.safeParse(p1.data);
  if (!p2.success) {
    failed++;
    const i = p2.error.issues[0];
    console.log(`❌ ${c.name}\n     ПАРС #2 УПАЛ (схема не переваривает свой результат): ${i.path.join('.')}: ${i.message}`);
    continue;
  }
  // И третий проход — на случай, если transform не стабилизируется за один шаг.
  const p3 = clientFormSchema.safeParse(p2.data);
  if (!p3.success) {
    failed++;
    console.log(`❌ ${c.name}\n     парс #3 упал — transform не стабилен`);
    continue;
  }
  if (JSON.stringify(p2.data) !== JSON.stringify(p3.data)) {
    failed++;
    console.log(`❌ ${c.name}\n     результат «плывёт» между проходами:\n       #2 ${JSON.stringify(p2.data)}\n       #3 ${JSON.stringify(p3.data)}`);
    continue;
  }
  console.log(`✅ ${c.name}\n     round-trip стабилен, kpp=${JSON.stringify((p2.data as Record<string, unknown>).kpp)}`);
}

// НЕГАТИВНЫЙ КОНТРОЛЬ ПРИБОРА: тест обязан уметь падать.
// Подсовываем заведомо мусорный объект — если он «пройдёт», тест слеп и его выводу верить нельзя.
const sentinel = clientFormSchema.safeParse({ ...base, type: 'legal', shortName: '', inn: 'мусор' });
if (sentinel.success) {
  failed++;
  console.log('❌ НЕГ. КОНТРОЛЬ: мусорный клиент ПРОШЁЛ схему — прибор слеп, результатам верить нельзя');
} else {
  console.log(`✅ НЕГ. КОНТРОЛЬ: мусорный клиент отбит (${sentinel.error.issues[0].path.join('.') || '—'}) — прибор видит`);
}

console.log(`\nИТОГ: провалено ${failed} из ${cases.length + 1}`);
process.exit(failed > 0 ? 1 : 0);
