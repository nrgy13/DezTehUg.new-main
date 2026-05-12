import { test, expect } from '@playwright/test';

/**
 * Sprint 6 smoke: PWA manifest + иконки доступны.
 *
 * Полный E2E flow (создание выезда + чеклист + фото) делается вручную через
 * cloudflared tunnel на реальном телефоне — слишком много специфики мобилы.
 */

test.describe('Sprint 6 — PWA assets', () => {
  test('manifest.webmanifest доступен и валиден', async ({ request }) => {
    const r = await request.get('/manifest.webmanifest');
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('manifest');
    const json = await r.json();
    expect(json.name).toBe('ДезТехЮг CRM');
    expect(json.short_name).toBe('ДТЮ CRM');
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBeGreaterThanOrEqual(4);
    // 192/512 + maskable должны быть
    const hasMaskable = json.icons.some(
      (i: { purpose?: string }) => i.purpose?.includes('maskable'),
    );
    expect(hasMaskable).toBe(true);
  });

  test('иконки 192/512 доступны', async ({ request }) => {
    const r192 = await request.get('/icons/icon-192.png');
    const r512 = await request.get('/icons/icon-512.png');
    expect(r192.status()).toBe(200);
    expect(r512.status()).toBe(200);
    expect(r192.headers()['content-type']).toContain('image/png');
  });

  test('apple-touch-icon доступна', async ({ request }) => {
    const r = await request.get('/icons/apple-touch-icon.png');
    expect(r.status()).toBe(200);
  });
});
