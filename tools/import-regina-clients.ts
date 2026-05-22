/**
 * Импорт реальных клиентов Регины из tmp/regina-clients.json в БД.
 *
 * Использование (локально):
 *   npx tsx tools/import-regina-clients.ts                        # импорт без чистки (опасно — задвоит)
 *   npx tsx tools/import-regina-clients.ts --reset                # снести ВСЁ из clients и залить заново
 *   npx tsx tools/import-regina-clients.ts --reset --with-test    # + создать тестового менеджера и 5 [TEST_MASTER] клиентов
 *
 * Использование (на prod через docker):
 *   DATABASE_URL=postgres://deztech:...@deztech-crm-postgres:5432/deztech_crm \
 *     docker compose -f docker-compose.prod.yml run --rm app npx tsx tools/import-regina-clients.ts --reset --with-test
 *
 * Что делает с --reset:
 *   1. Snapshot текущего prod-состояния (выведет N клиентов)
 *   2. Удаляет всех clients (cascade: deals, work_logs, checklists, objects, documents)
 *   3. Создаёт тестового менеджера (--with-test): test-manager@deztexug.ru / welcome123
 *   4. Импортирует все 33 клиента Регины с реквизитами, объектами, сделками (active), прайс-позициями
 *   5. С --with-test создаёт 5 тестовых клиентов (как в seed-master-test-data) под тестером
 *   6. Печатает summary
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { eq, sql, like, inArray } from 'drizzle-orm';
import { db, pool } from '../lib/db/index';
import { users } from '../lib/db/schema/users';
import { services } from '../lib/db/schema/services';
import { clients } from '../lib/db/schema/clients';
import { clientObjects } from '../lib/db/schema/objects';
import { deals, dealPriceItems, dealWorkLogs, dealAddendums } from '../lib/db/schema/deals';
import { serviceChecklists, dealChecklistItems } from '../lib/db/schema/checklists';

const RESET = process.argv.includes('--reset');
const WITH_TEST = process.argv.includes('--with-test');
// --only-new: импортировать только клиентов, чьего ИНН ещё нет в БД.
// Не делает reset, не трогает существующих (и правки Регины). Для дозаливки.
const ONLY_NEW = process.argv.includes('--only-new');
const DRY = process.argv.includes('--dry-run');

const MANAGER_EMAIL = 'deztexug@yandex.ru'; // Регина
const TEST_MANAGER_EMAIL = 'test-manager@deztexug.ru'; // Александр (тестер)
const TEST_MANAGER_NAME = 'Александр';
const MASTER_EMAIL = 'nrgy131@gmail.com';
const TEMP_PASSWORD = 'welcome123';
const BCRYPT_ROUNDS = 10;

const JSON_PATH = path.join(__dirname, '..', 'tmp', 'regina-clients.json');
const TEST_MARKER = '[TEST_MASTER]';

type ParsedClient = {
  type: 'legal' | 'individual';
  short_name: string;
  full_name?: string | null;
  org_type?: string;
  inn: string;
  kpp?: string | null;
  ogrn?: string | null;
  ogrnip?: string | null;
  legal_address?: string | null;
  actual_address?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_bik?: string | null;
  bank_corr_account?: string | null;
  phone?: string | null;
  email?: string | null;
};
type ParsedContract = {
  number: string | null;
  date: string | null;
  place: string | null;
  director_name: string | null;
  director_role: string | null;
  acting_basis: string | null;
};
type ParsedObject = { name: string; address: string | null; source?: string };
type ParsedPriceItem = {
  service_name: string;
  service_code: string | null;
  object_name: string | null;
  area_m2: number | null;
  area_label: string | null;
  price_no_vat: number | null;
  frequency: string | null;
};
type ParsedAddendum = {
  filename: string;
  contract: ParsedContract;
  price_items: ParsedPriceItem[];
  objects: ParsedObject[];
};
type ClientGroup = {
  client: ParsedClient;
  contracts: Array<{ filename: string; contract: ParsedContract }>;
  addendums: ParsedAddendum[];
  all_objects: ParsedObject[];
  all_price_items: ParsedPriceItem[];
};

function loadJson(): Record<string, ClientGroup> {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Не найден ${JSON_PATH}. Сначала: python3 tools/parse-regina-contracts.py`);
  }
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
}

async function ensureUser(email: string, fullName: string, role: 'manager' | 'master' | 'admin') {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`  ✓ user ${email} (${role}) — уже есть`);
    return existing;
  }
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, BCRYPT_ROUNDS);
  const [u] = await db
    .insert(users)
    .values({ email, fullName, role, isActive: true, passwordMustChange: true, passwordHash })
    .returning();
  console.log(`  ✓ user ${email} (${role}) — создан, пароль ${TEMP_PASSWORD}`);
  return u;
}

async function nukeClients() {
  // ВСЕ clients → cascade удалит deals/objects/work_logs/etc.
  // Но FK deals.client_id = RESTRICT → сначала deals явно.
  const counts = {
    clients: (await db.select({ c: sql<number>`count(*)::int` }).from(clients))[0].c,
    deals: (await db.select({ c: sql<number>`count(*)::int` }).from(deals))[0].c,
    work_logs: (await db.select({ c: sql<number>`count(*)::int` }).from(dealWorkLogs))[0].c,
  };
  console.log(`  Pre-reset: clients=${counts.clients}, deals=${counts.deals}, work_logs=${counts.work_logs}`);
  if (DRY) {
    console.log('  (dry-run, не удаляю)');
    return;
  }
  await db.delete(deals);
  await db.delete(clients);
  console.log(`  ✓ Удалено (cascade): clients + deals + price_items + work_logs + objects + checklist_items`);
}

function serviceCodeForName(name: string): string | null {
  const lower = name.toLowerCase();
  if (/дезинсекц|москит|комар|клещ|муравь/.test(lower)) return 'disinsection';
  if (/дератизац|пест[- ]контрол|грызун/.test(lower)) return 'deratization';
  if (/дезинфекц/.test(lower)) return 'disinfection';
  if (/фумигац/.test(lower)) return 'fumigation';
  if (/дезодорац|озонировани/.test(lower)) return 'deodorization';
  if (/десерпентац|зме/.test(lower)) return 'deserpentation';
  if (/гербицид|растительност/.test(lower)) return 'herbicide-treatment';
  if (/анализ\s+воды/.test(lower)) return 'water-analysis';
  return null;
}

async function importReginaClient(
  inn: string,
  group: ClientGroup,
  managerId: string,
  servicesByCode: Map<string, string>,
) {
  const c = group.client;
  // Объединённый адрес
  const legal = c.legal_address || c.actual_address || '';

  // Создаём клиента
  const [created] = await db
    .insert(clients)
    .values({
      type: 'legal',
      shortName: c.short_name,
      fullName: c.full_name ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      inn: c.inn,
      kpp: c.kpp ?? null,
      ogrn: c.ogrn ?? null,
      // схема не имеет ogrnip отдельно — кладём в ogrn если ogrn пуст, иначе в extra_data
      legalAddress: legal || null,
      postalAddress: c.actual_address ?? null,
      bankName: c.bank_name ?? null,
      bankAccount: c.bank_account ?? null,
      bankBik: c.bank_bik ?? null,
      bankCorrAccount: c.bank_corr_account ?? null,
      source: 'manager',
      status: 'active',
      notes: null,
      assignedManagerId: managerId,
      createdById: managerId,
      extraData: c.ogrnip ? { ogrnip: c.ogrnip } : null,
    })
    .returning();

  // Объекты
  const createdObjects: Record<string, string> = {}; // name → id
  for (const o of group.all_objects) {
    const [obj] = await db
      .insert(clientObjects)
      .values({
        clientId: created.id,
        name: o.name?.slice(0, 250) || 'Объект',
        address: o.address || legal || '—',
        areaM2: null,
      })
      .returning({ id: clientObjects.id, name: clientObjects.name });
    createdObjects[obj.name] = obj.id;
  }

  // Один объединённый «главный объект» — для тех price_items где не найдено совпадение
  let defaultObjectId: string | undefined = Object.values(createdObjects)[0];

  // Основная сделка (из первого контракта)
  const firstContract = group.contracts[0]?.contract;
  const contractNumber =
    firstContract?.number ||
    `ДТЮ-${new Date().getFullYear()}-${c.inn.slice(-4)}`;
  const contractDate = firstContract?.date || new Date().toISOString().slice(0, 10);

  // Сумма по прайсу (для total_amount)
  const totalNoVat = group.all_price_items.reduce(
    (s, p) => s + (p.price_no_vat || 0),
    0,
  );
  const totalWithVat = totalNoVat * 1.05;

  const [deal] = await db
    .insert(deals)
    .values({
      contractNumber,
      contractDate,
      contractPlace: firstContract?.place || 'г. Новороссийск',
      clientId: created.id,
      assignedManagerId: managerId,
      assignedMasterId: null, // мастер не назначен — Регина сама назначит
      startDate: contractDate,
      endDate: null,
      isAllDay: true,
      status: 'active',
      totalAmount: totalWithVat.toFixed(2),
      currency: 'RUB',
      signatoryExecutor: 'ИП Белавина Ольга Владимировна',
      signatoryClient:
        firstContract?.director_role && firstContract?.director_name
          ? `${firstContract.director_role} ${firstContract.director_name}`
          : null,
      notes: null,
      createdById: managerId,
    })
    .returning();

  // Прайс-позиции
  let sortOrder = 0;
  for (const p of group.all_price_items) {
    if (!p.price_no_vat) continue;
    const code = p.service_code || serviceCodeForName(p.service_name);
    const serviceId = code ? servicesByCode.get(code) : null;
    // Сматчить объект из прайса с одним из созданных
    let objectId: string | null = defaultObjectId ?? null;
    if (p.object_name) {
      const matched = Object.entries(createdObjects).find(
        ([name]) => name.toLowerCase().includes(p.object_name!.toLowerCase().slice(0, 20)),
      );
      if (matched) objectId = matched[1];
    }
    const areaM2 = p.area_m2 ?? 0;
    await db.insert(dealPriceItems).values({
      dealId: deal.id,
      objectId,
      serviceId: serviceId ?? null,
      customName: p.service_name,
      areaM2: Math.max(0, Math.round(areaM2)),
      method: null,
      frequency: p.frequency ?? null,
      priceNoVat: p.price_no_vat.toFixed(2),
      priceWithVat: (p.price_no_vat * 1.05).toFixed(2),
      vatRate: '5.00',
      sortOrder: sortOrder++,
    });
  }

  // Доп.соглашения (ДС)
  let addendumNum = 1;
  for (const a of group.addendums) {
    await db.insert(dealAddendums).values({
      dealId: deal.id,
      number: addendumNum++,
      date: a.contract?.date || contractDate,
      description: a.filename.replace('.docx', ''),
      bodyJson: { source_filename: a.filename, price_items: a.price_items },
      status: 'active',
      createdById: managerId,
    });
  }

  return {
    clientId: created.id,
    dealId: deal.id,
    objects: Object.keys(createdObjects).length,
    priceItems: group.all_price_items.filter((p) => p.price_no_vat).length,
    addendums: group.addendums.length,
  };
}

async function seedTestClientsForTester(testerId: string, masterId: string, servicesByCode: Map<string, string>) {
  /** Минимальные тестовые клиенты под тестера (5 шт) — копия из seed-master-test-data, упрощённая. */
  const scenarios = [
    { name: 'ООО «Кафе Морской»', address: 'г. Новороссийск, ул. Советов, 12', service: 'disinsection', price: 4500 },
    { name: 'ИП Магазин «У Дома»', address: 'г. Новороссийск, ул. Ленина, 88', service: 'deratization', price: 5200 },
    { name: 'ООО «Склад-Юг»', address: 'г. Краснодар, Тихорецкая, 5', service: 'disinfection', price: 12000 },
    { name: 'Иванов Иван Иванович', address: 'г. Новороссийск, ул. Энгельса, 27, кв. 14', service: 'disinsection', price: 3800, individual: true },
    { name: 'ООО «Свежий Лид»', address: 'г. Краснодар, ул. Красная, 1', service: 'disinsection', price: 3000, draft: true },
  ];
  let n = 0;
  for (const s of scenarios) {
    n++;
    const [client] = await db
      .insert(clients)
      .values({
        type: s.individual ? 'individual' : 'legal',
        shortName: s.name,
        fullName: s.name,
        phone: `+7 (988) 555-00-${String(n).padStart(2, '0')}`,
        email: `test-${n}@test.deztech.local`,
        source: 'manager',
        status: s.draft ? 'lead' : 'active',
        notes: `${TEST_MARKER} Тестовый клиент #${n} (под тестера)`,
        assignedManagerId: testerId,
        createdById: testerId,
        legalAddress: s.address,
      })
      .returning();
    const [obj] = await db
      .insert(clientObjects)
      .values({ clientId: client.id, name: 'Объект', address: s.address, areaM2: 100 })
      .returning();
    const [deal] = await db
      .insert(deals)
      .values({
        contractNumber: `ДТЮ-ТЕСТ-${20 + n}`,
        contractDate: new Date().toISOString().slice(0, 10),
        contractPlace: 'г. Новороссийск',
        clientId: client.id,
        assignedManagerId: testerId,
        assignedMasterId: s.draft ? null : masterId,
        startDate: new Date().toISOString().slice(0, 10),
        isAllDay: true,
        status: s.draft ? 'draft' : 'active',
        totalAmount: (s.price * 1.05).toFixed(2),
        currency: 'RUB',
        signatoryExecutor: 'ИП Белавина Ольга Владимировна',
        notes: `${TEST_MARKER} ${s.service}`,
        createdById: testerId,
      })
      .returning();
    await db.insert(dealPriceItems).values({
      dealId: deal.id,
      objectId: obj.id,
      serviceId: servicesByCode.get(s.service) || null,
      customName: `${s.service} (тест)`,
      areaM2: 100,
      priceNoVat: s.price.toFixed(2),
      priceWithVat: (s.price * 1.05).toFixed(2),
      vatRate: '5.00',
      sortOrder: 0,
    });
  }
  console.log(`  ✓ Создано ${scenarios.length} тестовых клиентов под тестера`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://deztech:dev_password_change_me@localhost:5432/deztech_crm';
  console.log(`📦 DB: ${dbUrl.replace(/:[^:]*@/, ':***@')}`);
  console.log(`Mode: reset=${RESET}, with-test=${WITH_TEST}, dry-run=${DRY}\n`);

  // 1. Users
  console.log('👤 Users:');
  const [regina] = await db.select().from(users).where(eq(users.email, MANAGER_EMAIL)).limit(1);
  if (!regina) throw new Error(`Manager ${MANAGER_EMAIL} not found. Run db:seed first.`);
  console.log(`  ✓ Регина: ${regina.id}`);

  let tester: typeof users.$inferSelect | undefined;
  if (WITH_TEST) {
    tester = await ensureUser(TEST_MANAGER_EMAIL, TEST_MANAGER_NAME, 'manager');
  }
  const [master] = await db.select().from(users).where(eq(users.email, MASTER_EMAIL)).limit(1);
  if (!master && WITH_TEST) {
    throw new Error(`Master ${MASTER_EMAIL} not found, нужен для тестовых данных.`);
  }

  // 2. Services map
  console.log('\n🧹 Services:');
  const allServices = await db.select().from(services);
  const servicesByCode = new Map(allServices.map((s) => [s.code, s.id]));
  console.log(`  ${servicesByCode.size} услуг в каталоге`);

  // 3. Reset
  if (RESET) {
    console.log('\n🗑  RESET:');
    await nukeClients();
  }

  if (DRY) {
    console.log('\n(dry-run, дальше не пойдём)');
    await pool.end();
    return;
  }

  // 4. Тестовые клиенты под тестера (если запрошено)
  if (WITH_TEST && tester) {
    console.log('\n🧪 Test clients для тестера:');
    await seedTestClientsForTester(tester.id, master!.id, servicesByCode);
  }

  // 5. Импорт Регины
  console.log('\n🏢 Импорт клиентов Регины:');
  const groups = loadJson();
  const inns = Object.keys(groups);
  console.log(`  Найдено ${inns.length} клиентов в JSON`);

  // --only-new: набор уже существующих ИНН, чтобы не задваивать и не трогать правки Регины
  const existingInns = new Set<string>();
  if (ONLY_NEW) {
    const rows = await db.select({ inn: clients.inn }).from(clients);
    for (const r of rows) if (r.inn) existingInns.add(r.inn);
    console.log(`  (--only-new) в БД уже ${existingInns.size} клиентов с ИНН — их пропустим`);
  }

  const stats = { clients: 0, objects: 0, priceItems: 0, addendums: 0, errors: 0, skipped: 0 };
  for (const inn of inns) {
    if (ONLY_NEW && existingInns.has(inn)) {
      stats.skipped++;
      continue;
    }
    try {
      const result = await importReginaClient(inn, groups[inn], regina.id, servicesByCode);
      stats.clients++;
      stats.objects += result.objects;
      stats.priceItems += result.priceItems;
      stats.addendums += result.addendums;
      console.log(`  ✓ ${inn} | ${groups[inn].client.short_name} (obj=${result.objects}, price=${result.priceItems}, ds=${result.addendums})`);
    } catch (e: any) {
      stats.errors++;
      console.error(`  ✗ ${inn} | ${groups[inn].client.short_name}: ${e.message}`);
    }
  }

  console.log('\n📊 ИТОГ:');
  console.log(`  clients:     ${stats.clients}`);
  console.log(`  objects:     ${stats.objects}`);
  console.log(`  price_items: ${stats.priceItems}`);
  console.log(`  addendums:   ${stats.addendums}`);
  if (stats.skipped) console.log(`  skipped (--only-new): ${stats.skipped}`);
  if (stats.errors) console.log(`  ⚠ errors:    ${stats.errors}`);
  console.log('\n✅ Импорт завершён');

  await pool.end();
}

main().catch((e) => {
  console.error('❌ Failed:', e);
  pool.end();
  process.exit(1);
});
