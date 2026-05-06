// Генератор SQL для заливки 10 тестовых клиентов на prod.
// Все записи помечаются маркером [TEST_SEED] в notes для последующего удаления.
//
// Использование:
//   node tools/seed-prod-test-clients.mjs > tmp/test-seed.sql
//   docker cp tmp/test-seed.sql deztech-crm-postgres:/tmp/seed.sql
//   docker exec -i deztech-crm-postgres psql -U deztech deztech_crm -f /tmp/seed.sql
//
// Удаление потом:
//   DELETE FROM clients WHERE notes LIKE '%[TEST_SEED]%';
// (deals, deal_price_items, deal_addendums, documents — каскадно через FK)

import { randomUUID } from 'crypto';

// ─── Реальные user IDs с prod ───────────────────────────────
const REGINA = '6377c48b-d37c-408f-8f81-fa8da2ac7764';
const ALEX = '533f9dd0-ab14-46be-a1e0-8ea2d387a3eb';

const TEST_MARKER = '[TEST_SEED]';
const NOW = new Date();
const today = NOW.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// ─── Контрольные суммы ───────────────────────────────────────
function inn10Check(s9) {
  const d = s9.split('').map(Number);
  const w = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  return (w.reduce((a, x, i) => a + x * d[i], 0) % 11) % 10;
}
function makeInn10(prefix9) {
  if (prefix9.length !== 9) throw new Error('inn10 prefix must be 9 digits');
  return prefix9 + inn10Check(prefix9);
}
function inn12Check(s10) {
  const d = s10.split('').map(Number);
  const w11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const c11 = (w11.reduce((a, x, i) => a + x * d[i], 0) % 11) % 10;
  const d11 = [...d, c11];
  const w12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const c12 = (w12.reduce((a, x, i) => a + x * d11[i], 0) % 11) % 10;
  return `${c11}${c12}`;
}
function makeInn12(prefix10) {
  if (prefix10.length !== 10) throw new Error('inn12 prefix must be 10 digits');
  return prefix10 + inn12Check(prefix10);
}
function makeOgrn(prefix12) {
  if (prefix12.length !== 12) throw new Error('ogrn prefix must be 12 digits');
  const head = BigInt(prefix12);
  const c = Number((head % 11n) % 10n);
  return prefix12 + c;
}
function makeOgrnip(prefix14) {
  if (prefix14.length !== 14) throw new Error('ogrnip prefix must be 14 digits');
  const head = BigInt(prefix14);
  const c = Number((head % 13n) % 10n);
  return prefix14 + c;
}

