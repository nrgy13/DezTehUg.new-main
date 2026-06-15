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

  function finish(res: Awaited<ReturnType<typeof deleteClient>>) {
    if (res.ok) {
      toast.success('Клиент удалён');
      router.push('/manager/clients');
      router.refresh();
      return;
    }
    // needsConfirm обрабатывается до этого; сюда попадают только ошибки.
    if (!('needsConfirm' in res)) toast.error(res.error);
  }

  function handleClick() {
    startTransition(async () => {
      // Шаг 1: пробный вызов — сервер сам решает, нужна ли цепочка подтверждений.
      const probe = await deleteClient(clientId);
      if (probe.ok) {
        finish(probe);
        return;
      }
      if ('needsConfirm' in probe) {
        if (!confirm(probe.message)) return;
        const forced = await deleteClient(clientId, { force: true });
        finish(forced);
        return;
      }
      // Нет зависимостей, но всё равно ошибка (напр. не найден / нет прав).
      toast.error(probe.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-red-300/50 disabled:opacity-50 transition-colors"
      title={`Удалить клиента «${clientName}»`}
    >
      <Trash2 className="w-4 h-4" />
      Удалить
    </button>
  );
}
