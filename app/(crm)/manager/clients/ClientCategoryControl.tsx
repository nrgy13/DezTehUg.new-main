'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { ClientCategory } from '@/lib/db/schema/clients';
import { ClientCategoryBadge } from '@/components/crm/ClientStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const change = (category: ClientCategory) => {
    if (category === current) return;
    startTransition(async () => {
      const result = await updateClientCategory({ id: clientId, category });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(category);
      toast.success(`Категория: ${CATEGORY_LABEL[category]}`);
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
          <ClientCategoryBadge category={current} />
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        className="w-48 rounded-lg border-gray-200 bg-bg-primary shadow-xl p-1"
      >
        {ALL_CATEGORIES.map((cat) => (
          <DropdownMenuItem
            key={cat}
            onSelect={() => change(cat)}
            className={`cursor-pointer px-3 py-2 focus:bg-poison-green/10 ${
              cat === current ? 'bg-neon-orange/5' : ''
            }`}
          >
            <ClientCategoryBadge category={cat} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
