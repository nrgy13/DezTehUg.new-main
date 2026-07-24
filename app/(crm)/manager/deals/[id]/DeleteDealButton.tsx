'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteDeal, getDealDeletionPreview, type DealContents } from '../actions';

/**
 * Удаление сделки. Нативный confirm() убран после ЧП 2026-07-24 (договор с 31
 * позицией прайса снесли промахом мыши мимо соседней «Сменить статус»).
 * Теперь: диалог показывает, ЧТО именно умрёт, и требует впечатать номер
 * договора руками. Непустую сделку менеджеру не отдаём — только админу.
 * Оба барьера продублированы на сервере, тут они лишь для удобства.
 */
export function DeleteDealButton({
  dealId,
  contractNumber,
  isAdmin,
}: {
  dealId: string;
  contractNumber: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [contents, setContents] = useState<DealContents | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Содержимое сделки подтягиваем на открытии — цифры всегда свежие.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setContents(null);
    setLoadError(null);
    getDealDeletionPreview(dealId).then((res) => {
      if (cancelled) return;
      if (res.ok) setContents(res.data.contents);
      else setLoadError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, dealId]);

  function reset() {
    setOpen(false);
    setTyped('');
    setContents(null);
    setLoadError(null);
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteDeal(dealId, typed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Сделка удалена');
      reset();
      router.push('/manager/deals');
      router.refresh();
    });
  }

  const isEmpty = contents !== null && contents.total === 0;
  // Пустой номер договора — подтверждать нечем (сервер тоже откажет).
  const noNumber = contractNumber.trim().length === 0;
  const blocked = contents !== null && ((contents.total > 0 && !isAdmin) || noNumber);
  const nameMatches = !noNumber && typed.trim() === contractNumber.trim();
  const canDelete = contents !== null && !blocked && nameMatches && !isPending;

  const rows = contents
    ? [
        { label: 'позиций прайса', n: contents.priceItems },
        { label: 'документов', n: contents.documents },
        { label: 'допсоглашений', n: contents.addendums },
        { label: 'выездов', n: contents.workLogs },
      ].filter((r) => r.n > 0)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-red-300/50 transition-colors"
        title="Удалить сделку"
      >
        <Trash2 className="w-4 h-4" />
        Удалить
      </button>

      {/* Пока удаление в полёте — диалог не закрываем (Escape в том числе). */}
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (v) setOpen(true);
          else if (!isPending) reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Удалить сделку «{contractNumber}»?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {contents === null && !loadError && (
                  <p className="flex items-center gap-2 text-content-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Считаю, что внутри сделки…
                  </p>
                )}

                {loadError && <p className="text-red-600">{loadError}</p>}

                {rows.length > 0 && (
                  <div className="rounded-md border border-red-300/60 bg-red-50 p-3">
                    <p className="font-medium text-red-700">
                      Внутри сделки есть данные — они будут уничтожены безвозвратно:
                    </p>
                    <ul className="mt-1.5 list-disc pl-5 text-red-700">
                      {rows.map((r) => (
                        <li key={r.label}>
                          <b>{r.n}</b> {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isEmpty && (
                  <p className="text-content-muted">
                    Сделка пустая — ни прайса, ни документов, ни выездов.
                  </p>
                )}

                {blocked ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                    {noNumber ? (
                      <>
                        У сделки <b>пустой номер договора</b> — подтвердить удаление
                        нечем. Впишите номер в «Реквизиты», потом удаляйте.
                      </>
                    ) : (
                      <>
                        Такую сделку удаляет <b>только администратор</b>. Обратитесь к
                        нему — так мы не потеряем вбитый прайс.
                      </>
                    )}
                  </p>
                ) : (
                  contents !== null && (
                    <div className="space-y-1.5">
                      <label className="block text-content-secondary">
                        Впечатайте номер договора{' '}
                        <b className="text-content-primary">{contractNumber}</b>, чтобы
                        подтвердить:
                      </label>
                      <input
                        autoFocus
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={contractNumber}
                        disabled={isPending}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  )
                )}

                <p className="text-content-muted">
                  Объекты клиента сохранятся — отвяжутся от договора, но не удалятся.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            {!blocked && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? 'Удаляю…' : 'Удалить безвозвратно'}
              </button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
