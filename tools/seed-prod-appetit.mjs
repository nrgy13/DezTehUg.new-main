// Генератор SQL для импорта реальных данных ООО «Аппетит» на prod.
// Источник — 12 DOCX в DTUdocs/ (распарсены сабагентом).
//
// Использование:
//   node tools/seed-prod-appetit.mjs > tmp/seed-appetit.sql
//   docker cp tmp/seed-appetit.sql deztech-crm-postgres:/tmp/seed.sql
//   docker exec -i deztech-crm-postgres psql -U deztech deztech_crm -f /tmp/seed.sql

import { randomUUID } from 'crypto';

// User IDs с prod (получены ранее)
const REGINA = '6377c48b-d37c-408f-8f81-fa8da2ac7764';
const ALEX = '533f9dd0-ab14-46be-a1e0-8ea2d387a3eb';
// IDs мастеров будут заменены на реальные UUID после INSERT в users
// (создаются отдельным скриптом, см. tools/seed-prod-masters.mjs)
const MASTER_DENISOV = '__DENISOV_ID__'; // подставится перед apply
const MASTER_NECHEPORENKO = '__NECHEPORENKO_ID__';

const today = new Date().toISOString().slice(0, 10);

const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const num = (n) => (n == null ? 'NULL' : String(n));

// ─── Реквизиты клиента ──────────────────────────────────────
const APPETIT = {
  id: randomUUID(),
  type: 'legal',
  shortName: 'ООО «Аппетит»',
  fullName: 'Общество с ограниченной ответственностью «Аппетит»',
  phone: '8-988-236-05-07',
  email: 'info@appetit.su',
  inn: '2320155529',
  kpp: '236701001',
  ogrn: '1072320016801',
  legalAddress: '354340, Краснодарский край, г. Сочи, ул. Гастелло, дом 28',
  postalAddress: '354000, Краснодарский край, г. Сочи, а/я 184',
  directorName: 'Мороз А.Е.',
  directorRole: 'Генеральный директор',
  actingBasis: 'Устава',
  bankName: 'ЮГО-ЗАПАДНЫЙ БАНК ПАО СБЕРБАНК',
  bankAccount: '40702810030060009260',
  bankBik: '046015602',
  bankCorrAccount: '30101810600000000602',
  source: 'recurring',
  status: 'active',
  notes: '[REAL_CLIENT] Партнёр-кейтеринг. Управляет столовыми в санаториях Краснодарского края. Договор №ДТЮ-28/01/26-16 от 28.01.2026.',
};

// ─── 8 объектов ─────────────────────────────────────────────
const OBJECTS = [
  { id: randomUUID(), name: 'Столовая «Олива Парк» (с/т Каникулы в Анапе 4*)', address: 'г. Анапа, Пионерский проспект, 23', areaM2: 1175, objectType: 'столовая', contactPerson: 'Анна (управляющая)', contactPhone: '8-918-007-23-37' },
  { id: randomUUID(), name: 'Столовая «Персей» (с/т Каникулы в Анапе 4*)', address: 'г. Анапа, Пионерский проспект, 45', areaM2: 538, objectType: 'столовая', contactPerson: 'Анна (управляющая)', contactPhone: '8-918-007-23-37' },
  { id: randomUUID(), name: 'Столовая «Эллада» (с/т Каникулы в Анапе 4*)', address: 'г. Анапа, Пионерский проспект, 45', areaM2: 1102, objectType: 'столовая', contactPerson: 'Анна (управляющая)', contactPhone: '8-918-007-23-37' },
  { id: randomUUID(), name: 'Производственная площадка «Грушовая»', address: 'г. Новороссийск, Грушовая Балка, П/О 16', areaM2: 90, objectType: 'производственная площадка', contactPerson: 'Лилия', contactPhone: '8-987-252-43-39' },
  { id: randomUUID(), name: 'Столовая «Курортная Деревня»', address: 'г. Анапа, Витязево, ул. Знойная, д. 22', areaM2: 1026, objectType: 'столовая', contactPerson: 'Малышев Ю.Ю.', contactPhone: '8-989-258-76-57' },
  { id: randomUUID(), name: 'Столовая СОК Анапа «Нептун»', address: 'г. Анапа, Пионерский проспект, 106', areaM2: 1027, objectType: 'столовая', contactPerson: 'Сафронов А.В.', contactPhone: '8-904-492-54-63' },
  { id: randomUUID(), name: 'База отдыха «Рассвет»', address: 'Краснодарский край, мун. обр. Геленджик, с. Архипо-Осиповка', areaM2: 530, objectType: 'база отдыха', contactPerson: null, contactPhone: null, notes: 'Контакты уточнить' },
  { id: randomUUID(), name: 'Столовая (Новороссийск)', address: '[TODO: уточнить адрес] г. Новороссийск', areaM2: 197, objectType: 'столовая', contactPerson: null, contactPhone: null, notes: 'Адрес и контакты уточнить' },
];

