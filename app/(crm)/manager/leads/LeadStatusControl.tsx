'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { LeadStatus } from '@/lib/db/schema/leads';
import { LeadStatusBadge, LEAD_STATUS_LABELS } from '@/components/crm/LeadStatusBadge';
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
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const change = (status: LeadStatus) => {
    if (status === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await updateLeadStatus({ id: leadId, status });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrent(status);
      setOpen(false);
      toast.success(`Статус: ${LEAD_STATUS_LABELS[status]}`);
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
        <LeadStatusBadge status={current} />
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
      </button>
      {open && !isPending && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-gray-200 bg-bg-primary shadow-xl z-10 py-1">
          {ALL.map((s) => (
            <button
              key={s}
              onClick={() => change(s)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-poison-green/10 transition-colors ${
                s === current ? 'bg-neon-orange/5' : ''
              }`}
            >
              <LeadStatusBadge status={s} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