// SQL escaping
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => (o == null ? 'NULL' : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`);
const num = (n) => (n == null ? 'NULL' : String(n));

// ─── Данные клиентов ────────────────────────────────────────
// Каждый клиент: реквизиты + объекты + сделки + документы + work_logs
// Состояния расставлены так, чтобы канбан и список сделок были разнообразны.

const clients = [
  // 1. Активный договор, регулярные выезды (ВЕДЁТСЯ РАБОТА)
  {
    type: 'legal',
    shortName: 'ООО «Аппетит-Кубань»',
    fullName: 'Общество с ограниченной ответственностью «Аппетит-Кубань»',
    phone: '+7 (861) 200-15-25',
    email: 'office@appetit-kuban.ru',
    inn: makeInn10('231012345'),
    kpp: '231001001',
    ogrn: makeOgrn('122230100123'),
    legalAddress: '350000, г. Краснодар, ул. Красная, 100',
    postalAddress: '350000, г. Краснодар, ул. Красная, 100',
    directorName: 'Морозов Алексей Евгеньевич',
    directorRole: 'Генеральный директор',
    actingBasis: 'Устава',
    bankName: 'Краснодарское отделение №8619 ПАО Сбербанк',
    bankAccount: '40702810030000123456',
    bankBik: '040349602',
    bankCorrAccount: '30101810100000000602',
    source: 'website',
    status: 'active',
    objects: [
      { name: 'Кухня ресторана «Аппетит»', address: 'г. Краснодар, ул. Красная, 100', areaM2: 180, objectType: 'кухня', contactPerson: 'Сергей (шеф-повар)', contactPhone: '+7 (918) 555-10-10' },
      { name: 'Склад ресторана', address: 'г. Краснодар, ул. Красная, 100, подвал', areaM2: 95, objectType: 'склад' },
    ],
    deals: [
      {
        date: daysAgo(45),
        startDate: daysAgo(45),
        endDate: daysAgo(45 - 365),
        status: 'active',
        masterId: ALEX,
        priceItems: [
          { customName: 'Дезинсекция (тараканы) — кухня', areaM2: 180, method: 'Точечное орошение', frequency: 'Ежемесячно', priceNoVat: 8500, vat: 5 },
          { customName: 'Дератизация — склад', areaM2: 95, method: 'Контейнерные ловушки', frequency: 'Ежемесячно', priceNoVat: 4500, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-100', daysAgoVal: 45, status: 'signed' },
          { type: 'act_work', number: 'АР-2026-100', daysAgoVal: 14, status: 'sent' },
          { type: 'act_work', number: 'АР-2026-101', daysAgoVal: 42, status: 'signed' },
        ],
        workLogs: [
          { description: 'Плановая обработка кухни (туман). Гель в зонах оборудования. Жалоб нет.', daysAgoVal: 7, areaM2: 180 },
          { description: 'Обновление приманочных контейнеров на складе. Активность мышей не зафиксирована.', daysAgoVal: 7, areaM2: 95 },
          { description: 'Плановая обработка кухни. Найдена единичная активность тараканов в зоне посудомойки — усилена обработка.', daysAgoVal: 35, areaM2: 180 },
          { description: 'Обход контейнеров. Заменена приманка в 3 точках.', daysAgoVal: 35, areaM2: 95 },
          { description: 'Первичная сдача объекта в обслуживание. Полный цикл туманом.', daysAgoVal: 44, areaM2: 275 },
        ],
      },
    ],
  },

  // 2. Активный договор + ДС добавлено (доп. услуги)
  {
    type: 'legal',
    shortName: 'ООО «Магнит-Юг»',
    fullName: 'Общество с ограниченной ответственностью «Магнит-Юг»',
    phone: '+7 (988) 333-22-11',
    email: 'admin@magnit-yug.ru',
    inn: makeInn10('230899887'),
    kpp: '230801001',
    ogrn: makeOgrn('122230800145'),
    legalAddress: '354000, г. Сочи, ул. Северная, 50',
    directorName: 'Петрова Светлана Викторовна',
    directorRole: 'Директор',
    actingBasis: 'Устава',
    bankName: 'Краснодарское отделение №8619 ПАО Сбербанк',
    bankAccount: '40702810030000234567',
    bankBik: '040349602',
    bankCorrAccount: '30101810100000000602',
    source: 'referral',
    status: 'active',
    objects: [
      { name: 'Магазин «Магнит-Юг» №1', address: 'г. Сочи, ул. Северная, 50', areaM2: 320, objectType: 'магазин' },
      { name: 'Склад магазина', address: 'г. Сочи, ул. Северная, 50, корп.2', areaM2: 140, objectType: 'склад' },
    ],
    deals: [
      {
        date: daysAgo(60),
        startDate: daysAgo(60),
        endDate: daysAgo(60 - 365),
        status: 'active',
        masterId: ALEX,
        priceItems: [
          { customName: 'Дезинсекция торгового зала', areaM2: 320, method: 'Сухая', frequency: 'Раз в 2 месяца', priceNoVat: 9500, vat: 5 },
          { customName: 'Дератизация склада', areaM2: 140, method: 'Ловушки', frequency: 'Ежемесячно', priceNoVat: 5200, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-095', daysAgoVal: 60, status: 'signed' },
          { type: 'addendum', number: 'ДС-2026-010', daysAgoVal: 12, status: 'sent', forAddendum: { number: 1, description: 'Добавлен новый объект: подсобное помещение 30 м². Тариф +1500 руб./мес.' } },
          { type: 'act_work', number: 'АР-2026-095', daysAgoVal: 28, status: 'signed' },
        ],
        addendums: [
          { number: 1, daysAgoVal: 12, description: 'Подключён подсобный склад магазина (30 м²). Дополнительно к основному графику обработки.' },
        ],
        workLogs: [
          { description: 'Обработка торгового зала после закрытия. Использован феромонный туман.', daysAgoVal: 14, areaM2: 320 },
          { description: 'Профилактика склада. Заменены 5 ловушек.', daysAgoVal: 28, areaM2: 140 },
        ],
      },
    ],
  },

  // 3. ИП — договор подписан вчера, ждёт первого выезда
  {
    type: 'legal',
    shortName: 'ИП Сергеев А.А.',
    fullName: 'Индивидуальный предприниматель Сергеев Алексей Андреевич',
    phone: '+7 (918) 555-12-34',
    email: 'sergeev.bakery@yandex.ru',
    inn: makeInn12('2310123456'),
    ogrn: makeOgrnip('32223770010012'),
    legalAddress: 'г. Краснодар, ул. Ставропольская, 156',
    postalAddress: 'г. Краснодар, ул. Ставропольская, 156',
    directorName: 'Сергеев Алексей Андреевич',
    directorRole: 'Индивидуальный предприниматель',
    actingBasis: 'свидетельства о регистрации ИП',
    bankName: 'Филиал Банка ВТБ (ПАО) в г.Краснодаре',
    bankAccount: '40802810400123456789',
    bankBik: '040349700',
    bankCorrAccount: '30101810700000000777',
    source: 'website',
    status: 'active',
    objects: [
      { name: 'Пекарня «Хлебный двор»', address: 'г. Краснодар, ул. Ставропольская, 156', areaM2: 75, objectType: 'пекарня', contactPerson: 'Алексей', contactPhone: '+7 (918) 555-12-34' },
    ],
    deals: [
      {
        date: daysAgo(1),
        startDate: today,
        endDate: daysAgo(1 - 365),
        status: 'signed',
        masterId: ALEX,
        priceItems: [
          { customName: 'Комплекс: дезинсекция + дератизация пекарни', areaM2: 75, method: 'Туман + ловушки', frequency: 'Ежемесячно', priceNoVat: 6500, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-105', daysAgoVal: 1, status: 'signed' },
          { type: 'commercial_offer', number: 'КП-2026-085', daysAgoVal: 8, status: 'sent' },
        ],
      },
    ],
  },

  // 4. Завершённый проект — отель к высокому сезону
  {
    type: 'legal',
    shortName: 'ООО «Гостиница Юг»',
    fullName: 'Общество с ограниченной ответственностью «Гостиница Юг»',
    phone: '+7 (988) 666-66-66',
    email: 'reception@hotel-yug.ru',
    inn: makeInn10('231500012'),
    kpp: '231501001',
    ogrn: makeOgrn('123230150123'),
    legalAddress: '353460, г. Геленджик, ул. Морская, 1',
    directorName: 'Краснов Игорь Анатольевич',
    directorRole: 'Генеральный директор',
    actingBasis: 'Устава',
    bankName: 'Краснодарское отделение №8619 ПАО Сбербанк',
    bankAccount: '40702810030000345678',
    bankBik: '040349602',
    bankCorrAccount: '30101810100000000602',
    source: 'phone',
    status: 'inactive',
    objects: [
      { name: 'Гостиница «Юг» — корпус А', address: 'г. Геленджик, ул. Морская, 1', areaM2: 850, objectType: 'отель' },
      { name: 'Гостиница «Юг» — ресторан', address: 'г. Геленджик, ул. Морская, 1, 1 этаж', areaM2: 220, objectType: 'ресторан' },
    ],
    deals: [
      {
        date: daysAgo(95),
        startDate: daysAgo(95),
        endDate: daysAgo(20),
        status: 'completed',
        masterId: ALEX,
        priceItems: [
          { customName: 'Полная дезинсекция перед открытием сезона', areaM2: 850, method: 'Холодный туман', frequency: 'Разово', priceNoVat: 45000, vat: 5 },
          { customName: 'Дезинфекция ресторана', areaM2: 220, method: 'Сухая обработка', frequency: 'Разово', priceNoVat: 18000, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-080', daysAgoVal: 95, status: 'signed' },
          { type: 'act_inspection', number: 'АО-2026-040', daysAgoVal: 90, status: 'signed' },
          { type: 'act_work', number: 'АР-2026-085', daysAgoVal: 25, status: 'signed' },
          { type: 'invoice', number: 'СЧ-2026-080', daysAgoVal: 25, status: 'sent' },
        ],
        workLogs: [
          { description: 'Финальная сдача объекта. Сезон закрыт, объект чистый.', daysAgoVal: 22, areaM2: 1070 },
          { description: 'Промежуточный контроль. Замечаний нет.', daysAgoVal: 50, areaM2: 1070 },
          { description: 'Первичная обработка перед открытием сезона. Туман по всем номерам.', daysAgoVal: 90, areaM2: 1070 },
        ],
      },
    ],
  },

  // 5. Черновик-сделка с прайсом (ждёт подписания)
  {
    type: 'legal',
    shortName: 'ООО «Свежесть»',
    fullName: 'Общество с ограниченной ответственностью «Свежесть»',
    phone: '+7 (999) 222-22-22',
    email: 'office@svezhest-anapa.ru',
    inn: makeInn10('232011122'),
    kpp: '232001001',
    ogrn: makeOgrn('122232000156'),
    legalAddress: '353440, г. Анапа, ул. Пушкина, 5',
    directorName: 'Никитина Анна Михайловна',
    directorRole: 'Директор',
    actingBasis: 'Устава',
    source: 'website',
    status: 'lead',
    objects: [
      { name: 'Магазин «Свежесть»', address: 'г. Анапа, ул. Пушкина, 5', areaM2: 110, objectType: 'магазин' },
    ],
    deals: [
      {
        date: today,
        status: 'draft',
        priceItems: [
          { customName: 'Дезинсекция магазина (тараканы)', areaM2: 110, method: 'Туман', frequency: 'Ежемесячно', priceNoVat: 5500, vat: 5 },
        ],
        documents: [],
      },
    ],
  },

  // 6. Кафе — активный + ДС
  {
    type: 'legal',
    shortName: 'ИП Бризов И.С. (кафе «Морской бриз»)',
    fullName: 'Индивидуальный предприниматель Бризов Игорь Сергеевич',
    phone: '+7 (988) 700-12-13',
    email: 'briz.cafe@mail.ru',
    inn: makeInn12('2304055789'),
    ogrn: makeOgrnip('32223770010025'),
    legalAddress: '353900, г. Новороссийск, ул. Советов, 22',
    directorName: 'Бризов Игорь Сергеевич',
    directorRole: 'Индивидуальный предприниматель',
    actingBasis: 'свидетельства о регистрации ИП',
    bankName: 'АО «Тинькофф Банк»',
    bankAccount: '40802810500001234567',
    bankBik: '044525974',
    bankCorrAccount: '30101810145250000974',
    source: 'referral',
    status: 'active',
    objects: [
      { name: 'Кафе «Морской бриз»', address: 'г. Новороссийск, ул. Советов, 22', areaM2: 95, objectType: 'кафе' },
    ],
    deals: [
      {
        date: daysAgo(30),
        startDate: daysAgo(30),
        endDate: daysAgo(30 - 180),
        status: 'active',
        masterId: ALEX,
        priceItems: [
          { customName: 'Дезинсекция кухни и зала', areaM2: 95, method: 'Точечное', frequency: 'Раз в 2 месяца', priceNoVat: 5800, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-090', daysAgoVal: 30, status: 'signed' },
          { type: 'addendum', number: 'ДС-2026-008', daysAgoVal: 5, status: 'generated' },
        ],
        addendums: [
          { number: 1, daysAgoVal: 5, description: 'Добавлена услуга дезодорации после ремонта (разово). Стоимость 3500 руб.' },
        ],
        workLogs: [
          { description: 'Плановая обработка после закрытия. Чисто.', daysAgoVal: 14, areaM2: 95 },
        ],
      },
    ],
  },

  // 7. Физлицо — счёт сгенерирован
  {
    type: 'individual',
    shortName: 'Иванов Иван Иванович',
    fullName: 'Иванов Иван Иванович',
    phone: '+7 (918) 111-22-33',
    email: 'ivanov.kuban@gmail.com',
    legalAddress: 'г. Краснодар, ул. Тургенева, 144, кв. 56',
    source: 'website',
    status: 'active',
    objects: [
      { name: 'Квартира', address: 'г. Краснодар, ул. Тургенева, 144, кв. 56', areaM2: 65, objectType: 'квартира' },
    ],
    deals: [
      {
        date: daysAgo(3),
        status: 'active',
        priceItems: [
          { customName: 'Разовая дезинсекция (клопы)', areaM2: 65, method: 'Туман + орошение', frequency: 'Разово', priceNoVat: 4500, vat: 5 },
        ],
        documents: [
          { type: 'invoice', number: 'СЧ-2026-110', daysAgoVal: 3, status: 'sent' },
        ],
      },
    ],
  },

  // 8. Только лид (без клиента) — на канбане в "связались"
  // Этот клиент создаётся БЕЗ deals и почти без полей — это лид-черновик
  {
    type: 'legal',
    shortName: 'ООО «Тропик-Юг»',
    fullName: 'Общество с ограниченной ответственностью «Тропик-Юг»',
    phone: '+7 (988) 800-80-80',
    email: 'reception@tropik-yug.ru',
    legalAddress: 'г. Сочи, ул. Курортный проспект, 105',
    source: 'phone',
    status: 'lead',
    objects: [],
    deals: [],
  },

  // 9. Расторгнутый договор
  {
    type: 'legal',
    shortName: 'ИП Кузнецов В.В. (кафе «Армавир»)',
    fullName: 'Индивидуальный предприниматель Кузнецов Виктор Васильевич',
    phone: '+7 (918) 444-55-66',
    email: 'kuznetsov.cafe@gmail.com',
    inn: makeInn12('2309087654'),
    ogrn: makeOgrnip('32023770010038'),
    legalAddress: '352900, г. Армавир, ул. Кирова, 88',
    directorName: 'Кузнецов Виктор Васильевич',
    directorRole: 'Индивидуальный предприниматель',
    actingBasis: 'свидетельства о регистрации ИП',
    source: 'website',
    status: 'inactive',
    objects: [
      { name: 'Кафе «Армавир»', address: 'г. Армавир, ул. Кирова, 88', areaM2: 70, objectType: 'кафе' },
    ],
    deals: [
      {
        date: daysAgo(150),
        startDate: daysAgo(150),
        endDate: daysAgo(60),
        status: 'terminated',
        priceItems: [
          { customName: 'Дезинсекция кафе', areaM2: 70, method: 'Сухая', frequency: 'Раз в 2 месяца', priceNoVat: 4200, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-070', daysAgoVal: 150, status: 'archived' },
        ],
      },
    ],
  },

  // 10. Складской комплекс — большой объект, активный
  {
    type: 'legal',
    shortName: 'ООО «Складской Комплекс Краснодар»',
    fullName: 'Общество с ограниченной ответственностью «Складской Комплекс Краснодар»',
    phone: '+7 (861) 999-99-99',
    email: 'main@sklad-krd.ru',
    inn: makeInn10('231019876'),
    kpp: '231001002',
    ogrn: makeOgrn('120230100200'),
    legalAddress: '350000, г. Краснодар, Тихорецкая, 5',
    directorName: 'Громов Дмитрий Александрович',
    directorRole: 'Генеральный директор',
    actingBasis: 'Устава',
    bankName: 'Филиал «Корпоративный» ПАО «Совкомбанк»',
    bankAccount: '40702810500987654321',
    bankBik: '044525976',
    bankCorrAccount: '30101810445250000976',
    source: 'recurring',
    status: 'active',
    objects: [
      { name: 'Складской ангар №1', address: 'г. Краснодар, Тихорецкая, 5, ангар 1', areaM2: 1200, objectType: 'склад' },
      { name: 'Складской ангар №2', address: 'г. Краснодар, Тихорецкая, 5, ангар 2', areaM2: 1200, objectType: 'склад' },
      { name: 'Офисное здание', address: 'г. Краснодар, Тихорецкая, 5, корп. адм.', areaM2: 380, objectType: 'офис' },
    ],
    deals: [
      {
        date: daysAgo(20),
        startDate: daysAgo(20),
        endDate: daysAgo(20 - 365),
        status: 'active',
        masterId: ALEX,
        priceItems: [
          { customName: 'Дератизация ангаров (контейнерные ловушки)', areaM2: 2400, method: 'Контейнеры', frequency: 'Ежемесячно', priceNoVat: 18500, vat: 5 },
          { customName: 'Дезинсекция офисов', areaM2: 380, method: 'Сухая', frequency: 'Ежеквартально', priceNoVat: 9000, vat: 5 },
          { customName: 'Дезодорация подсобных помещений', areaM2: 380, method: 'Озонирование', frequency: 'Ежеквартально', priceNoVat: 4500, vat: 5 },
        ],
        documents: [
          { type: 'contract', number: 'ДГ-2026-098', daysAgoVal: 20, status: 'signed' },
          { type: 'act_inspection', number: 'АО-2026-045', daysAgoVal: 22, status: 'signed' },
        ],
        workLogs: [
          { description: 'Установка контейнерных ловушек по периметру обоих ангаров. 24 точки.', daysAgoVal: 18, areaM2: 2400 },
          { description: 'Первичная дезинсекция офисов после установки ловушек на складах.', daysAgoVal: 17, areaM2: 380 },
          { description: 'Контрольный обход ловушек. Замены не потребовалось, активность низкая.', daysAgoVal: 3, areaM2: 2400 },
        ],
      },
    ],
  },
];

// ─── Дополнительные «голые» лиды (без клиентов) для канбана ────
const standaloneLeads = [
  {
    contactName: 'Светлана Морозова',
    contactPhone: '+7 (988) 100-12-12',
    contactEmail: 'svetlana.m@example.com',
    requestedAddress: 'г. Краснодар, ул. Северная, 320 (ресторан)',
    serviceTypes: ['disinsection'],
    areaM2Estimate: 200,
    message: 'Нужна срочная обработка от тараканов в ресторане. Когда можно начать?',
    source: 'website',
    channel: 'site_form',
    status: 'new',
    daysAgoVal: 1,
  },
  {
    contactName: 'Олег Васильевич (детский сад №14)',
    contactPhone: '+7 (918) 222-22-22',
    contactEmail: 'sad14@krd.edu',
    requestedAddress: 'г. Краснодар, мкр. Гидростроителей, 19',
    serviceTypes: ['disinsection', 'disinfection'],
    areaM2Estimate: 450,
    message: 'Нужна обработка детского сада перед открытием смены. По СанПин.',
    source: 'phone',
    channel: 'phone_call',
    status: 'new',
    daysAgoVal: 2,
  },
  {
    contactName: 'ТЦ «Галактика»',
    contactPhone: '+7 (861) 333-44-55',
    contactEmail: 'admin@tc-galaktika.ru',
    requestedAddress: 'г. Краснодар, ул. 40 лет Победы, 2',
    serviceTypes: ['deratization'],
    areaM2Estimate: 800,
    message: 'Замечена активность грызунов в подвальных помещениях. Нужна консультация и КП.',
    source: 'website',
    channel: 'site_form',
    status: 'contacted',
    daysAgoVal: 4,
  },
];

// ─── Генерация SQL ──────────────────────────────────────────
const sql = [];
sql.push('-- Test seed: 10 clients in various stages + 3 standalone leads');
sql.push(`-- Generated: ${NOW.toISOString()}`);
sql.push(`-- Marker: ${TEST_MARKER}`);
sql.push('-- To remove: DELETE FROM clients WHERE notes LIKE \'%[TEST_SEED]%\';');
sql.push('--           DELETE FROM leads WHERE message LIKE \'%[TEST_SEED]%\';');
sql.push('BEGIN;');
sql.push('');

for (const c of clients) {
  const clientId = randomUUID();
  const notes = `${TEST_MARKER} ${c.notes ?? ''}`.trim();

  sql.push(`-- ${c.shortName}`);
  sql.push(`INSERT INTO clients (id, type, short_name, full_name, phone, email, inn, kpp, ogrn, legal_address, postal_address, director_name, director_role, acting_basis, bank_name, bank_account, bank_bik, bank_corr_account, source, status, notes, created_by_id, assigned_manager_id, created_at, updated_at) VALUES (
    ${q(clientId)}, ${q(c.type)}, ${q(c.shortName)}, ${q(c.fullName)}, ${q(c.phone)}, ${q(c.email)},
    ${q(c.inn)}, ${q(c.kpp)}, ${q(c.ogrn)},
    ${q(c.legalAddress)}, ${q(c.postalAddress ?? c.legalAddress)},
    ${q(c.directorName)}, ${q(c.directorRole)}, ${q(c.actingBasis)},
    ${q(c.bankName)}, ${q(c.bankAccount)}, ${q(c.bankBik)}, ${q(c.bankCorrAccount)},
    ${q(c.source)}, ${q(c.status)}, ${q(notes)},
    ${q(REGINA)}, ${q(REGINA)}, NOW(), NOW()
  );`);

  for (const o of c.objects ?? []) {
    sql.push(`INSERT INTO client_objects (id, client_id, name, address, area_m2, object_type, contact_person, contact_phone, created_at, updated_at) VALUES (
      ${q(randomUUID())}, ${q(clientId)}, ${q(o.name)}, ${q(o.address)}, ${num(o.areaM2)}, ${q(o.objectType)},
      ${q(o.contactPerson)}, ${q(o.contactPhone)}, NOW(), NOW()
    );`);
  }

  for (const d of c.deals ?? []) {
    const dealId = randomUUID();
    const dd = d.date.slice(8, 10);
    const mm = d.date.slice(5, 7);
    const yy = d.date.slice(2, 4);
    const contractNumber = `ДТЮ-${dd}/${mm}/${yy}-${Math.floor(Math.random() * 90 + 10)}`;
    const totalNet = (d.priceItems ?? []).reduce((s, p) => s + p.priceNoVat, 0);
    const totalGross = (d.priceItems ?? []).reduce((s, p) => s + p.priceNoVat * (1 + p.vat / 100), 0);

    sql.push(`INSERT INTO deals (id, contract_number, contract_date, contract_place, client_id, start_date, end_date, status, signatory_executor, signatory_client, total_amount, currency, assigned_manager_id, assigned_master_id, created_by_id, created_at, updated_at) VALUES (
      ${q(dealId)}, ${q(contractNumber)}, ${q(d.date)}, ${q('г. Новороссийск')},
      ${q(clientId)}, ${q(d.startDate)}, ${q(d.endDate)},
      ${q(d.status)}, ${q('ИП Белавина Ольга Владимировна')}, ${q(c.directorRole && c.directorName ? `${c.directorRole} ${c.directorName}` : null)},
      ${num(totalGross.toFixed(2))}, ${q('RUB')},
      ${q(REGINA)}, ${q(d.masterId ?? null)}, ${q(REGINA)},
      NOW(), NOW()
    );`);

    let sortOrder = 0;
    for (const p of d.priceItems ?? []) {
      const priceWithVat = (p.priceNoVat * (1 + p.vat / 100)).toFixed(2);
      sql.push(`INSERT INTO deal_price_items (id, deal_id, custom_name, area_m2, method, frequency, price_no_vat, price_with_vat, vat_rate, sort_order, created_at, updated_at) VALUES (
        ${q(randomUUID())}, ${q(dealId)}, ${q(p.customName)},
        ${num(p.areaM2)}, ${q(p.method)}, ${q(p.frequency)},
        ${num(p.priceNoVat.toFixed(2))}, ${num(priceWithVat)}, ${num(p.vat.toFixed(2))},
        ${num(sortOrder++)}, NOW(), NOW()
      );`);
    }

    for (const a of d.addendums ?? []) {
      sql.push(`INSERT INTO deal_addendums (id, deal_id, number, date, description, status, created_by_id, created_at, updated_at) VALUES (
        ${q(randomUUID())}, ${q(dealId)}, ${num(a.number)}, ${q(daysAgo(a.daysAgoVal))},
        ${q(a.description)}, ${q('signed')}, ${q(REGINA)}, NOW(), NOW()
      );`);
    }

    for (const doc of d.documents ?? []) {
      sql.push(`INSERT INTO documents (id, type, number, date, title, client_id, deal_id, status, created_by_id, created_at, updated_at) VALUES (
        ${q(randomUUID())}, ${q(doc.type)}, ${q(doc.number)}, ${q(daysAgo(doc.daysAgoVal))},
        ${q(`${typeLabel(doc.type)} ${doc.number}`)},
        ${q(clientId)}, ${q(dealId)}, ${q(doc.status)},
        ${q(REGINA)}, NOW(), NOW()
      );`);
    }

    for (const w of d.workLogs ?? []) {
      sql.push(`INSERT INTO deal_work_logs (id, deal_id, master_id, performed_at, description, area_m2, created_at) VALUES (
        ${q(randomUUID())}, ${q(dealId)}, ${q(d.masterId ?? ALEX)}, ${q(daysAgo(w.daysAgoVal))}::timestamptz,
        ${q(w.description)}, ${num(w.areaM2)}, NOW()
      );`);
    }
  }
  sql.push('');
}

// Standalone leads
sql.push('-- Standalone leads (без клиентов) для канбана');
for (const l of standaloneLeads) {
  sql.push(`INSERT INTO leads (id, source, channel, contact_name, contact_phone, contact_email, requested_address, service_types, area_m2_estimate, message, status, assigned_manager_id, created_at, updated_at) VALUES (
    ${q(randomUUID())}, ${q(l.source)}, ${q(l.channel)},
    ${q(l.contactName)}, ${q(l.contactPhone)}, ${q(l.contactEmail)},
    ${q(l.requestedAddress)}, ${j(l.serviceTypes)}, ${num(l.areaM2Estimate)},
    ${q(`${TEST_MARKER} ${l.message}`)}, ${q(l.status)},
    ${q(REGINA)}, NOW() - INTERVAL '${l.daysAgoVal} days', NOW() - INTERVAL '${l.daysAgoVal} days'
  );`);
}

sql.push('');
sql.push('COMMIT;');
sql.push('');
sql.push('-- Verification:');
sql.push("SELECT 'clients' AS t, COUNT(*) FROM clients WHERE notes LIKE '%[TEST_SEED]%'");
sql.push("UNION ALL SELECT 'leads', COUNT(*) FROM leads WHERE message LIKE '%[TEST_SEED]%'");
sql.push("UNION ALL SELECT 'deals', COUNT(*) FROM deals WHERE client_id IN (SELECT id FROM clients WHERE notes LIKE '%[TEST_SEED]%')");
sql.push("UNION ALL SELECT 'price_items', COUNT(*) FROM deal_price_items WHERE deal_id IN (SELECT id FROM deals WHERE client_id IN (SELECT id FROM clients WHERE notes LIKE '%[TEST_SEED]%'))");
sql.push("UNION ALL SELECT 'documents', COUNT(*) FROM documents WHERE client_id IN (SELECT id FROM clients WHERE notes LIKE '%[TEST_SEED]%')");
sql.push("UNION ALL SELECT 'work_logs', COUNT(*) FROM deal_work_logs WHERE deal_id IN (SELECT id FROM deals WHERE client_id IN (SELECT id FROM clients WHERE notes LIKE '%[TEST_SEED]%'));");

function typeLabel(type) {
  return ({
    contract: 'Договор',
    addendum: 'Доп. соглашение',
    act_work: 'Акт работ',
    act_inspection: 'Акт обследования',
    invoice: 'Счёт',
    commercial_offer: 'Коммерческое предложение',
    other: 'Документ',
  })[type] ?? 'Документ';
}

console.log(sql.join('\n'));
