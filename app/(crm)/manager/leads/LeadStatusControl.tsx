'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { LeadStatus } from '@/lib/db/schema/leads';
import { LeadStatusBadge, LEAD_STATUS_LABELS } from '@/components/crm/LeadStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateLeadStatus } from './actions';

// qualified намеренно убран — устаревший статус, в UI не используется
const ALL: LeadStatus[] = [
  'new',
  'contacted',
  'proposal_sent',
  'contract_signed',
  'works_completed',
  'won',
  'lost',
];

export function LeadStatusControl({ leadId, initial }: { leadId: string; initial: LeadStatus }) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const change = (status: LeadStatus) => {
    if (status === current) return;
    startTransition(async () => {
      const res = await updateLeadStatus({ id: leadId, status });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrent(status);
      toast.success(`Статус: ${LEAD_STATUS_LABELS[status]}`);
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
          <LeadStatusBadge status={current} />
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        className="w-52 rounded-lg border-gray-200 bg-bg-primary shadow-xl p-1"
      >
        {ALL.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => change(s)}
            className={`cursor-pointer px-3 py-2 focus:bg-poison-green/10 ${
              s === current ? 'bg-neon-orange/5' : ''
            }`}
          >
            <LeadStatusBadge status={s} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
