import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers';

const REGINA = { email: 'deztexug@yandex.ru', password: 'welcome123' };
const ADMIN = { email: 'sanctumizm@gmail.com', password: 'welcome123' };

test.describe('Happy path: лид → клиент → сделка → документ', () => {
  test('Регина видит дашборд и список клиентов', async ({ page }) => {
    await loginAs(page, REGINA.email, REGINA.password);
    await page.goto('/manager');
    await expect(page).toHaveTitle(/ДезТехЮг/);
    await expect(page.locator('h1')).toContainText('Дашборд менеджера');

    // Sidebar содержит ключевые пункты
    await expect(page.locator('aside')).toContainText('Клиенты');
    await expect(page.locator('aside')).toContainText('Заявки');
    await expect(page.locator('aside')).toContainText('Договоры');

    await logout(page);
  });

  test('Регина создаёт сделку из карточки клиента, добавляет позицию, генерирует DOCX', async ({
    page,
  }) => {
    await loginAs(page, REGINA.email, REGINA.password);
    await page.goto('/manager/clients');
    await expect(page.locator('h1')).toContainText('Клиенты');

    // Найти первого клиента в таблице (href c UUID)
    const allLinks = await page.locator('a[href^="/manager/clients/"]').all();
    let clientHref: string | null = null;
    for (const l of allLinks) {
      const href = await l.getAttribute('href');
      if (href && /^\/manager\/clients\/[0-9a-f-]{36}$/i.test(href)) {
        clientHref = href;
        break;
      }
    }
    expect(clientHref).toBeTruthy();
    await page.goto(clientHref!);

    // На карточке клиента — кнопка «Создать сделку»
    page.on('dialog', (d) => d.accept()); // confirm() → ok
    await page.getByRole('button', { name: /Создать сделку/ }).click();

    // Должны попасть на /manager/deals/{uuid}
    await page.waitForURL(/\/manager\/deals\/[0-9a-f-]{36}/, { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('ДТЮ-');

    // Перейти в таб «Прайс»
    await page.getByRole('link', { name: 'Прайс' }).click();
    await page.getByRole('button', { name: /Добавить позицию/ }).click();

    // Заполнить форму прайс-позиции
    await page.fill('#customName', 'E2E тест: Дезинсекция');
    await page.fill('#areaM2', '100');
    await page.fill('#priceNoVat', '5000');
    await page.locator('[role="dialog"]').getByRole('button', { name: /Добавить/ }).click();

    // Ждём что позиция появилась в таблице
    await expect(page.locator('tbody').getByText('E2E тест: Дезинсекция')).toBeVisible({
      timeout: 5_000,
    });

    // Перейти в таб «Документы» внутри карточки сделки (а не в /manager/documents из Sidebar)
    await page.locator('a[href*="?tab=documents"]').click();
    await page.getByRole('button', { name: /Сгенерировать/ }).click();
    await page.getByRole('menuitem', { name: 'Договор' }).click();

    // После генерации — в таблице должна появиться запись с типом «Договор»
    await expect(page.locator('tbody').getByText('Договор').first()).toBeVisible({
      timeout: 30_000, // PDF может занять время
    });

    await logout(page);
  });
});

test.describe('Admin создаёт юзера и видит одноразовый пароль', () => {
  test('Создание + одноразовый пароль показан', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);
    await page.goto('/admin/users');
    await expect(page.locator('h1')).toContainText('Пользователи');

    await page.getByRole('button', { name: /Создать юзера/ }).click();

    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    await page.fill('#u-email', uniqueEmail);
    await page.fill('#u-name', 'E2E Test User');
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Создать' }).click();

    // Появляется диалог с паролем (по DialogTitle)
    await expect(page.getByRole('heading', { name: 'Временный пароль' })).toBeVisible({
      timeout: 5_000,
    });

    // Пароль виден (12 символов в моноширине)
    const passwordEl = page.locator('.font-mono.text-lg').first();
    await expect(passwordEl).toBeVisible();
    const password = (await passwordEl.textContent())?.trim();
    expect(password?.length).toBeGreaterThan(8);

    await logout(page);
  });
});