// Хелпер для выбора объекта по части имени
const findObj = (needle) => {
  const o = OBJECTS.find((o) => o.name.includes(needle));
  if (!o) throw new Error(`Object not found: ${needle}`);
  return o;
};

// ─── 1 сделка ───────────────────────────────────────────────
const DEAL = {
  id: randomUUID(),
  contractNumber: 'ДТЮ-28/01/26-16',
  contractDate: '2026-01-28',
  startDate: '2026-01-28',
  endDate: '2027-01-28',
  status: 'active',
  signatoryExecutor: 'ИП Белавина Ольга Владимировна',
  signatoryClient: 'Генеральный директор Мороз А.Е.',
  // total_amount будет вычислен из price_items при отображении
};

// ─── ~20 прайс-позиций ──────────────────────────────────────
const PRICE_ITEMS = [
  // ДС№1 (28.01.2026) — Грушовая
  { object: 'Грушовая', customName: 'Дератизация (пест-контроль)', method: 'Контейнерные ловушки', frequency: 'По заявке', priceNoVat: 1190.48, priceWithVat: 1250.00 },
  { object: 'Грушовая', customName: 'Дезинсекция (тараканы)', method: 'Туман', frequency: 'Ежемесячно', priceNoVat: 2380.95, priceWithVat: 2500.00 },
  // ДС№2 (27.03.2026)
  { object: 'СОК Анапа', customName: 'Дератизация (пест-контроль)', method: 'Контейнерные ловушки', frequency: 'По заявке', priceNoVat: 3666.67, priceWithVat: 3850.00 },
  { object: 'СОК Анапа', customName: 'Дезинсекция (тараканы)', method: 'Туман', frequency: 'По заявке', priceNoVat: 7333.33, priceWithVat: 7700.00 },
  { object: 'Курортная', customName: 'Дератизация (пест-контроль)', method: 'Контейнерные ловушки', frequency: 'По заявке', priceNoVat: 2571.43, priceWithVat: 2700.00 },
  { object: 'Курортная', customName: 'Дезинсекция (тараканы)', method: 'Туман', frequency: 'По заявке', priceNoVat: 5142.86, priceWithVat: 5400.00 },
  // ДС№3 (03.04.2026) — Каникулы (3 объекта × 3 услуги) + Новороссийск
  { object: 'Олива', customName: 'Дезинсекция (тараканы) — ежемес.', method: 'Сухая/Точечное орошение/Туман', frequency: 'Ежемесячно', priceNoVat: 6153.71, priceWithVat: 6461.40 },
  { object: 'Олива', customName: 'Дезинсекция (тараканы) — по заявке', method: 'Сухая/Точечное орошение/Туман', frequency: 'По заявке', priceNoVat: 8333.33, priceWithVat: 8750.00 },
  { object: 'Олива', customName: 'Дератизация (пест-контроль)', method: 'Сухая', frequency: 'По заявке', priceNoVat: 4166.67, priceWithVat: 4375.00 },
  { object: 'Персей', customName: 'Дезинсекция (тараканы) — ежемес.', method: 'Сухая/Точечное орошение/Туман', frequency: 'Ежемесячно', priceNoVat: 2820.30, priceWithVat: 2961.31 },
  { object: 'Персей', customName: 'Дезинсекция (тараканы) — по заявке', method: 'Сухая/Точечное орошение/Туман', frequency: 'По заявке', priceNoVat: 5306.67, priceWithVat: 5572.00 },
  { object: 'Персей', customName: 'Дератизация (пест-контроль)', method: 'Сухая', frequency: 'По заявке', priceNoVat: 2653.33, priceWithVat: 2786.00 },
  { object: 'Эллада', customName: 'Дезинсекция (тараканы) — ежемес.', method: 'Сухая/Точечное орошение/Туман', frequency: 'Ежемесячно', priceNoVat: 5772.81, priceWithVat: 6060.45 },
  { object: 'Эллада', customName: 'Дезинсекция (тараканы) — по заявке', method: 'Сухая/Точечное орошение/Туман', frequency: 'По заявке', priceNoVat: 8215.24, priceWithVat: 8626.00 },
  { object: 'Эллада', customName: 'Дератизация (пест-контроль)', method: 'Сухая', frequency: 'По заявке', priceNoVat: 4107.62, priceWithVat: 4313.00 },
  { object: 'Новороссийск)', customName: 'Дезинсекция (тараканы) — ежемес.', method: 'Сухая/Точечное орошение/Туман', frequency: 'Ежемесячно', priceNoVat: 4285.71, priceWithVat: 4500.00 },
  { object: 'Новороссийск)', customName: 'Дезинсекция (тараканы) — по заявке', method: 'Сухая/Точечное орошение/Туман', frequency: 'По заявке', priceNoVat: 5904.76, priceWithVat: 6200.00 },
  { object: 'Новороссийск)', customName: 'Дератизация (пест-контроль)', method: 'Сухая', frequency: 'По заявке', priceNoVat: 2142.86, priceWithVat: 2250.00 },
  // ДС№4 (23.04.2026) — Архипо-Осиповка
  { object: 'Рассвет', customName: 'Дезинсекция (тараканы)', method: 'Сухая/Точечное орошение/Туман', frequency: 'По заявке', priceNoVat: 5714.29, priceWithVat: 6000.00 },
  { object: 'Рассвет', customName: 'Дератизация (пест-контроль)', method: 'Сухая', frequency: 'По заявке', priceNoVat: 2857.14, priceWithVat: 3000.00 },
];

