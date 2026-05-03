'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { ClientStatus } from '@/lib/db/schema/clients';
import { ClientStatusBadge } from '@/components/crm/ClientStatusBadge';
import { updateClientStatus } from './actions';

const ALL_STATUSES: ClientStatus[] = ['lead', 'active', 'inactive', 'blocked'];
const STATUS_LABEL: Record<ClientStatus, string> = {
  lead: 'Лид',
  active: 'Активный',
  inactive: 'Неактивный',
  blocked: 'Заблокирован',
};

export function ClientStatusControl({
  clientId,
  initial,
}: {
  clientId: string;
  initial: ClientStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const change = (status: ClientStatus) => {
    if (status === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await updateClientStatus({ id: clientId, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(status);
      setOpen(false);
      toast.success(`Статус: ${STATUS_LABEL[status]}`);
      router.refresh();
    });
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 hover:border-neon-orange transition-colors text-sm bg-bg-primary"
      >
        <ClientStatusBadge status={current} />
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
      </button>
      {open && !isPending && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-bg-primary shadow-xl z-10 py-1">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => change(s)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-poison-green/10 transition-colors ${
                s === current ? 'bg-neon-orange/5' : ''
              }`}
            >
              <ClientStatusBadge status={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
