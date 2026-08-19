import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PasswordForm } from './PasswordForm';
import { TelegramSection } from './TelegramSection';
import { PushSection } from './PushSection';
import { getBotUsername } from '@/lib/notifications/telegram';
import { PageTitle } from '@/components/crm/PageTitle';

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

  // Пока пароль не сменён, authorized-колбэк (lib/auth/config.ts) разворачивает юзера
  // сюда с ЛЮБОЙ страницы. Раньше он попадал на обычный профиль, где смена пароля была
  // ТРЕТЬЕЙ карточкой — ниже Telegram и Push, на телефоне это 2-3 экрана прокрутки.
  // Мастер Денисов так и не долистал: заходил, не находил своих выездов и уходил
  // (жалоба Регины 13.08 и 17.08.2026 — «Юра не видит свои заказы»).
  // Поэтому в этом состоянии показываем ТОЛЬКО смену пароля и объясняем, что происходит.
  if (sessionUser.passwordMustChange) {
    return (
      <div className="max-w-xl space-y-6">
        <div>
          <PageTitle className="mb-1">Смените пароль</PageTitle>
          <p className="text-sm text-content-muted">
            {sessionUser.name} · {ROLE_LABELS[sessionUser.role]} · {sessionUser.email}
          </p>
        </div>

        <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
          <div className="mb-5">
            <h2 className="text-lg font-orbitron font-semibold text-content-primary mb-2 uppercase tracking-wider">
              Остался один шаг
            </h2>
            <p className="text-sm text-content-secondary">
              Вы вошли по временному паролю. Пока он не заменён на свой, остальные
              разделы закрыты — поэтому вы и не видите свои задачи.
            </p>
            <p className="text-sm text-content-secondary mt-2">
              Придумайте новый пароль (минимум 8 символов) и нажмите «Сменить пароль».
              {sessionUser.role === 'master'
                ? ' Сразу после этого откроются ваши выезды.'
                : ' Сразу после этого откроется рабочий раздел.'}
            </p>
            <p className="text-xs text-content-muted mt-3">
              В поле «Текущий пароль» введите тот временный пароль, которым только что вошли.
              Если он не сохранился — попросите администратора выдать новый.
            </p>
          </div>
          <PasswordForm userRole={sessionUser.role} mustChange />
        </CyberpunkCard>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <PageTitle className="mb-1">Профиль</PageTitle>
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
