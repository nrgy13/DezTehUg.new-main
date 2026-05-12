'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, CheckCheck, CalendarClock, FileText } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { acknowledgeNotification, acknowledgeAll } from './actions';
import type { InboxItem } from '@/lib/inbox/queries';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ACTION_LABEL: Record<string, { label: string; icon: typeof CalendarClock; color: string }> = {
  'deal.master_date_request': {
    label: 'Запрос переноса дат',
    icon: CalendarClock,
    color: 'text-cyber-blue',
  },
};

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
}

export function InboxClient({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAck(id: string) {
    startTransition(async () => {
      const res = await acknowledgeNotification(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Отмечено как прочитано');
      router.refresh();
    });
  }

  function handleAckAll() {
    if (!confirm(`Отметить все ${items.length} уведомлений как прочитанные?`)) return;
    startTransition(async () => {
      const res = await acknowledgeAll();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Все отмечены как прочитаны');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-content-muted">Активных: {items.length}</div>
        <button
          onClick={handleAckAll}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-content-secondary border border-border/40 rounded hover:bg-bg-card/40 hover:text-content-primary disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" />
          Отметить всё прочитанным
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <InboxCard key={item.id} item={item} onAck={handleAck} isPending={isPending} />
        ))}
      </div>
    </div>
  );
}

function InboxCard({
  item,
  onAck,
  isPending,
}: {
  item: InboxItem;
  onAck: (id: string) => void;
  isPending: boolean;
}) {
  const meta = ACTION_LABEL[item.action] ?? {
    label: item.action,
    icon: FileText,
    color: 'text-content-muted',
  };
  const Icon = meta.icon;
  const changes = item.changesJson;

  // Спец-рендер для master_date_request
  const isDateRequest = item.action === 'deal.master_date_request';
  const from = isDateRequest ? (changes?.from as { startDate?: string; endDate?: string } | undefined) : undefined;
  const to = isDateRequest ? (changes?.to as { startDate?: string; endDate?: string } | undefined) : undefined;
  const reason = isDateRequest ? (changes?.reason as string | undefined) : undefined;

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${meta.color} flex-shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium text-content-primary">{meta.label}</div>
            <div className="text-xs text-content-muted">{formatDateTime(item.createdAt)}</div>
          </div>

          <div className="text-xs text-content-secondary space-y-0.5">
            {item.dealNumber && item.dealId && (
              <div>
                Сделка:{' '}
                <Link
                  href={`/manager/deals/${item.dealId}`}
                  className="text-poison-green hover:underline font-mono"
                >
                  {item.dealNumber}
                </Link>
                {item.clientShortName && (
                  <span className="text-content-muted"> · {item.clientShortName}</span>
                )}
              </div>
            )}
            {item.fromUserName && (
              <div>
                От: <span className="text-content-primary">{item.fromUserName}</span>
              </div>
            )}
          </div>

          {isDateRequest && (
            <div className="bg-bg-secondary/60 rounded p-2 border border-border/40 text-xs space-y-1">
              <div>
                <span className="text-content-muted">Сейчас:</span>{' '}
                <span className="text-content-primary font-mono">
                  {fmtDate(from?.startDate)}
                  {from?.endDate && from.endDate !== from.startDate ? ` — ${fmtDate(from.endDate)}` : ''}
                </span>
              </div>
              <div>
                <span className="text-content-muted">Предлагает:</span>{' '}
                <span className="text-cyber-blue font-mono">
                  {fmtDate(to?.startDate)}
                  {to?.endDate && to.endDate !== to.startDate ? ` — ${fmtDate(to.endDate)}` : ''}
                </span>
              </div>
              {reason && (
                <div className="pt-1 border-t border-border/30">
                  <span className="text-content-muted">Причина:</span>{' '}
                  <span className="text-content-primary italic">{reason}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <CyberpunkButton
              variant="primary"
              onClick={() => onAck(item.id)}
              disabled={isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Прочитано
            </CyberpunkButton>
            {isDateRequest && item.dealId && (
              <Link
                href={`/manager/deals/${item.dealId}?tab=requisites`}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm text-content-secondary border border-border/40 rounded hover:bg-bg-card/40 hover:text-content-primary"
              >
                Открыть сделку →
              </Link>
            )}
          </div>
        </div>
      </div>
    </CyberpunkCard>
  );
}
