import { Building2, FileSignature, Banknote, Phone, Lock, Code, Bell, Calculator } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { CONTRACT_PROVIDER as P } from '@/lib/contract-provider';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema/settings';
import { getThresholds, defaultThresholds, THRESHOLDS_KEY } from '@/lib/notifications/thresholds';
import { getAccountantEmail } from '@/lib/notifications/accountant';
import { NotificationThresholdsSection } from './NotificationThresholdsSection';
import { AccountantEmailSection } from './AccountantEmailSection';
import { PageTitle } from '@/components/crm/PageTitle';

export const metadata = { title: 'Настройки — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireRole('admin', 'manager');

  const [thresholds, defaults, dbOverride, accountantEmail] = await Promise.all([
    getThresholds(),
    Promise.resolve(defaultThresholds()),
    db
      .select({ key: appSettings.key })
      .from(appSettings)
      .where(eq(appSettings.key, THRESHOLDS_KEY))
      .limit(1),
    getAccountantEmail(),
  ]);
  const isOverridden = dbOverride.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Настройки системы</PageTitle>
        <p className="text-content-muted mt-1 text-sm">
          Реквизиты Исполнителя и параметры, используемые в договорах, КП, актах и письмах.
        </p>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-4 bg-amber-50/50 border-amber-200/50">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong>Read-only режим.</strong> Реквизиты хранятся в коде —{' '}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">lib/contract-provider.ts</code>.
            Чтобы изменить — отредактируй файл и передеплой. UI редактирования через БД появится в Sprint 5+.
          </div>
        </div>
      </CyberpunkCard>

      <Section icon={Building2} title="Компания">
        <Row label="Полное наименование" value={P.fullName} />
        <Row label="Краткое наименование" value={P.shortName} />
        <Row label="Бренд" value={P.brand} />
        <Row label="ОГРНИП" value={P.ogrnip} mono />
        <Row label="ИНН" value={P.inn} mono />
        <Row label="Юридический адрес" value={P.legalAddress} />
        <Row label="Почтовый адрес" value={P.postalAddress} />
      </Section>

      <Section icon={FileSignature} title="Подписант и лицензия">
        <Row label="ФИО подписанта (полное)" value={P.signatoryFullName} />
        <Row label="ФИО подписанта (короткое)" value={P.signatoryShort} />
        <Row label="Номер лицензии" value={P.licenseNumber} mono />
        <Row label="Дата выдачи лицензии" value={P.licenseDate} />
        <Row label="Орган выдачи" value={P.licenseAuthority} />
      </Section>

      <Section icon={Banknote} title="Банковские реквизиты">
        <Row label="Банк" value={P.bankName} />
        <Row label="Расчётный счёт" value={P.bankAccount} mono />
        <Row label="БИК" value={P.bankBik} mono />
        <Row label="Корр. счёт" value={P.bankCorrAccount} mono />
      </Section>

      <Section icon={Phone} title="Контакты">
        <Row label="Телефон" value={P.phone} />
        <Row label="Email" value={P.email} />
      </Section>

      <Section icon={Bell} title="Пороги «зависания» лидов">
        <div className="px-4 py-3">
          <NotificationThresholdsSection
            initial={thresholds}
            defaults={defaults}
            isOverridden={isOverridden}
          />
        </div>
      </Section>

      <Section icon={Calculator} title="Email бухгалтера">
        <div className="px-4 py-3">
          <AccountantEmailSection initial={accountantEmail} />
        </div>
      </Section>

      <Section icon={Code} title="Системные параметры (env)">
        <Row label="STORAGE_DRIVER" value={process.env.STORAGE_DRIVER ?? 'local'} mono />
        <Row label="MAILER_TRANSPORT" value={process.env.MAILER_TRANSPORT ?? 'smtp'} mono />
        <Row label="REDIS_URL" value={maskSecret(process.env.REDIS_URL)} mono />
        <Row
          label="CRON_SECRET"
          value={process.env.CRON_SECRET ? '••••••••••••' : '⚠ не задан'}
          mono
        />
        <Row
          label="N8N_INBOUND_SECRET"
          value={process.env.N8N_INBOUND_SECRET ? '••••••••••••' : '⚠ не задан'}
          mono
        />
        <p className="text-[11px] text-content-muted mt-3 italic">
          Секреты не показываются. Чтобы проверить значение — смотри{' '}
          <code className="bg-gray-100 px-1 rounded font-mono">.env.local</code> локально или{' '}
          <code className="bg-gray-100 px-1 rounded font-mono">/opt/deztech-crm/.env</code> на VPS.
        </p>
      </Section>
    </div>
  );
}

function maskSecret(value: string | undefined): string {
  if (!value) return '—';
  // показываем только хост:порт без пароля
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '••••';
  }
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Icon className="w-4 h-4 text-poison-green" />
        <h2 className="text-sm font-orbitron font-semibold tracking-wider uppercase text-content-primary">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </CyberpunkCard>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 items-baseline">
      <div className="text-[11px] font-orbitron tracking-wider uppercase text-content-muted">
        {label}
      </div>
      <div
        className={`text-sm text-content-primary break-words ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}
