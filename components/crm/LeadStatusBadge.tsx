import type { LeadStatus } from '@/lib/db/schema/leads';

const STATUS_STYLE: Record<LeadStatus, { bg: string; text: string; border: string; label: string }> = {
  new: {
    bg: 'bg-electric-blue/10',
    text: 'text-electric-blue',
    border: 'border-electric-blue/40',
    label: 'Новая',
  },
  contacted: {
    bg: 'bg-cyber-blue/10',
    text: 'text-cyber-blue',
    border: 'border-cyber-blue/40',
    label: 'Связались',
  },
  // [DEPRECATED] qualified — оставлен для совместимости со старыми записями БД, в UI воронки не показывается
  qualified: {
    bg: 'bg-gray-100',
    text: 'text-content-muted',
    border: 'border-gray-300',
    label: 'Квалифицирована (устар.)',
  },
  proposal_sent: {
    bg: 'bg-neon-orange/10',
    text: 'text-neon-orange',
    border: 'border-neon-orange/40',
    label: 'КП отправлено',
  },
  contract_signed: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    border: 'border-violet-500/40',
    label: 'Договор подписан',
  },
  works_completed: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/40',
    label: 'Реализована',
  },
  won: {
    bg: 'bg-emerald-700/10',
    text: 'text-emerald-700',
    border: 'border-emerald-700/40',
    label: 'Оплата',
  },
  lost: {
    bg: 'bg-content-muted/10',
    text: 'text-content-muted',
    border: 'border-content-muted/40',
    label: 'Не состоялась',
  },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-orbitron font-medium uppercase tracking-tight border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.label}
    </span>
  );
}

export const LEAD_STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_STYLE).map(([k, v]) => [k, v.label])
) as Record<LeadStatus, string>;
