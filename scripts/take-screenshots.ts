/**
 * Утилита для снятия скриншотов CRM-страниц для методичек.
 * Запускает Chromium через @playwright/test, логинится под тремя ролями,
 * проходит по списку URL, сохраняет PNG в docs/screenshots/.
 *
 * Запуск: `npx tsx scripts/take-screenshots.ts`
 * Перед запуском: dev-сервер на localhost:3000 + dev-БД с seed-юзерами.
 */
import { chromium, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = 'http://localhost:3000';
const OUT_DIR = resolve(process.cwd(), 'docs/screenshots');

type Shot = {
  /** Имя файла без расширения */
  name: string;
  /** URL относительно BASE */
  path: string;
  /** Подождать N мс после navigation */
  wait?: number;
  /** Доп. действия перед screenshot */
  before?: (page: Page) => Promise<void>;
  /** Полная страница (full_page) vs viewport (default) */
  fullPage?: boolean;
};

const ROLES = {
  admin: { email: 'sanctumizm@gmail.com', password: 'welcome123' },
  manager: { email: 'deztexug@yandex.ru', password: 'welcome123' },
  master: { email: 'nrgy131@gmail.com', password: 'welcome123' },
} as const;

const SHOTS: Record<keyof typeof ROLES, Shot[]> = {
  admin: [
    { name: 'admin-dashboard', path: '/admin', fullPage: true },
    { name: 'admin-users', path: '/admin/users', fullPage: true },
    { name: 'admin-services', path: '/admin/services', fullPage: true },
    { name: 'admin-templates', path: '/admin/templates', fullPage: true },
    { name: 'admin-deletions', path: '/admin/deletions', fullPage: true },
    { name: 'admin-settings', path: '/admin/settings', fullPage: true },
  ],
  manager: [
    { name: 'manager-dashboard', path: '/manager', fullPage: true },
    { name: 'manager-leads', path: '/manager/leads', fullPage: true },
    { name: 'manager-leads-board', path: '/manager/leads/board', fullPage: true, wait: 1500 },
    { name: 'manager-clients', path: '/manager/clients', fullPage: true },
    { name: 'manager-deals', path: '/manager/deals', fullPage: true },
    { name: 'manager-deals-board', path: '/manager/deals/board', fullPage: true, wait: 1500 },
    { name: 'manager-calendar', path: '/manager/calendar', fullPage: true, wait: 2500 },
    { name: 'manager-analytics', path: '/manager/analytics', fullPage: true, wait: 2000 },
    { name: 'manager-documents', path: '/manager/documents', fullPage: true },
    { name: 'manager-reports', path: '/manager/reports', fullPage: true, wait: 1500 },
    { name: 'manager-inbox', path: '/manager/inbox', fullPage: true },
    { name: 'manager-profile', path: '/profile', fullPage: true },
  ],
  master: [
    { name: 'master-dashboard', path: '/master', fullPage: true },
    { name: 'master-calendar', path: '/master/calendar', fullPage: true, wait: 2500 },
    { name: 'master-completed', path: '/master/completed', fullPage: true },
    { name: 'master-profile', path: '/profile', fullPage: true },
  ],
};

async function login(page: Page, role: keyof typeof ROLES): Promise<void> {
  const { email, password } = ROLES[role];
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[name="email"]');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const role of Object.keys(SHOTS) as Array<keyof typeof ROLES>) {
    console.log(`\n=== ${role.toUpperCase()} ===`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, role);
    console.log(`  ✓ logged in as ${role}`);

    for (const shot of SHOTS[role]) {
      try {
        await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 45000 });
        if (shot.wait) await page.waitForTimeout(shot.wait);
        if (shot.before) await shot.before(page);
        await page.screenshot({
          path: resolve(OUT_DIR, `${shot.name}.png`),
          fullPage: shot.fullPage,
        });
        console.log(`  ✓ ${shot.name}.png (${shot.path})`);
      } catch (err) {
        console.error(`  ✗ ${shot.name}: ${err instanceof Error ? err.message : err}`);
      }
    }

    await ctx.close();
  }

  await browser.close();
  console.log(`\nDone. Screenshots in: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
