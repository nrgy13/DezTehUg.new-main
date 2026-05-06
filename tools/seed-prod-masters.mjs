// Создаёт 2 мастеров (Денисов, Нечепоренко) на prod БД.
// Генерит случайные одноразовые пароли + bcrypt-хеши + UUID.
// Выводит SQL в stdout и plaintext пароли в stderr (чтобы их можно было сохранить).
//
// Использование:
//   node tools/seed-prod-masters.mjs > tmp/masters.sql 2> tmp/masters-passwords.txt
//   docker cp tmp/masters.sql deztech-crm-postgres:/tmp/m.sql
//   docker exec -i deztech-crm-postgres psql -U deztech deztech_crm -f /tmp/m.sql
//
// Также выводит UUID в stdout последними строками — нужны для подстановки
// в seed-prod-appetit.mjs (через sed __DENISOV_ID__ / __NECHEPORENKO_ID__).

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function generatePassword(length = 12) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p = '';
  for (let i = 0; i < length; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

const masters = [
  {
    id: randomUUID(),
    email: 'denisov.master@deztehug.ru',
    fullName: 'Денисов Юрий Леонидович', // заглушка ФИО
    phone: null,
    role: 'master',
    password: generatePassword(12),
  },
  {
    id: randomUUID(),
    email: 'nechepor.master@deztehug.ru',
    fullName: 'Нечепоренко Дмитрий Игоревич', // заглушка ФИО
    phone: null,
    role: 'master',
    password: generatePassword(12),
  },
];

console.log('-- Создание 2 мастеров. Plaintext пароли см. stderr.');
console.log('BEGIN;');
console.log('');
for (const m of masters) {
  const hash = await bcrypt.hash(m.password, 10);
  console.log(`INSERT INTO users (id, email, password_hash, full_name, phone, role, is_active, password_must_change, created_at, updated_at) VALUES (
  ${q(m.id)}, ${q(m.email)}, ${q(hash)}, ${q(m.fullName)}, ${m.phone == null ? 'NULL' : q(m.phone)},
  'master', true, true, NOW(), NOW()
) ON CONFLICT (email) DO NOTHING;`);
  console.log('');
  // Plaintext пароли — в stderr (чтобы не попадали в SQL-файл)
  process.stderr.write(`MASTER_CREDS\t${m.email}\t${m.password}\n`);
}
console.log('COMMIT;');
console.log('');
console.log("-- Проверка:");
console.log("SELECT email, full_name, role, password_must_change FROM users WHERE role='master' ORDER BY email;");
console.log('');

// Выводим UUIDы как комментарии (чтобы можно было extract'ить через grep)
console.log('-- IDs for substitution in seed-prod-appetit.mjs:');
console.log(`-- DENISOV_ID=${masters[0].id}`);
console.log(`-- NECHEPORENKO_ID=${masters[1].id}`);
