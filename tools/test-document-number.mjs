// Smoke-тест lib/document-number. Запуск: npx tsx tools/test-document-number.mjs
// ВНИМАНИЕ: пишет в реальную dev-БД (deztech-crm-postgres-dev). Очищает counters в начале.

import 'dotenv/config';
// Forcing local-only DATABASE_URL (хост из контейнера)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://deztech:dev_password_change_me@localhost:5432/deztech_crm';
}

const { nextDocumentNumber, peekDocumentNumber, DOCUMENT_PREFIX } = await import(
  '../lib/document-number.ts'
);
const { db } = await import('../lib/db/index.ts');
const { sql } = await import('drizzle-orm');

let passed = 0;
let failed = 0;

const t = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name} — ${err.message}`);
    failed++;
  }
};

// Очищаем счётчики перед тестами
await db.execute(sql`DELETE FROM document_number_counters`);

await t('first call returns 001', async () => {
  const n = await nextDocumentNumber('contract', new Date('2026-01-15'));
  if (!n.match(/^ДГ-2026-001$/)) throw new Error(`got ${n}`);
});

await t('second call returns 002', async () => {
  const n = await nextDocumentNumber('contract', new Date('2026-01-15'));
  if (!n.match(/^ДГ-2026-002$/)) throw new Error(`got ${n}`);
});

await t('different type has independent counter', async () => {
  const n = await nextDocumentNumber('addendum', new Date('2026-01-15'));
  if (!n.match(/^ДС-2026-001$/)) throw new Error(`got ${n}`);
});

await t('different year has independent counter', async () => {
  const n = await nextDocumentNumber('contract', new Date('2027-01-15'));
  if (!n.match(/^ДГ-2027-001$/)) throw new Error(`got ${n}`);
});

await t('all 7 prefixes work', async () => {
  for (const type of Object.keys(DOCUMENT_PREFIX)) {
    const n = await nextDocumentNumber(type, new Date('2025-06-01'));
    const expected = `${DOCUMENT_PREFIX[type]}-2025-001`;
    if (n !== expected) throw new Error(`type=${type}: got ${n}, expected ${expected}`);
  }
});

await t('parallel 10 calls produce 10 unique numbers', async () => {
  await db.execute(sql`DELETE FROM document_number_counters WHERE year = 2024`);
  const promises = Array.from({ length: 10 }, () =>
    nextDocumentNumber('invoice', new Date('2024-08-01')),
  );
  const results = await Promise.all(promises);
  const unique = new Set(results);
  if (unique.size !== 10) {
    throw new Error(`got duplicates: ${results.join(', ')}`);
  }
  // Проверим что все номера от 001 до 010
  const numbers = results.map((r) => parseInt(r.split('-').pop(), 10)).sort((a, b) => a - b);
  for (let i = 0; i < 10; i++) {
    if (numbers[i] !== i + 1) throw new Error(`expected ${i + 1}, got ${numbers[i]}`);
  }
});

await t('peek returns last without increment', async () => {
  await db.execute(sql`DELETE FROM document_number_counters WHERE type = 'commercial_offer'`);
  const n1 = await nextDocumentNumber('commercial_offer', new Date('2026-03-10'));
  const peek1 = await peekDocumentNumber('commercial_offer', 2026);
  if (peek1 !== n1) throw new Error(`peek=${peek1}, expected ${n1}`);
  // Повторный peek даёт тот же
  const peek2 = await peekDocumentNumber('commercial_offer', 2026);
  if (peek2 !== n1) throw new Error(`peek changed: ${peek2}`);
  // Следующий next должен быть 002
  const n2 = await nextDocumentNumber('commercial_offer', new Date('2026-03-10'));
  if (!n2.endsWith('-002')) throw new Error(`expected -002, got ${n2}`);
});

await t('peek returns null for missing pair', async () => {
  await db.execute(sql`DELETE FROM document_number_counters WHERE year = 2099`);
  const p = await peekDocumentNumber('act_inspection', 2099);
  if (p !== null) throw new Error(`expected null, got ${p}`);
});

// Cleanup
await db.execute(sql`DELETE FROM document_number_counters`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
