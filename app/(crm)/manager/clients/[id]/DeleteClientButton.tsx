'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteClient } from '../actions';

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Удалить клиента «${clientName}» безвозвратно? Объекты клиента также будут удалены. Если есть сделки — удаление не выполнится.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteClient(clientId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Клиент удалён');
      router.push('/manager/clients');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-red-300/50 disabled:opacity-50 transition-colors"
      title="Удалить клиента"
    >
      <Trash2 className="w-4 h-4" />
      Удалить
    </button>
  );
}
