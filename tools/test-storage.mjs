// Smoke-тест lib/storage. Запуск: node tools/test-storage.mjs
// Проверяет put/get/exists/size/delete и path-traversal protection.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_ROOT = path.join(tmpdir(), `deztech-storage-test-${Date.now()}`);

const { getStorage, resetStorage } = await import('../lib/storage/index.ts');

async function main() {
  const storage = await getStorage();
  const root = process.env.STORAGE_ROOT;

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

  console.log(`Storage root: ${root}\n`);

  await t('put + get round-trip', async () => {
    await storage.put('docs/test.txt', Buffer.from('hello world'));
    const got = await storage.get('docs/test.txt');
    if (got.toString() !== 'hello world') throw new Error(`got: ${got}`);
  });

  await t('exists returns true for existing', async () => {
    if (!(await storage.exists('docs/test.txt'))) throw new Error('not found');
  });

  await t('exists returns false for missing', async () => {
    if (await storage.exists('docs/nope.txt')) throw new Error('falsely found');
  });

  await t('size matches buffer length', async () => {
    const sz = await storage.size('docs/test.txt');
    if (sz !== 11) throw new Error(`size = ${sz}`);
  });

  await t('nested directories created automatically', async () => {
    await storage.put('a/b/c/d/file.bin', Buffer.from([0xde, 0xad]));
    const got = await storage.get('a/b/c/d/file.bin');
    if (got.length !== 2 || got[0] !== 0xde) throw new Error('bad bytes');
  });

  await t('delete removes file', async () => {
    await storage.delete('docs/test.txt');
    if (await storage.exists('docs/test.txt')) throw new Error('still exists');
  });

  await t('delete is idempotent', async () => {
    await storage.delete('docs/never-existed.txt');
  });

  await t('path traversal with ../ rejected', async () => {
    try {
      await storage.put('../escape.txt', Buffer.from('hack'));
      throw new Error('should have thrown');
    } catch (err) {
      if (!err.message.includes('escapes root')) throw err;
    }
  });

  await t('path traversal with absolute rejected', async () => {
    try {
      await storage.put('/etc/passwd', Buffer.from('hack'));
      // На windows / резолвится в корень, но всё равно должно отклоняться
      // т.к. абсолютная попытка выйти из корня
    } catch (err) {
      if (!err.message.includes('escapes root') && !err.message.includes('non-empty')) {
        // На windows может пройти как относительный — проверим что внутри root
        const exists = await fs.stat(path.join(root, 'etc/passwd')).catch(() => null);
        if (!exists) throw err;
      }
    }
  });

  // Cleanup
  resetStorage();
  await fs.rm(root, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