// ─── 4 ДС ───────────────────────────────────────────────────
const ADDENDUMS = [
  { id: randomUUID(), number: 1, date: '2026-01-28', description: 'Подключение производственной площадки «Грушовая» (Новороссийск). Дератизация по заявке + дезинсекция ежемесячно.' },
  { id: randomUUID(), number: 2, date: '2026-03-27', description: 'Подключение объектов: Столовая СОК Анапа «Нептун» + Столовая «Курортная Деревня» (Витязево). Обе услуги по заявке.' },
  { id: randomUUID(), number: 3, date: '2026-04-03', description: 'Подключение санатория «Каникулы в Анапе 4*» (3 столовые: Олива Парк, Персей, Эллада) + объект Новороссийск 197 м². По 3 тарифа на каждый объект.' },
  { id: randomUUID(), number: 4, date: '2026-04-23', description: 'Подключение Базы отдыха «Рассвет» (с. Архипо-Осиповка). Дезинсекция + дератизация по заявке.' },
];

// ─── 7 актов работ (documents) ──────────────────────────────
// docx_s3_key указывает на файл в storage — он будет залит scp'ом отдельно
const DOCUMENTS = [
  { id: randomUUID(), number: 'АР-2026-001', date: '2026-03-31', objectKey: 'Грушовая', services: 'Дератизация + дезинсекция', master: 'DENISOV', sourceFile: 'Акт по проведению работ ИП Белавина О.В. Площадка Грушовая (дератизация+дезинскекция).docx' },
  { id: randomUUID(), number: 'АР-2026-002', date: '2026-03-30', objectKey: 'Курортная', services: 'Дератизация + дезинсекция', master: 'NECHEPORENKO', sourceFile: 'Акт по проведению работ ИП Белавина О.В. Столовая Курортная деревня  Анапа.docx' },
  { id: randomUUID(), number: 'АР-2026-003', date: '2026-03-30', objectKey: 'СОК Анапа', services: 'Дератизация + дезинсекция', master: 'NECHEPORENKO', sourceFile: 'Акт по проведению работ ИП Белавина О.В. Столовая СОК Анапа.docx' },
  { id: randomUUID(), number: 'АР-2026-004', date: '2026-04-07', objectKey: 'Олива', services: 'Дезинсекция', master: 'DENISOV', sourceFile: 'Акт по проведению работ  ИП Белавина Санаторий Каникулы в Анапе Столовая Олива Парк.docx' },
  { id: randomUUID(), number: 'АР-2026-005', date: '2026-04-07', objectKey: 'Персей', services: 'Дезинсекция', master: 'DENISOV', sourceFile: 'Акт по проведению работ  ИП Белавина Санаторий Каникулы в Анапе Столовая Персей.docx' },
  { id: randomUUID(), number: 'АР-2026-006', date: '2026-04-07', objectKey: 'Эллада', services: 'Дезинсекция', master: 'DENISOV', sourceFile: 'Акт по проведению работ  ИП Белавина Санаторий Каникулы в Анапе Столовая Эллада.docx' },
  { id: randomUUID(), number: 'АР-2026-007', date: '2026-04-27', objectKey: 'Грушовая', services: 'Дезинсекция (повтор)', master: 'NECHEPORENKO', sourceFile: 'Акт по проведению работ ИП Белавина О.В. Площадка Грушовая дезинсекция.docx' },
];

