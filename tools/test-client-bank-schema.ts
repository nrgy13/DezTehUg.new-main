/**
 * Проверка банковских реквизитов клиента после включения сверки счёта с БИК (2026-08-12).
 * Запуск: npx tsx tools/test-client-bank-schema.ts
 *
 * Проверяем ПОВЕДЕНИЕ формы, а не «код компилируется»:
 *  - обычный счёт коммерческого банка сходится с БИК;
 *  - счёт с опечаткой ОТБИВАЕТСЯ (ради этого всё и делалось);
 *  - бюджетный заказчик с казначейским счётом и ЕКС в графе «корсчёт» СОХРАНЯЕТСЯ
 *    (до фикса он молча не сохранялся — регрессия, которую нельзя вернуть);
 *  - пустые банковские поля не мешают завести юрлицо (обход для Регины);
 *  - при кривом БИК ошибка идёт по БИК, а не «счёт не сходится» поверх настоящей причины.
 *
 * Все реквизиты РЕАЛЬНЫЕ, с прода: на выдуманных «тест прошёл» ничего не значил бы.
 */
import { clientFormSchema } from '../app/(crm)/manager/clients/schemas';
import { validateBankAccount, validateCorrAccount } from '../lib/validation/inn';

const base = {
  shortName: 'Тест',
  source: 'manager' as const,
  status: 'lead' as const,
  category: 'old' as const,
  type: 'legal' as const,
};

// --- реальные реквизиты с прода ---
const GONCHAROV = { inn: '233408985410', kpp: '', bik: '040349602', acc: '40802810330000108488', corr: '30101810100000000602' };
// АО «Флот НМТП»: в базе лежал счёт с переставленными цифрами (снимали со скана «зрением»),
// правильный взят из подписанного договора и подтверждён контрольной суммой.
const NMTP = { inn: '2315005197', kpp: '231501001', bik: '046015999', accWrong: '40702810530300001869', accRight: '40702810305300001869', corr: '30101810300000000999' };
// Бюджетник: «расчётный счёт» — казначейский 03…, «корсчёт» — единый казначейский 40102…
const TEHNIKUM = { inn: '2349010477', kpp: '234901001', bik: '010349101', acc: '03224643030000001800', corr: '40102810945370000010' };
// ООО «КРЕДО»: корсчёт от другого банка (в их же договоре). Тот же БИК у ИП Санодзе даёт корсчёт …207.
const KREDO = { inn: '2349033065', kpp: '234901001', bik: '046015207', acc: '40702810726020006866', corrWrong: '30101810500000000722', corrRight: '30101810500000000207' };

// --- ПРЕДУСЛОВИЕ: эталоны обязаны быть валидными, иначе тест меряет не то ---
const preconditions: Array<[string, boolean]> = [
  ['эталонный счёт Гончарова сходится с его БИК', validateBankAccount(GONCHAROV.acc, GONCHAROV.bik)],
  ['счёт НМТП ИЗ ДОГОВОРА сходится', validateBankAccount(NMTP.accRight, NMTP.bik)],
  ['счёт НМТП ИЗ БАЗЫ не сходится (то, что и поймали)', !validateBankAccount(NMTP.accWrong, NMTP.bik)],
  ['ЕКС техникума проходит как корсчёт', validateCorrAccount(TEHNIKUM.corr, TEHNIKUM.bik)],
  ['корсчёт КРЕДО из договора НЕ сходится с их БИК', !validateCorrAccount(KREDO.corrWrong, KREDO.bik)],
];
for (const [what, ok] of preconditions) {
  if (!ok) {
    console.error(`❌ ПРЕДУСЛОВИЕ ПРОВАЛЕНО: ${what} — тест недействителен`);
    process.exit(2);
  }
}
console.log('✅ предусловия сошлись (эталоны валидны, заведомо битые — невалидны)\n');

type Case = { name: string; input: unknown; expectOk: boolean; expectField?: string };

