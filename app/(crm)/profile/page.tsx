import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PasswordForm } from './PasswordForm';
import { TelegramSection } from './TelegramSection';
import { PushSection } from './PushSection';
import { getBotUsername } from '@/lib/notifications/telegram';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<'admin' | 'manager' | 'master', string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  master: 'Мастер',
};

export default async function ProfilePage() {
  const sessionUser = await requireAuth();

  // Подтянем актуальные TG-поля из БД (в session их нет).
  const [dbUser] = await db
    .select({
      telegramChatId: users.telegramChatId,
      telegramUsername: users.telegramUsername,
      telegramLinkedAt: users.telegramLinkedAt,
      telegramLinkToken: users.telegramLinkToken,
      telegramLinkTokenExpiresAt: users.telegramLinkTokenExpiresAt,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  // Если есть pending токен — собираем deep-link на server (юзер уже его открывал).
  let pendingDeepLink: string | null = null;
  if (
    dbUser?.telegramLinkToken &&
    dbUser?.telegramLinkTokenExpiresAt &&
    dbUser.telegramLinkTokenExpiresAt.getTime() > Date.now()
  ) {
    try {
      const username = await getBotUsername();
      pendingDeepLink = `https://t.me/${username}?start=${dbUser.telegramLinkToken}`;
    } catch (err) {
      console.error('[profile] cannot get bot username:', err);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary mb-1 uppercase">
          Профиль
        </h1>
        <p className="text-sm text-content-muted">
          {sessionUser.name} · {ROLE_LABELS[sessionUser.role]} · {sessionUser.email}
        </p>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-orbitron font-semibold text-content-primary mb-1 uppercase tracking-wider">
            Telegram-уведомления
          </h2>
          <p className="text-sm text-content-muted">
            Привяжи Telegram-чат — буду слать туда уведомления о зависших лидах вместо email.
          </p>
        </div>
        <TelegramSection
          isLinked={!!dbUser?.telegramChatId}
          telegramUsername={dbUser?.telegramUsername ?? null}
          linkedAt={dbUser?.telegramLinkedAt?.toISOString() ?? null}
          pendingDeepLink={pendingDeepLink}
          pendingExpiresAt={
            pendingDeepLink && dbUser?.telegramLinkTokenExpiresAt
              ? dbUser.telegramLinkTokenExpiresAt.toISOString()
              : null
          }
        />
      </CyberpunkCard>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-orbitron font-semibold text-content-primary mb-1 uppercase tracking-wider">
            Push-уведомления
          </h2>
          <p className="text-sm text-content-muted">
            Уведомления прямо на это устройство — приходят даже когда CRM
            закрыта. На iPhone работает только после «Установить на главный
            экран» в Safari (iOS 16.4+).
          </p>
        </div>
        <PushSection />
      </CyberpunkCard>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-orbitron font-semibold text-content-primary mb-1 uppercase tracking-wider">
            Смена пароля
          </h2>
          <p className="text-sm text-content-muted">
            Минимум 8 символов. Новый пароль не должен совпадать с текущим.
          </p>
        </div>
        <PasswordForm userRole={sessionUser.role} mustChange={sessionUser.passwordMustChange} />
      </CyberpunkCard>
    </div>
  );
}
