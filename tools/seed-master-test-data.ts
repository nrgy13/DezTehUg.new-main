/**
 * Seed для тестирования мобильного UI мастера (Sprint 6).
 *
 * Создаёт 5 клиентов с разными сценариями выездов, чтобы покрыть
 * все экраны мастера:
 *   #1 planned-выезд завтра (новая работа)
 *   #2 in_progress + planned (мастер в процессе)
 *   #3 history (2 completed + 1 planned)
 *   #4 all completed (видна в «Завершённые»)
 *   #5 draft без мастера (НЕ должна быть видна мастеру — контроль)
 *
 * Также сидит шаблоны чеклистов для disinsection / deratization / disinfection.
 *
 * Все записи помечаются маркером [TEST_MASTER] в notes/contract_number/title.
 *
 * Использование:
 *   npx tsx tools/seed-master-test-data.ts          # просто добавить
 *   npx tsx tools/seed-master-test-data.ts --reset  # сначала снести [TEST_MASTER]
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { eq, like, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../lib/db/index';
import { users } from '../lib/db/schema/users';
import { services } from '../lib/db/schema/services';
import { clients } from '../lib/db/schema/clients';
import { clientObjects } from '../lib/db/schema/objects';
import { deals, dealPriceItems, dealWorkLogs } from '../lib/db/schema/deals';
import { serviceChecklists, dealChecklistItems } from '../lib/db/schema/checklists';

const TEST_MARKER = '[TEST_MASTER]';
const RESET = process.argv.includes('--reset');

const MANAGER_EMAIL = 'deztexug@yandex.ru';
const MASTER_EMAIL = 'nrgy131@gmail.com';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  return daysAgo(-n);
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('🌱 Seeding master test data...\n');

  // ─── Юзеры ──────────────────────────────────────────
  const [manager] = await db.select().from(users).where(eq(users.email, MANAGER_EMAIL)).limit(1);
  const [master] = await db.select().from(users).where(eq(users.email, MASTER_EMAIL)).limit(1);
  if (!manager) throw new Error(`Manager ${MANAGER_EMAIL} not found. Run npm run db:seed first.`);
  if (!master) throw new Error(`Master ${MASTER_EMAIL} not found. Run npm run db:seed first.`);
  console.log(`✓ Manager: ${manager.fullName}`);
  console.log(`✓ Master:  ${master.fullName}\n`);

  // ─── RESET ──────────────────────────────────────────
  if (RESET) {
    console.log('🗑  RESET: deleting old [TEST_MASTER] records...');
    const oldClientIds = (
      await db
        .select({ id: clients.id })
        .from(clients)
        .where(like(clients.notes, `%${TEST_MARKER}%`))
    ).map((c) => c.id);

    if (oldClientIds.length > 0) {
      // Сначала deals (RESTRICT FK на client) — CASCADE удалит price_items/work_logs/checklist_items
      await db.delete(deals).where(inArray(deals.clientId, oldClientIds));
      // Затем clients — CASCADE удалит client_objects
      await db.delete(clients).where(inArray(clients.id, oldClientIds));
      console.log(`  ✓ Deleted ${oldClientIds.length} clients (cascade на deals/objects/visits/checklists)\n`);
    } else {
      console.log('  • Nothing to delete\n');
    }
  }

  // ─── Шаблоны чеклистов (idempotent, всегда пересоздаём) ───
  const checklistTemplates: Record<
    string,
    Array<{ title: string; description?: string; required: boolean }>
  > = {
    disinsection: [
      { title: 'Осмотр помещения, фото "ДО"', description: 'Зафиксируй состояние объекта до обработки', required: true },
      { title: 'Подготовка препарата', description: 'Запиши название препарата и концентрацию в заметке к пункту', required: true },
      { title: 'Обработка периметра', description: 'Плинтуса, дверные проёмы, оконные рамы', required: true },
      { title: 'Обработка очагов', description: 'Кухня, мусорное ведро, под раковиной, бытовая техника', required: true },
      { title: 'Финальный осмотр, фото "ПОСЛЕ"', description: 'Зафиксируй результат обработки', required: true },
    ],
    deratization: [
      { title: 'Осмотр территории, фото активности', description: 'Помёт, погрызы, следы — что увидели', required: true },
      { title: 'Установка/проверка контейнеров', description: 'Сколько контейнеров, где расставили (фото точек)', required: true },
      { title: 'Заполнение журнала ловушек', description: 'Активность? Замена приманки?', required: true },
      { title: 'Финальный осмотр, фото "ПОСЛЕ"', required: true },
    ],
    disinfection: [
      { title: 'Подготовка помещения', description: 'Вынос людей, животных, накрытие пищи', required: true },
      { title: 'Приготовление раствора', description: 'Препарат + концентрация в заметке', required: true },
      { title: 'Обработка поверхностей', description: 'Проход всех зон обработки', required: true },
      { title: 'Проветривание + фото "ПОСЛЕ"', required: true },
    ],
  };

  console.log('📋 Service checklists templates:');
  const allServices = await db.select().from(services);
  const svcByCode = new Map(allServices.map((s) => [s.code, s]));

  for (const [code, items] of Object.entries(checklistTemplates)) {
    const svc = svcByCode.get(code);
    if (!svc) {
      console.log(`  ⚠ Service ${code} not found, skipping`);
      continue;
    }
    await db.delete(serviceChecklists).where(eq(serviceChecklists.serviceId, svc.id));
    let pos = 0;
    for (const it of items) {
      await db.insert(serviceChecklists).values({
        serviceId: svc.id,
        position: pos++,
        title: it.title,
        description: it.description ?? null,
        required: it.required,
      });
    }
    console.log(`  ✓ ${code}: ${items.length} pts`);
  }
  console.log();

  // ─── 5 сценариев ────────────────────────────────────
  type Scenario = {
    clientName: string;
    clientType: 'individual' | 'legal';
    objectName: string;
    objectAddress: string;
    contractNumber: string;
    dealStatus: 'draft' | 'active' | 'completed' | 'signed';
    serviceCode: string;
    customName: string;
    areaM2: number;
    priceNoVat: number;
    visitsState: 'planned' | 'one_in_progress' | 'completed_history' | 'all_completed' | 'no_master';
    plannedDaysFromNow: number | null;
  };

  const scenarios: Scenario[] = [
    {
      clientName: 'ООО «Кафе Морской»',
      clientType: 'legal',
      objectName: 'Кухня кафе',
      objectAddress: 'г. Новороссийск, ул. Советов, 12',
      contractNumber: `ДТЮ-201-ТЕСТ`,
      dealStatus: 'active',
      serviceCode: 'disinsection',
      customName: 'Дезинсекция кухни (тараканы)',
      areaM2: 85,
      priceNoVat: 4500,
      visitsState: 'planned',
      plannedDaysFromNow: 1,
    },
    {
      clientName: 'ИП Магазин «У Дома»',
      clientType: 'legal',
      objectName: 'Торговый зал',
      objectAddress: 'г. Новороссийск, ул. Ленина, 88',
      contractNumber: `ДТЮ-202-ТЕСТ`,
      dealStatus: 'active',
      serviceCode: 'deratization',
      customName: 'Дератизация торгового зала',
      areaM2: 140,
      priceNoVat: 5200,
      visitsState: 'one_in_progress',
      plannedDaysFromNow: 0,
    },
    {
      clientName: 'ООО «Склад-Юг»',
      clientType: 'legal',
      objectName: 'Складское помещение',
      objectAddress: 'г. Краснодар, Тихорецкая, 5',
      contractNumber: `ДТЮ-203-ТЕСТ`,
      dealStatus: 'active',
      serviceCode: 'disinfection',
      customName: 'Дезинфекция складских помещений',
      areaM2: 320,
      priceNoVat: 12000,
      visitsState: 'completed_history',
      plannedDaysFromNow: 7,
    },
    {
      clientName: 'Иванов Иван Иванович',
      clientType: 'individual',
      objectName: 'Квартира',
      objectAddress: 'г. Новороссийск, ул. Энгельса, 27, кв. 14',
      contractNumber: `ДТЮ-204-ТЕСТ`,
      dealStatus: 'completed',
      serviceCode: 'disinsection',
      customName: 'Разовая дезинсекция (клопы)',
      areaM2: 65,
      priceNoVat: 3800,
      visitsState: 'all_completed',
      plannedDaysFromNow: -10,
    },
    {
      clientName: 'ООО «Свежий Лид»',
      clientType: 'legal',
      objectName: 'Офис',
      objectAddress: 'г. Краснодар, ул. Красная, 1',
      contractNumber: `ДТЮ-205-ТЕСТ`,
      dealStatus: 'draft',
      serviceCode: 'disinsection',
      customName: 'Дезинсекция офиса (черновик)',
      areaM2: 50,
      priceNoVat: 3000,
      visitsState: 'no_master',
      plannedDaysFromNow: null,
    },
  ];

  console.log('🧑 Clients + deals + visits:');
  let n = 0;
  for (const s of scenarios) {
    n++;
    const assignMaster = s.visitsState !== 'no_master';

    // Клиент
    const [client] = await db
      .insert(clients)
      .values({
        type: s.clientType,
        shortName: s.clientName,
        fullName: s.clientName,
        phone: `+7 (988) 555-00-${String(n).padStart(2, '0')}`,
        email: `test-${n}@test.deztech.local`,
        source: 'manager',
        status: s.dealStatus === 'draft' ? 'lead' : 'active',
        notes: `${TEST_MARKER} Тестовый клиент #${n} для UI мастера`,
        assignedManagerId: manager.id,
        createdById: manager.id,
        ...(s.clientType === 'legal'
          ? { inn: `230100${String(1000 + n)}`, legalAddress: s.objectAddress }
          : { legalAddress: s.objectAddress }),
      })
      .returning();

    // Объект
    await db.insert(clientObjects).values({
      clientId: client.id,
      name: s.objectName,
      address: s.objectAddress,
      areaM2: s.areaM2,
      objectType: s.objectName.toLowerCase(),
    });

    // Сделка
    const startDt = s.plannedDaysFromNow !== null ? daysFromNow(s.plannedDaysFromNow) : daysAgo(0);
    const totalGross = s.priceNoVat * 1.05;
    const [deal] = await db
      .insert(deals)
      .values({
        contractNumber: s.contractNumber,
        contractDate: dateStr(daysAgo(0)),
        contractPlace: 'г. Новороссийск',
        clientId: client.id,
        assignedManagerId: manager.id,
        assignedMasterId: assignMaster ? master.id : null,
        startDate: dateStr(startDt),
        endDate: dateStr(daysFromNow(365)),
        startAt: startDt,
        endAt: daysFromNow(365),
        isAllDay: false,
        status: s.dealStatus,
        totalAmount: totalGross.toFixed(2),
        currency: 'RUB',
        signatoryExecutor: 'ИП Белавина Ольга Владимировна',
        signatoryClient: s.clientType === 'individual' ? s.clientName : 'Директор Тестов Т.Т.',
        notes: `${TEST_MARKER} ${s.customName}`,
        createdById: manager.id,
      })
      .returning();

    // Прайс
    const svc = svcByCode.get(s.serviceCode);
    const [priceItem] = await db
      .insert(dealPriceItems)
      .values({
        dealId: deal.id,
        serviceId: svc?.id ?? null,
        customName: s.customName,
        areaM2: s.areaM2,
        method: 'Туман / точечно',
        frequency: s.visitsState === 'all_completed' ? 'Разово' : 'Ежемесячно',
        priceNoVat: s.priceNoVat.toFixed(2),
        priceWithVat: (s.priceNoVat * 1.05).toFixed(2),
        vatRate: '5.00',
        sortOrder: 0,
      })
      .returning();

    let visitsCreated = 0;

    if (assignMaster) {
      // Шаблоны чеклиста по услуге
      const templates = svc
        ? await db
            .select()
            .from(serviceChecklists)
            .where(eq(serviceChecklists.serviceId, svc.id))
            .orderBy(serviceChecklists.position)
        : [];

      async function createVisit(opts: {
        status: 'planned' | 'in_progress' | 'completed';
        plannedAt: Date | null;
        startedAt?: Date | null;
        finalizedAt?: Date | null;
        performedAt?: Date | null;
        description?: string | null;
        itemStatus?: 'pending' | 'done' | 'na';
      }) {
        const [wl] = await db
          .insert(dealWorkLogs)
          .values({
            dealId: deal.id,
            masterId: master.id,
            priceItemId: priceItem.id,
            status: opts.status,
            plannedAt: opts.plannedAt,
            startedAt: opts.startedAt ?? null,
            finalizedAt: opts.finalizedAt ?? null,
            performedAt: opts.performedAt ?? null,
            description: opts.description ?? null,
            areaM2: s.areaM2,
          })
          .returning();

        if (templates.length > 0) {
          const itemStatus = opts.itemStatus ?? 'pending';
          await db.insert(dealChecklistItems).values(
            templates.map((t) => ({
              workLogId: wl.id,
              source: 'template' as const,
              sourceTemplateId: t.id,
              position: t.position,
              title: t.title,
              description: t.description,
              required: t.required,
              status: itemStatus,
              doneAt: itemStatus === 'done' ? opts.finalizedAt ?? opts.performedAt ?? new Date() : null,
              doneByUserId: itemStatus === 'done' ? master.id : null,
            })),
          );
        }
        visitsCreated++;
        return wl;
      }

      switch (s.visitsState) {
        case 'planned':
          await createVisit({ status: 'planned', plannedAt: startDt });
          break;
        case 'one_in_progress':
          await createVisit({
            status: 'in_progress',
            plannedAt: daysAgo(0),
            startedAt: daysAgo(0),
            description: 'Начал обход контейнеров, нужно ещё проверить склад',
          });
          await createVisit({ status: 'planned', plannedAt: daysFromNow(30) });
          break;
        case 'completed_history':
          await createVisit({
            status: 'completed',
            plannedAt: daysAgo(30),
            startedAt: daysAgo(30),
            finalizedAt: daysAgo(30),
            performedAt: daysAgo(30),
            description: 'Плановая дезинфекция складских помещений. Замечаний нет.',
            itemStatus: 'done',
          });
          await createVisit({
            status: 'completed',
            plannedAt: daysAgo(7),
            startedAt: daysAgo(7),
            finalizedAt: daysAgo(7),
            performedAt: daysAgo(7),
            description: 'Контрольный обход. Чисто.',
            itemStatus: 'done',
          });
          await createVisit({ status: 'planned', plannedAt: startDt });
          break;
        case 'all_completed':
          await createVisit({
            status: 'completed',
            plannedAt: startDt,
            startedAt: startDt,
            finalizedAt: startDt,
            performedAt: startDt,
            description:
              'Разовая обработка квартиры от клопов. Туман по периметру + орошение очагов. Заказчик доволен.',
            itemStatus: 'done',
          });
          break;
      }
    }

    console.log(
      `  ✓ #${n} ${s.clientName} → ${s.dealStatus} (${visitsCreated} visit${visitsCreated === 1 ? '' : 's'})`,
    );
  }

  // ─── Verification ──────────────────────────────────
  console.log('\n📊 Verification (только [TEST_MASTER]):');
  const [{ c: cnt1 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clients)
    .where(like(clients.notes, `%${TEST_MARKER}%`));
  const [{ c: cnt2 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(deals)
    .where(like(deals.notes, `%${TEST_MARKER}%`));
  const [{ c: cnt3 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(dealWorkLogs)
    .innerJoin(deals, eq(dealWorkLogs.dealId, deals.id))
    .where(like(deals.notes, `%${TEST_MARKER}%`));
  const [{ c: cnt4 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(dealChecklistItems)
    .innerJoin(dealWorkLogs, eq(dealChecklistItems.workLogId, dealWorkLogs.id))
    .innerJoin(deals, eq(dealWorkLogs.dealId, deals.id))
    .where(like(deals.notes, `%${TEST_MARKER}%`));

  console.log(`  clients:        ${cnt1}`);
  console.log(`  deals:          ${cnt2}`);
  console.log(`  visits:         ${cnt3}`);
  console.log(`  checklist_pts:  ${cnt4}`);

  console.log('\n✅ Seed complete!\n');
  console.log(`🔑 Login as master:    ${MASTER_EMAIL} / welcome123`);
  console.log(`🔑 Login as manager:   ${MANAGER_EMAIL} / welcome123`);
  console.log(`📱 Mobile URL:         http://192.168.1.241:3000/login`);
  console.log(`💻 Desktop URL:        http://localhost:3000/login\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  pool.end();
  process.exit(1);
});
