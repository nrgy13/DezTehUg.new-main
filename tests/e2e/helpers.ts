import { type Page, expect } from '@playwright/test';

/**
 * Логин через NextAuth credentials. Не использует UI — POST в /api/auth/callback/credentials.
 * Это быстрее и устойчивее к изменениям в вёрстке /login.
 */
export async function loginAs(page: Page, email: string, password: string) {
  // 1. Получаем CSRF
  await page.goto('/login');
  const csrfResponse = await page.request.get('/api/auth/csrf');
  const { csrfToken } = await csrfResponse.json();

  // 2. POST credentials
  await page.request.post('/api/auth/callback/credentials', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: '/',
      json: 'true',
    },
  });
}

export async function logout(page: Page) {
  const csrf = await page.request.get('/api/auth/csrf');
  const { csrfToken } = await csrf.json();
  await page.request.post('/api/auth/signout', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: { csrfToken, callbackUrl: '/login', json: 'true' },
  });
}