const cases: Case[] = [
  {
    name: 'Обычный клиент: БИК + верный счёт + корсчёт → ПРОЙТИ',
    input: { ...base, inn: GONCHAROV.inn, kpp: GONCHAROV.kpp, bankBik: GONCHAROV.bik, bankAccount: GONCHAROV.acc, bankCorrAccount: GONCHAROV.corr },
    expectOk: true,
  },
  {
    name: 'РАДИ ЭТОГО ВСЁ: счёт с опечаткой (одна цифра) → ОТБИТЬ по bankAccount',
    input: { ...base, inn: GONCHAROV.inn, kpp: GONCHAROV.kpp, bankBik: GONCHAROV.bik, bankAccount: GONCHAROV.acc.slice(0, 19) + (GONCHAROV.acc.endsWith('8') ? '9' : '8'), bankCorrAccount: GONCHAROV.corr },
    expectOk: false,
    expectField: 'bankAccount',
  },
  {
    name: 'НМТП: счёт из ДОГОВОРА → ПРОЙТИ',
    input: { ...base, inn: NMTP.inn, kpp: NMTP.kpp, bankBik: NMTP.bik, bankAccount: NMTP.accRight, bankCorrAccount: NMTP.corr },
    expectOk: true,
  },
  {
    name: 'НМТП: счёт как лежал В БАЗЕ (5303 вместо 3053) → ОТБИТЬ по bankAccount',
    input: { ...base, inn: NMTP.inn, kpp: NMTP.kpp, bankBik: NMTP.bik, bankAccount: NMTP.accWrong, bankCorrAccount: NMTP.corr },
    expectOk: false,
    expectField: 'bankAccount',
  },
  {
    name: 'РЕГРЕССИЯ: бюджетник (казначейский счёт + ЕКС в корсчёте) → ПРОЙТИ (раньше не сохранялся)',
    input: { ...base, inn: TEHNIKUM.inn, kpp: TEHNIKUM.kpp, bankBik: TEHNIKUM.bik, bankAccount: TEHNIKUM.acc, bankCorrAccount: TEHNIKUM.corr },
    expectOk: true,
  },
  {
    name: 'КРЕДО: корсчёт от чужого банка → ОТБИТЬ по bankCorrAccount',
    input: { ...base, inn: KREDO.inn, kpp: KREDO.kpp, bankBik: KREDO.bik, bankAccount: KREDO.acc, bankCorrAccount: KREDO.corrWrong },
    expectOk: false,
    expectField: 'bankCorrAccount',
  },
  {
    name: 'КРЕДО: корсчёт по их же БИК → ПРОЙТИ',
    input: { ...base, inn: KREDO.inn, kpp: KREDO.kpp, bankBik: KREDO.bik, bankAccount: KREDO.acc, bankCorrAccount: KREDO.corrRight },
    expectOk: true,
  },
  {
    name: 'ОБХОД РЕГИНЫ: банковские поля пустые → ПРОЙТИ (БИК необязателен)',
    input: { ...base, inn: NMTP.inn, kpp: NMTP.kpp, bankBik: '', bankAccount: '', bankCorrAccount: '' },
    expectOk: true,
  },
  {
    name: 'СЛУЧАЙ РЕГИНЫ: БИК 8 цифр → ОТБИТЬ ИМЕННО по bankBik, а не по счёту',
    input: { ...base, inn: NMTP.inn, kpp: NMTP.kpp, bankBik: '04034953', bankAccount: NMTP.accRight, bankCorrAccount: '' },
    expectOk: false,
    expectField: 'bankBik',
  },
  {
    name: 'НЕГ. КОНТРОЛЬ: счёт 19 цифр → ОТБИТЬ по bankAccount',
    input: { ...base, inn: GONCHAROV.inn, kpp: GONCHAROV.kpp, bankBik: GONCHAROV.bik, bankAccount: GONCHAROV.acc.slice(0, 19), bankCorrAccount: '' },
    expectOk: false,
    expectField: 'bankAccount',
  },
];

let failed = 0;
for (const c of cases) {
  const r = clientFormSchema.safeParse(c.input);
  const okMatch = r.success === c.expectOk;
  const fieldMatch =
    c.expectOk || !c.expectField
      ? true
      : !r.success && r.error.errors.some((e) => e.path.join('.') === c.expectField);
  const pass = okMatch && fieldMatch;
  if (!pass) failed++;
  const detail = r.success
    ? 'сохранение прошло'
    : r.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(' | ');
  console.log(`${pass ? '✅' : '❌'} ${c.name}\n     → ${detail}`);
}

// Отдельно: у случая с 8-значным БИК ошибка по счёту НЕ должна вылезать поверх настоящей причины.
const bikCase = clientFormSchema.safeParse(cases[8].input);
if (!bikCase.success && bikCase.error.errors.some((e) => e.path.join('.') === 'bankAccount')) {
  console.log('❌ при кривом БИК вылезла лишняя ошибка по счёту — она перекрывает настоящую причину');
  failed++;
}

console.log(`\nИТОГ: провалено ${failed} из ${cases.length}`);
process.exit(failed === 0 ? 0 : 1);
