'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { createDealFromClient } from '@/app/(crm)/manager/deals/actions';

export function CreateDealButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm('Создать новую сделку для этого клиента?')) return;
    startTransition(async () => {
      const res = await createDealFromClient(clientId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Сделка создана');
      router.push(`/manager/deals/${res.data.id}`);
    });
  }

  return (
    <CyberpunkButton variant="primary" size="default" onClick={handleClick} disabled={isPending}>
      <Plus className="w-4 h-4 mr-2" />
      {isPending ? 'Создаём…' : 'Создать сделку'}
    </CyberpunkButton>
  );
}
