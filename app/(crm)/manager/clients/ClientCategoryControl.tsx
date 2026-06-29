'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { ClientCategory } from '@/lib/db/schema/clients';
import { ClientCategoryBadge } from '@/components/crm/ClientStatusBadge';
import { updateClientCategory } from './actions';

const ALL_CATEGORIES: ClientCategory[] = ['new', 'old', 'permanent', 'tender'];
const CATEGORY_LABEL: Record<ClientCategory, string> = {
  new: 'Новый',
  old: 'Старый',
  permanent: 'Постоянный',
  tender: 'Тендер',
};

export function ClientCategoryControl({
  clientId,
  initial,
}: {
  clientId: string;
  initial: ClientCategory;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const change = (category: ClientCategory) => {
    if (category === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await updateClientCategory({ id: clientId, category });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(category);
      setOpen(false);
      toast.success(`Категория: ${CATEGORY_LABEL[category]}`);
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
        <ClientCategoryBadge category={current} />
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
      </button>
      {open && !isPending && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-bg-primary shadow-xl z-10 py-1">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => change(cat)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-poison-green/10 transition-colors ${
                cat === current ? 'bg-neon-orange/5' : ''
              }`}
            >
              <ClientCategoryBadge category={cat} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
