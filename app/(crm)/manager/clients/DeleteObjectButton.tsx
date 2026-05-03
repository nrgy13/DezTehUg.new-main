'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Loader2 } from 'lucide-react';
import { removeObject } from './actions';

export function DeleteObjectButton({ objectId, objectName }: { objectId: string; objectName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Удалить объект «${objectName}»? Это действие нельзя отменить.`)) return;
    startTransition(async () => {
      const result = await removeObject(objectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Объект удалён');
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-xs text-content-muted hover:text-red-600 transition-colors disabled:opacity-50"
      title="Удалить объект"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );
}
