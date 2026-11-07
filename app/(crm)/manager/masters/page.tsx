import { asc, desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HardHat, Info } from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema/users';
import { masterPayRates } from '@/lib/db/schema/finance';
import { formatRub, toKop } from '@/lib/finance/compute';
import { utcToMskParts } from '@/lib/datetime/msk';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { PageTitle } from '@/components/crm/PageTitle';
import { MasterRateCard, type MasterRateView, type MasterView } from './MasterRateCard';

export const metadata = { title: 'Мастера и ставки — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

/** 'YYYY-MM-DD' → 'ДД.ММ.ГГГГ'. */
function fmtDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

/** '12.50' → '12,5%'. */
function fmtPercent(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return `${v}%`;
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
}

/**
 * «Мастера и ставки» (11.2026, запрос Сани): менеджер задаёт мастеру % от наряда и месячную
 * минималку с датой начала действия. История хранится — смена ставки не пересчитывает прошлое.
 * Мастеру страница недоступна (requireRole('manager'), admin проходит автоматически).
 */
export default async function MastersRatesPage() {
  await requireRole('manager');

  const masters = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.role, 'master'))
    .orderBy(desc(users.isActive), asc(users.fullName));

  const creator = alias(users, 'rate_creator');
  const rates =
    masters.length > 0
      ? await db
          .select({
            id: masterPayRates.id,
            userId: masterPayRates.userId,
            percent: masterPayRates.percent,
            minMonthly: masterPayRates.minMonthly,
            effectiveFrom: masterPayRates.effectiveFrom,
            note: masterPayRates.note,
            createdAt: masterPayRates.createdAt,
            createdByName: creator.fullName,
          })
          .from(masterPayRates)
          .leftJoin(creator, eq(creator.id, masterPayRates.createdById))
          .where(
            inArray(
              masterPayRates.userId,
              masters.map((m) => m.id),
            ),
          )
          .orderBy(desc(masterPayRates.effectiveFrom))
      : [];

  // «Сегодня» — по МСК (ставки и наряды живут в МСК), независимо от TZ сервера.
  const todayMsk = utcToMskParts(new Date())!.date;
  const defaultFrom = `${todayMsk.slice(0, 8)}01`;

  const views: MasterView[] = masters.map((m) => {
    // Отсортировано по effectiveFrom DESC → первая с датой <= сегодня и есть текущая.
    const own = rates.filter((r) => r.userId === m.id);
    const current = own.find((r) => r.effectiveFrom <= todayMsk) ?? null;
    const history: MasterRateView[] = own.map((r) => {
      const created = utcToMskParts(r.createdAt);
      const createdLabel = created
        ? `${fmtDay(created.date)} ${created.time}`
        : '—';
      return {
        id: r.id,
        effectiveFrom: r.effectiveFrom,
        effectiveFromLabel: fmtDay(r.effectiveFrom),
        percentLabel: fmtPercent(r.percent),
        minMonthlyLabel: formatRub(toKop(r.minMonthly) ?? 0),
        note: r.note,
        createdLabel,
        createdByName: r.createdByName,
        state: r.effectiveFrom > todayMsk ? 'future' : current?.id === r.id ? 'current' : 'past',
      };
    });
    // Ближайшая будущая ставка (их может быть несколько — показываем самую раннюю).
    const upcoming = [...history].reverse().find((h) => h.state === 'future') ?? null;
    return {
      id: m.id,
      fullName: m.fullName,
      contact: m.phone || m.email,
      isActive: m.isActive,
      current: current
        ? {
            // Сырые числа — подставить в форму новой ставки ('12.50' → '12.5').
            percent: String(Number(current.percent)),
            minMonthly: String(Number(current.minMonthly)),
            percentLabel: fmtPercent(current.percent),
            minMonthlyLabel: formatRub(toKop(current.minMonthly) ?? 0),
            fromLabel: fmtDay(current.effectiveFrom),
          }
        : null,
      upcoming: upcoming
        ? {
            percentLabel: upcoming.percentLabel,
            minMonthlyLabel: upcoming.minMonthlyLabel,
            fromLabel: upcoming.effectiveFromLabel,
          }
        : null,
      history,
    };
  });

  const withoutRate = views.filter((v) => v.isActive && !v.current).length;

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Мастера и ставки</PageTitle>
        <p className="text-content-muted mt-1 text-sm">
          Процент от наряда и гарантированная минималка в месяц. Ставка действует с указанной даты —
          историю видно ниже, прошлое не пересчитывается.
        </p>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-4 sm:p-5">
        <div className="flex items-center gap-1.5 text-xs font-orbitron tracking-wider text-content-muted uppercase mb-2">
          <Info className="w-3.5 h-3.5" /> Как считается
        </div>
        <ul className="list-disc pl-5 space-y-1 text-sm text-content-secondary">
          <li>
            За наряд мастеру — <b className="text-content-primary">его % от полной стоимости наряда</b>.
            В бригаде — каждому свой % от полной стоимости (не делится пополам).
          </li>
          <li>
            «Документальный» наряд — мастеру <b className="text-content-primary">0 ₽</b>, вся сумма
            остаётся организации.
          </li>
          <li>
            Ручная сумма мастеру в наряде <b className="text-content-primary">перекрывает</b> расчёт по
            проценту.
          </li>
          <li>
            За месяц к выплате ={' '}
            <b className="text-content-primary">max(сумма процентов за наряды, минималка)</b>. Если набрал
            меньше минималки — разницу доплачивает организация.
          </li>
          <li>
            Ставка берётся на дату наряда. Новая ставка действует <b className="text-content-primary">с
            указанной даты</b>; прошлые месяцы не пересчитываются. Минималка месяца — по ставке на его
            последний день.
          </li>
        </ul>
      </CyberpunkCard>

      {withoutRate > 0 && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          У {withoutRate} {withoutRate === 1 ? 'активного мастера' : 'активных мастеров'} ставка не
          задана — за их наряды начисляется 0 ₽.
        </p>
      )}

      {views.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="px-4 py-12 text-center text-content-muted">
          <HardHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Мастеров пока нет.</p>
          <p className="text-xs mt-1">Мастеров заводит администратор в разделе «Пользователи».</p>
        </CyberpunkCard>
      ) : (
        <div className="space-y-4">
          {views.map((m) => (
            <MasterRateCard key={m.id} master={m} defaultFrom={defaultFrom} />
          ))}
        </div>
      )}
    </div>
  );
}