// ─── Также проинициализируем counters документов чтобы CRM-нумерация ───
// продолжалась с правильных значений после импорта.
// ДС: использовали 4 → counter 4
// АР: использовали 7 → counter 7

// ─── Генерация SQL ──────────────────────────────────────────
const sql = [];
sql.push('-- ImportRealAppetit_2026-05-06.sql');
sql.push(`-- Генератор: tools/seed-prod-appetit.mjs (запуск ${new Date().toISOString()})`);
sql.push('-- Создаёт 1 клиента ООО «Аппетит» + 8 объектов + 1 сделку + 4 ДС + 7 актов + ~20 прайс-позиций');
sql.push('-- Привязывает к Регине (manager) и Денисову/Нечепоренко (master).');
sql.push('--');
sql.push('-- ВНИМАНИЕ: до запуска должны быть подставлены реальные UUID мастеров');
sql.push('-- через sed: __DENISOV_ID__ → uuid, __NECHEPORENKO_ID__ → uuid');
sql.push('');
sql.push('BEGIN;');
sql.push('');

// 1. Клиент
sql.push(`-- 1. Клиент: ${APPETIT.shortName}`);
sql.push(`INSERT INTO clients (
  id, type, short_name, full_name, phone, email,
  inn, kpp, ogrn, legal_address, postal_address,
  director_name, director_role, acting_basis,
  bank_name, bank_account, bank_bik, bank_corr_account,
  source, status, notes,
  created_by_id, assigned_manager_id, created_at, updated_at
) VALUES (
  ${q(APPETIT.id)}, ${q(APPETIT.type)}, ${q(APPETIT.shortName)}, ${q(APPETIT.fullName)},
  ${q(APPETIT.phone)}, ${q(APPETIT.email)},
  ${q(APPETIT.inn)}, ${q(APPETIT.kpp)}, ${q(APPETIT.ogrn)},
  ${q(APPETIT.legalAddress)}, ${q(APPETIT.postalAddress)},
  ${q(APPETIT.directorName)}, ${q(APPETIT.directorRole)}, ${q(APPETIT.actingBasis)},
  ${q(APPETIT.bankName)}, ${q(APPETIT.bankAccount)}, ${q(APPETIT.bankBik)}, ${q(APPETIT.bankCorrAccount)},
  ${q(APPETIT.source)}, ${q(APPETIT.status)}, ${q(APPETIT.notes)},
  ${q(REGINA)}, ${q(REGINA)}, NOW(), NOW()
);`);
sql.push('');

// 2. Объекты
sql.push('-- 2. 8 объектов обслуживания');
for (const o of OBJECTS) {
  sql.push(`INSERT INTO client_objects (id, client_id, name, address, area_m2, object_type, contact_person, contact_phone, notes, created_at, updated_at) VALUES (
  ${q(o.id)}, ${q(APPETIT.id)}, ${q(o.name)}, ${q(o.address)}, ${num(o.areaM2)}, ${q(o.objectType)},
  ${q(o.contactPerson)}, ${q(o.contactPhone)}, ${q(o.notes ?? null)}, NOW(), NOW()
);`);
}
sql.push('');

// 3. Сделка
sql.push('-- 3. Сделка (Договор №ДТЮ-28/01/26-16)');
sql.push(`INSERT INTO deals (
  id, contract_number, contract_date, contract_place, client_id,
  start_date, end_date, status,
  signatory_executor, signatory_client,
  currency, assigned_manager_id, assigned_master_id, created_by_id,
  created_at, updated_at
) VALUES (
  ${q(DEAL.id)}, ${q(DEAL.contractNumber)}, ${q(DEAL.contractDate)}, ${q('г. Новороссийск')},
  ${q(APPETIT.id)}, ${q(DEAL.startDate)}, ${q(DEAL.endDate)}, ${q(DEAL.status)},
  ${q(DEAL.signatoryExecutor)}, ${q(DEAL.signatoryClient)},
  'RUB', ${q(REGINA)}, ${q(MASTER_DENISOV)}, ${q(REGINA)},
  NOW(), NOW()
);`);
sql.push('');

