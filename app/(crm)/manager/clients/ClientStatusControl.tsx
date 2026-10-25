'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { ClientStatus } from '@/lib/db/schema/clients';
import { ClientStatusBadge } from '@/components/crm/ClientStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const change = (status: ClientStatus) => {
    if (status === current) return;
    startTransition(async () => {
      const result = await updateClientStatus({ id: clientId, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(status);
      toast.success(`Статус: ${STATUS_LABEL[status]}`);
      router.refresh();
    });
  };

  // Radix: меню в портале, с обходом краёв экрана. Самодельное «absolute right-0» на телефоне
  // уезжало за левый край (кнопка стоит слева) — жалоба Регины 13.10.2026.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 hover:border-neon-orange transition-colors text-sm bg-bg-primary"
        >
          <ClientStatusBadge status={current} />
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        className="w-48 rounded-lg border-gray-200 bg-bg-primary shadow-xl p-1"
      >
        {ALL_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => change(s)}
            className={`cursor-pointer px-3 py-2 focus:bg-poison-green/10 ${
              s === current ? 'bg-neon-orange/5' : ''
            }`}
          >
            <ClientStatusBadge status={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
