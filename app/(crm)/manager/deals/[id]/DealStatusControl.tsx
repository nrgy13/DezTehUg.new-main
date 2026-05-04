'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { DEAL_STATUSES_ORDER, DEAL_STATUS_LABELS } from '@/components/crm/DealStatusBadge';
import { updateDealStatus } from '../actions';
import type { DealStatus } from '@/lib/db/schema/deals';

export function DealStatusControl({
  dealId,
  status,
}: {
  dealId: string;
  status: DealStatus;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: DealStatus) {
    if (next === status) return;
    startTransition(async () => {
      const res = await updateDealStatus(dealId, { status: next });
      if (!res.ok) toast.error(res.error);
      else toast.success(`Статус → ${DEAL_STATUS_LABELS[next]}`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CyberpunkButton variant="secondary" disabled={isPending}>
          {isPending ? 'Сохранение…' : 'Сменить статус'}
          <ChevronDown className="w-3 h-3 ml-1" />
        </CyberpunkButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {DEAL_STATUSES_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => handleChange(s)}
            disabled={s === status}
            className={s === status ? 'opacity-50' : ''}
          >
            {DEAL_STATUS_LABELS[s]}
            {s === status && <span className="ml-2 text-xs">(текущий)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
