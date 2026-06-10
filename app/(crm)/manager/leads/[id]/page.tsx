import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Calendar,
  FileJson,
  XCircle,
} from 'lucide-react';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema/leads';
import { users } from '@/lib/db/schema/users';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { LEAD_LOST_REASON_LABELS } from '@/lib/lead-lost-reasons';
import { LeadStatusControl } from '../LeadStatusControl';
import { TakeLeadButton, ConvertLeadButton, EditLeadButton, DeleteLeadButton } from '../LeadActions';
import { getLeadHistory } from '@/lib/lead-stages-server';
import { LeadHistoryTimeline } from '../_components/LeadHistoryTimeline';
import { PageTitle } from '@/components/crm/PageTitle';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [l] = await db
    .select({ name: leads.contactName })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1);
  return { title: l ? `Заявка ${l.name ?? '—'} — ДезТехЮг CRM` : 'Заявка — ДезТехЮг CRM' };
}

export default async function LeadCardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('manager');
  const { id } = await params;

  const [row] = await db
    .select({
      lead: leads,
      managerName: users.fullName,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedManagerId, users.id))
    .where(eq(leads.id, id))
    .limit(1);

  if (!row) notFound();
  const lead = row.lead;

  // История стадий
  const history = await getLeadHistory(lead.id);

  const isMine = lead.assignedManagerId === user.id;
  const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' });

  const services = Array.isArray(lead.serviceTypes)
    ? (lead.serviceTypes as string[])
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/manager/leads"
          className="inline-flex items-center gap-1 text-sm text-content-muted hover:text-neon-orange transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          К списку заявок
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <PageTitle>{lead.contactName ?? 'Без имени'}</PageTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <LeadStatusControl leadId={lead.id} initial={lead.status} />
              <span className="text-xs text-content-muted">
                · {dateFmt.format(lead.createdAt)}
              </span>
              {lead.channel && (
                <span className="text-xs font-orbitron tracking-wider text-content-muted uppercase">
                  · {lead.channel}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TakeLeadButton
              leadId={lead.id}
              alreadyAssigned={!!lead.assignedManagerId}
              isMine={isMine}
            />
            <ConvertLeadButton
              leadId={lead.id}
              defaultName={lead.contactName ?? ''}
              alreadyConverted={!!lead.clientId}
              clientId={lead.clientId}
            />
            <EditLeadButton
              lead={{
                id: lead.id,
                contactName: lead.contactName,
                contactPhone: lead.contactPhone,
                contactEmail: lead.contactEmail,
                requestedAddress: lead.requestedAddress,
                areaM2Estimate: lead.areaM2Estimate,
                message: lead.message,
                serviceTypes: services,
              }}
            />
            <DeleteLeadButton leadId={lead.id} isConverted={!!lead.clientId} />
          </div>
        </div>
      </div>

      {/* Блок «Не состоялась»: причина из enum + опциональный комментарий */}
      {lead.status === 'lost' && (
        <CyberpunkCard
          variant="default"
          hoverEffect={false}
          className="p-5 border-l-4 border-l-content-muted bg-content-muted/5"
        >
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-content-muted shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-orbitron tracking-wider text-content-muted uppercase mb-1">
                Лид не состоялся
              </div>
              <div className="text-base font-semibold text-content-primary">
                {lead.lostReasonCode
                  ? LEAD_LOST_REASON_LABELS[lead.lostReasonCode]
                  : 'Причина не указана'}
              </div>
              {lead.lostReason && lead.lostReason.trim().length > 0 && (
                <div className="mt-2 text-sm text-content-secondary whitespace-pre-wrap">
                  <span className="text-xs text-content-muted">Комментарий менеджера: </span>
                  {lead.lostReason}
                </div>
              )}
            </div>
          </div>
        </CyberpunkCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h2 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3 pb-2 border-b border-gray-200">
            Контакт
          </h2>
          <InfoRow icon={Phone} label="Телефон" value={lead.contactPhone} />
          <InfoRow icon={Mail} label="Email" value={lead.contactEmail} />
          <InfoRow icon={MapPin} label="Адрес" value={lead.requestedAddress} />
          <InfoRow icon={Calendar} label="Создана" value={dateFmt.format(lead.createdAt)} />
          <InfoRow
            icon={Calendar}
            label="Менеджер"
            value={row.managerName ?? <span className="text-content-muted italic">не назначен</span>}
          />
        </CyberpunkCard>

        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <h2 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-3 pb-2 border-b border-gray-200">
            Что хочет
          </h2>
          {services.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-orbitron tracking-wider text-content-muted uppercase mb-1.5">
                Услуги
              </div>
              <div className="flex flex-wrap gap-1.5">
                {services.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-orbitron font-semibold uppercase tracking-wider border bg-cyber-blue/10 text-cyber-blue border-cyber-blue/40"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {lead.areaM2Estimate && (
            <InfoRow icon={MapPin} label="Площадь" value={`${lead.areaM2Estimate} м²`} />
          )}
          <div className="mt-3">
            <div className="text-xs font-orbitron tracking-wider text-content-muted uppercase mb-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Сообщение
            </div>
            <p className="text-sm text-content-primary whitespace-pre-wrap">
              {lead.message && lead.message.length > 0 ? (
                lead.message
              ) : (
                <span className="text-content-muted">—</span>
              )}
            </p>
          </div>
        </CyberpunkCard>

        <CyberpunkCard variant="default" hoverEffect={false} className="p-5 lg:col-span-2">
          <LeadHistoryTimeline entries={history} currentStatus={lead.status} />
        </CyberpunkCard>

        {lead.rawPayload != null && typeof lead.rawPayload === 'object' && (
          <CyberpunkCard variant="default" hoverEffect={false} className="p-5 lg:col-span-2">
            <details>
              <summary className="cursor-pointer text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase pb-2 flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                Сырые данные с сайта (rawPayload)
              </summary>
              <pre className="text-xs text-content-secondary mt-3 bg-bg-tertiary p-3 rounded overflow-x-auto">
                {JSON.stringify(lead.rawPayload as Record<string, unknown>, null, 2)}
              </pre>
            </details>
          </CyberpunkCard>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2 text-sm">
      <Icon className="w-4 h-4 text-content-muted mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="text-[10px] font-orbitron tracking-wider text-content-muted uppercase">
          {label}
        </div>
        <div className="text-content-primary">
          {value && value !== '' ? value : <span className="text-content-muted">—</span>}
        </div>
      </div>
    </div>
  );
}
