'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { WorkOrderDialog } from '@/components/crm/WorkOrderDialog';
import {
  closeWorkOrderByManager,
  getWorkOrderEditData,
  type WorkOrderEditData,
} from '@/app/(crm)/manager/calendar/work-order-edit-actions';

type EditLoaded = Extract<WorkOrderEditData, { ok: true }>;

const iconBtn =
  'p-1.5 text-content-muted hover:text-neon-orange hover:bg-neon-orange/10 rounded border border-gray-200 disabled:opacity-50';
const textBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-300 text-content-secondary hover:border-neon-orange hover:text-neon-orange disabled:opacity-50';

/** Ссылка на карточку наряда менеджера (всё по наряду + правка/закрытие). */
export function WorkOrderOpenLink({ workLogId }: { workLogId: string }) {
  return (
    <Link
      href={`/manager/visits/${workLogId}`}
      className={iconBtn}
      title="Открыть наряд: всё по наряду, фото, журнал, правка"
      aria-label="Открыть наряд"
    >
      <Eye className="w-3.5 h-3.5" />
    </Link>
  );
}

/**
 * «Редактировать наряд» (менеджер, ЛЮБОЙ статус, запрос Регины 07.11.2026): данные наряда
 * грузятся при открытии, форма — общая WorkOrderDialog в режиме правки.
 */
export function WorkOrderEditButton({
  workLogId,
  variant = 'icon',
}: {
  workLogId: string;
  variant?: 'icon' | 'button';
}) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<EditLoaded | null>(null);

  async function open() {
    setLoading(true);
    try {
      const res = await getWorkOrderEditData(workLogId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLoaded(res);
    } catch {
      toast.error('Не удалось загрузить наряд');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className={variant === 'icon' ? iconBtn : textBtn}
        title="Редактировать наряд: дата, мастер, услуги, цены, препараты, чеклист"
        aria-label="Редактировать наряд"
      >
        {loading ? (
          <Loader2 className={variant === 'icon' ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} />
        ) : (
          <Pencil className={variant === 'icon' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        )}
        {variant === 'button' && 'Редактировать'}
      </button>
      {loaded && (
        <WorkOrderDialog
          data={loaded.formData}
          editPrefill={loaded.prefill}
          onClose={() => setLoaded(null)}
        />
      )}
    </>
  );
}

/**
 * «Закрыть наряд» (менеджер): запланированный или в работе → выполнен, без обязательных
 * пунктов чеклиста. Комментарий по желанию — в журнал и в push бригаде.
 */
export function WorkOrderCloseButton({
  workLogId,
  status,
  variant = 'icon',
}: {
  workLogId: string;
  status: 'planned' | 'in_progress' | 'completed';
  variant?: 'icon' | 'button';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [isPending, startTransition] = useTransition();

  if (status === 'completed') return null;

  function confirm() {
    startTransition(async () => {
      const res = await closeWorkOrderByManager({ workLogId, comment: comment.trim() || null });
      if (res.ok) {
        toast.success('Наряд закрыт — ушёл в историю, бригаде отправлено уведомление');
        setOpen(false);
        setComment('');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === 'icon' ? iconBtn : textBtn}
        title="Закрыть наряд (отметить выполненным)"
        aria-label="Закрыть наряд"
      >
        <CheckCircle2 className={variant === 'icon' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        {variant === 'button' && 'Закрыть наряд'}
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">
                Закрыть наряд
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-content-secondary">
                {status === 'in_progress'
                  ? 'Мастер в работе. Наряд станет выполненным и уйдёт в историю.'
                  : 'Наряд ещё не начат. Он станет выполненным и уйдёт в историю.'}{' '}
                Обязательные пункты чеклиста не требуются. Дата наряда не меняется.
              </p>
              <div>
                <label htmlFor="wo-close-comment" className="text-xs text-content-muted">
                  Комментарий (необязательно) — увидят в журнале и бригада в уведомлении
                </label>
                <textarea
                  id="wo-close-comment"
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
                  placeholder="Напр.: работы выполнены, мастер не закрыл в приложении"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
              >
                Отмена
              </button>
              <CyberpunkButton variant="primary" onClick={() => confirm()} disabled={isPending}>
                {isPending ? 'Закрываю…' : 'Закрыть наряд'}
              </CyberpunkButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
