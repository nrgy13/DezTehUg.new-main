import type { ClientStatus, ClientType } from '@/lib/db/schema/clients';

const STATUS_STYLE: Record<ClientStatus, { bg: string; text: string; border: string; label: string }> = {
  lead: {
    bg: 'bg-electric-blue/10',
    text: 'text-electric-blue',
    border: 'border-electric-blue/40',
    label: 'Лид',
  },
  active: {
    bg: 'bg-poison-green/10',
    text: 'text-poison-green',
    border: 'border-poison-green/40',
    label: 'Активный',
  },
  inactive: {
    bg: 'bg-content-muted/10',
    text: 'text-content-muted',
    border: 'border-content-muted/40',
    label: 'Неактивный',
  },
  blocked: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-300',
    label: 'Заблокирован',
  },
};

const TYPE_LABEL: Record<ClientType, string> = {
  legal: 'Юрлицо',
  individual: 'Физлицо',
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-orbitron font-medium uppercase tracking-tight border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.label}
    </span>
  );
}

export function ClientTypeBadge({ type }: { type: ClientType }) {
  const isLegal = type === 'legal';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-orbitron font-medium uppercase tracking-tight border ${
        isLegal ? 'bg-cyber-blue/10 text-cyber-blue border-cyber-blue/40' : 'bg-neon-orange/10 text-neon-orange border-neon-orange/40'
      }`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}
