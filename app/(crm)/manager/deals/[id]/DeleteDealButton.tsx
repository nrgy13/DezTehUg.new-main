'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteDeal } from '../actions';

export function DeleteDealButton({
  dealId,
  contractNumber,
}: {
  dealId: string;
  contractNumber: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Удалить сделку «${contractNumber}» безвозвратно? Прайс, ДС, выезды и все документы сделки будут удалены. Объекты клиента сохранятся.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteDeal(dealId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Сделка удалена');
      router.push('/manager/deals');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-red-300/50 disabled:opacity-50 transition-colors"
      title="Удалить сделку"
    >
      <Trash2 className="w-4 h-4" />
      Удалить
    </button>
  );
}
