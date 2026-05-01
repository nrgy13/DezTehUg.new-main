/**
 * Seed-скрипт для начального наполнения БД.
 * Запуск: npm run db:seed
 *
 * Создаёт:
 *   - 1 admin (Саня)
 *   - 1 manager (Регина)
 *   - 1 master (Александр)
 *   - Каталог услуг ДезТехЮг
 *
 * Идемпотентен — можно запускать многократно, не задвоит записи.
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { users, type NewUser } from './schema/users';
import { services, type NewService } from './schema/services';

const TEMP_PASSWORD = 'welcome123'; // временный, при первом входе менять
const BCRYPT_ROUNDS = 10;

const seedUsers: NewUser[] = [
  {
    email: 'sanctumizm@gmail.com',
    fullName: 'Саня (Admin)',
    role: 'admin',
    isActive: true,
  },
  {
    email: 'deztexug@yandex.ru',
    fullName: 'Регина',
    role: 'manager',
    isActive: true,
  },
  {
    email: 'nrgy131@gmail.com',
    fullName: 'Александр',
    role: 'master',
    isActive: true,
  },
];

const seedServices: NewService[] = [
  {
    code: 'disinsection',
    name: 'Дезинсекция (уничтожение тараканов и насекомых)',
    shortName: 'Дезинсекция',
    description:
      'Профилактические и истребительные работы против насекомых (тараканов, клопов, муравьёв и др.)',
    defaultMethod: 'Сухая/Точечное орошение/Туман',
    sortOrder: 10,
  },
  {
    code: 'deratization',
    name: 'Дератизация (уничтожение грызунов, пест-контроль)',
    shortName: 'Дератизация',
    description:
      'Профилактические и истребительные работы против грызунов, зоологическое обследование',
    defaultMethod: 'Сухая',
    sortOrder: 20,
  },
  {
    code: 'disinfection',
    name: 'Дезинфекция зданий, промышленного оборудования',
    shortName: 'Дезинфекция',
    description:
      'Уничтожение инфекционных агентов на поверхностях, в помещениях и на оборудовании',
    defaultMethod: 'Орошение/Туман',
    sortOrder: 30,
  },
  {
    code: 'fumigation',
    name: 'Фумигация',
    shortName: 'Фумигация',
    description: 'Газовая обработка для уничтожения вредителей в труднодоступных местах',
    defaultMethod: 'Газация',
    sortOrder: 40,
  },
  {
    code: 'deodorization',
    name: 'Дезодорация (удаление запахов)',
    shortName: 'Дезодорация',
    description: 'Устранение неприятных запахов в помещениях',
    defaultMethod: 'Озонирование/Туман',
    sortOrder: 50,
  },
  {
    code: 'deserpentation',
    name: 'Десерпентация (борьба со змеями)',
    shortName: 'Десерпентация',
    description: 'Профилактика и удаление змей с территорий',
    defaultMethod: 'Обработка территории',
    sortOrder: 60,
  },
  {
    code: 'herbicide-treatment',
    name: 'Гербицидная обработка',
    shortName: 'Гербициды',
    description: 'Уничтожение нежелательной растительности',
    defaultMethod: 'Опрыскивание',
    sortOrder: 70,
  },
  {
    code: 'water-analysis',
    name: 'Анализ воды',
    shortName: 'Анализ воды',
    description: 'Лабораторный анализ качества воды',
    defaultMethod: 'Отбор проб',
    sortOrder: 80,
  },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // ----- Users -----
  console.log('👤 Users:');
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, BCRYPT_ROUNDS);

  for (const u of seedUsers) {
    const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing) {
      console.log(`  • ${u.email} — already exists, skipping`);
      continue;
    }
    await db.insert(users).values({ ...u, passwordHash });
    console.log(`  ✓ ${u.email} (${u.role}) — created`);
  }

  // ----- Services -----
  console.log('\n🧹 Services:');
  for (const s of seedServices) {
    const [existing] = await db.select().from(services).where(eq(services.code, s.code)).limit(1);
    if (existing) {
      console.log(`  • ${s.code} — already exists, skipping`);
      continue;
    }
    await db.insert(services).values(s);
    console.log(`  ✓ ${s.code} — created`);
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`\n🔑 Temporary password for all seeded users: ${TEMP_PASSWORD}`);
  console.log(`   ⚠️  Change it on first login!\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  pool.end();
  process.exit(1);
});
