/**
 * Разовая проверка схемы клиента после фикса ИНН для ИП (2026-08-06).
 * Запуск: npx tsx tmp/test-client-inn-schema.ts
 *
 * Проверяем ПОВЕДЕНИЕ формы, а не «код компилируется»:
 *  - ИП (ИНН 12 цифр) сохраняется БЕЗ КПП — это и был блокер;
 *  - организация (ИНН 10) без КПП по-прежнему НЕ проходит;
 *  - битая длина и битая контрольная сумма отбиваются (негативные контроли).
 *
 * ИНН взяты РЕАЛЬНЫЕ с прода (не выдуманные): иначе «тест прошёл» ничего не значил бы.
 */
import { clientFormSchema } from '../app/(crm)/manager/clients/schemas';
import { validateInn } from '../lib/validation/inn';

const base = {
  shortName: 'Тест',
  source: 'manager' as const,
  status: 'lead' as const,
  category: 'new' as const,
};

// С прода: организация и ИП.
const INN_ORG = '2315005197'; // АО «Флот НМТП», 10 цифр
const KPP_ORG = '231501001';
const INN_IP = '233408985410'; // ИП Гончаров М.С., 12 цифр

// Негативный контроль: у последней цифры ИНН роль контрольной суммы,
// поэтому её подмена ГАРАНТИРОВАННО делает номер невалидным.
const INN_IP_BROKEN = INN_IP.slice(0, 11) + (INN_IP.endsWith('1') ? '2' : '1');

// --- предусловие: сами эталоны обязаны быть валидными, иначе тест меряет не то ---
if (!validateInn(INN_ORG) || !validateInn(INN_IP)) {
  console.error('❌ ПРЕДУСЛОВИЕ ПРОВАЛЕНО: эталонные ИНН с прода не проходят validateInn — тест недействителен');
  process.exit(2);
}
if (validateInn(INN_IP_BROKEN)) {
  console.error('❌ ПРЕДУСЛОВИЕ ПРОВАЛЕНО: «испорченный» ИНН считается валидным — негативный контроль слеп');
  process.exit(2);
}

type Case = { name: string; input: unknown; expectOk: boolean; expectField?: string };

const cases: Case[] = [
  {
    name: 'ИП: ИНН 12 цифр, КПП пустой → ПРОЙТИ (тот самый блокер Регины)',
    input: { ...base, type: 'legal', inn: INN_IP, kpp: '' },
    expectOk: true,
  },
  {
    name: 'ИП: ИНН 12 цифр, КПП не прислан вовсе → ПРОЙТИ',
    input: { ...base, type: 'legal', inn: INN_IP },
    expectOk: true,
  },
  {
    name: 'Организация: ИНН 10 + КПП → ПРОЙТИ (старое не сломано)',
    input: { ...base, type: 'legal', inn: INN_ORG, kpp: KPP_ORG },
    expectOk: true,
  },
  {
    name: 'Организация: ИНН 10 БЕЗ КПП → ОТБИТЬ по полю kpp',
    input: { ...base, type: 'legal', inn: INN_ORG, kpp: '' },
    expectOk: false,
    expectField: 'kpp',
  },
  {
    name: 'НЕГ. КОНТРОЛЬ: ИНН 11 цифр → ОТБИТЬ по полю inn',
    input: { ...base, type: 'legal', inn: INN_IP.slice(0, 11), kpp: '' },
    expectOk: false,
    expectField: 'inn',
  },
  {
    name: 'НЕГ. КОНТРОЛЬ: 12 цифр с битой контрольной суммой → ОТБИТЬ по полю inn',
    input: { ...base, type: 'legal', inn: INN_IP_BROKEN, kpp: '' },
    expectOk: false,
    expectField: 'inn',
  },
  {
    name: 'Физлицо: ИНН 12 → ПРОЙТИ',
    input: { ...base, type: 'individual', inn: INN_IP },
    expectOk: true,
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
    ? `ok, kpp=${JSON.stringify((r.data as Record<string, unknown>).kpp)}`
    : r.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(' | ');
  console.log(`${pass ? '✅' : '❌'} ${c.name}\n     → ${detail}`);
}

console.log(`\nИТОГ: провалено ${failed} из ${cases.length}`);
process.exit(failed === 0 ? 0 : 1);
