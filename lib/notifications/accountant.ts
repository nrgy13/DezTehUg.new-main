import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema/settings';

// Sprint 8 — email бухгалтера ДезТехЮг. Используется для автоотправки
// счетов и УПД. Хранится в app_settings key='accountant_email'.
export const ACCOUNTANT_EMAIL_KEY = 'accountant_email';

export type AccountantEmailSettings = {
  email: string;
};

export async function getAccountantEmail(): Promise<string | null> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, ACCOUNTANT_EMAIL_KEY))
    .limit(1);
  if (rows.length === 0) return null;
  const stored = rows[0].value as Partial<AccountantEmailSettings> | null;
  const email = stored?.email?.trim();
  return email && email.length > 0 ? email : null;
}

export async function saveAccountantEmail(
  email: string,
  updatedById: string,
): Promise<void> {
  const value: AccountantEmailSettings = { email: email.trim() };
  await db
    .insert(appSettings)
    .values({
      key: ACCOUNTANT_EMAIL_KEY,
      value,
      updatedAt: new Date(),
      updatedById,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date(), updatedById },
    });
}

export async function clearAccountantEmail(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, ACCOUNTANT_EMAIL_KEY));
}
