'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteDocument } from '../deals/actions';

/**
 * Удаление документа из общего списка /manager/documents. Та же логика, что и в
 * табе «Документы» карточки сделки (прямое deleteDocument, права manager/admin,
 * Sprint 8): подтверждение → удаление файлов из storage + записи → refresh.
 */
export function DeleteDocumentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Удалить «${label}» безвозвратно? Файлы DOCX/PDF и скан подписи будут удалены из storage.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteDocument(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Документ удалён');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
      title="Удалить документ безвозвратно"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      Удалить
    </button>
  );
}