// 4. Прайс-позиции
sql.push(`-- 4. ${PRICE_ITEMS.length} прайс-позиций`);
let sortOrder = 0;
for (const p of PRICE_ITEMS) {
  const obj = findObj(p.object);
  sql.push(`INSERT INTO deal_price_items (id, deal_id, object_id, custom_name, area_m2, method, frequency, price_no_vat, price_with_vat, vat_rate, sort_order, created_at, updated_at) VALUES (
  ${q(randomUUID())}, ${q(DEAL.id)}, ${q(obj.id)}, ${q(p.customName)},
  ${num(obj.areaM2)}, ${q(p.method)}, ${q(p.frequency)},
  ${num(p.priceNoVat.toFixed(2))}, ${num(p.priceWithVat.toFixed(2))}, '5.00', ${num(sortOrder++)},
  NOW(), NOW()
);`);
}
sql.push('');

// 5. ДС
sql.push('-- 5. 4 доп. соглашения');
for (const a of ADDENDUMS) {
  sql.push(`INSERT INTO deal_addendums (id, deal_id, number, date, description, status, created_by_id, created_at, updated_at) VALUES (
  ${q(a.id)}, ${q(DEAL.id)}, ${num(a.number)}, ${q(a.date)},
  ${q(a.description)}, 'signed', ${q(REGINA)}, NOW(), NOW()
);`);
}
sql.push('');

// 6. Документы (акты + 4 ДС-документа)
sql.push('-- 6. 7 актов работ как документы (с привязкой к DOCX в storage)');
for (const d of DOCUMENTS) {
  const masterId = d.master === 'DENISOV' ? MASTER_DENISOV : MASTER_NECHEPORENKO;
  const safeNumber = d.number.replace('/', '-');
  const docxKey = `documents/2026/act_work/${safeNumber}.docx`;
  sql.push(`INSERT INTO documents (id, type, number, date, title, client_id, deal_id, status, docx_s3_key, created_by_id, created_at, updated_at) VALUES (
  ${q(d.id)}, 'act_work', ${q(d.number)}, ${q(d.date)},
  ${q(`Акт работ ${d.number} — ${d.objectKey}`)},
  ${q(APPETIT.id)}, ${q(DEAL.id)}, 'signed',
  ${q(docxKey)}, ${q(REGINA)}, NOW(), NOW()
);`);
}
sql.push('');

// 7. Также 4 документа-ДС (привязка к storage не нужна — оригиналы лежат в DTUdocs)
sql.push('-- 7. 4 ДС как документы (без файла в storage — это записи об ДС)');
for (let i = 0; i < ADDENDUMS.length; i++) {
  const a = ADDENDUMS[i];
  const number = `ДС-2026-${String(i + 1).padStart(3, '0')}`;
  sql.push(`INSERT INTO documents (id, type, number, date, title, client_id, deal_id, status, created_by_id, created_at, updated_at) VALUES (
  ${q(randomUUID())}, 'addendum', ${q(number)}, ${q(a.date)},
  ${q(`Дополнительное соглашение №${a.number} ${number}`)},
  ${q(APPETIT.id)}, ${q(DEAL.id)}, 'signed',
  ${q(REGINA)}, NOW(), NOW()
);`);
}
sql.push('');

// 8. Counter документов — установить 7 для act_work и 4 для addendum
sql.push('-- 8. Установка counter\'ов нумерации документов');
sql.push(`INSERT INTO document_number_counters (year, type, last_number, updated_at) VALUES
  (2026, 'act_work', 7, NOW()),
  (2026, 'addendum', 4, NOW())
ON CONFLICT (year, type) DO UPDATE SET last_number = GREATEST(document_number_counters.last_number, EXCLUDED.last_number);`);
sql.push('');

sql.push('COMMIT;');
sql.push('');
sql.push('-- Verification:');
sql.push("SELECT 'clients' AS t, COUNT(*) FROM clients");
sql.push("UNION ALL SELECT 'objects', COUNT(*) FROM client_objects");
sql.push("UNION ALL SELECT 'deals', COUNT(*) FROM deals");
sql.push("UNION ALL SELECT 'price_items', COUNT(*) FROM deal_price_items");
sql.push("UNION ALL SELECT 'addendums', COUNT(*) FROM deal_addendums");
sql.push("UNION ALL SELECT 'documents', COUNT(*) FROM documents");
sql.push("UNION ALL SELECT 'leads', COUNT(*) FROM leads;");

console.log(sql.join('\n'));
