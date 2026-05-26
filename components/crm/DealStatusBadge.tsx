import type { DealStatus } from '@/lib/db/schema/deals';

const STATUS_STYLE: Record<DealStatus, { bg: string; text: string; border: string; label: string }> = {
  draft: {
    bg: 'bg-gray-100',
    text: 'text-content-muted',
    border: 'border-gray-300',
    label: 'Черновик',
  },
  sent: {
    bg: 'bg-cyber-blue/10',
    text: 'text-cyber-blue',
    border: 'border-cyber-blue/40',
    label: 'Отправлен',
  },
  signed: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    border: 'border-violet-500/40',
    label: 'Подписан',
  },
  active: {
    bg: 'bg-neon-orange/10',
    text: 'text-neon-orange',
    border: 'border-neon-orange/40',
    label: 'В работе',
  },
  completed: {
    bg: 'bg-emerald-700/10',
    text: 'text-emerald-700',
    border: 'border-emerald-700/40',
    label: 'Выполнен',
  },
  terminated: {
    bg: 'bg-red-100',
    text: 'text-red-600',
    border: 'border-red-300',
    label: 'Расторгнут',
  },
};

export function DealStatusBadge({ status }: { status: DealStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-orbitron font-medium uppercase tracking-tight border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.label}
    </span>
  );
}

export const DEAL_STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_STYLE).map(([k, v]) => [k, v.label]),
) as Record<DealStatus, string>;

export const DEAL_STATUSES_ORDER: DealStatus[] = [
  'draft',
  'sent',
  'signed',
  'active',
  'completed',
  'terminated',
];
