'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { utcToMskParts } from '@/lib/datetime/msk';
import type { RescheduleRequestView } from '@/lib/visits/reschedule-requests';
import { decideWorkOrderReschedule } from '@/app/(crm)/manager/reschedule-actions';

/** Как на сервере (RESCHEDULE_REASON_MAX / zod max(1000)). */
const COMMENT_MAX = 1000;

/** ISO → 'ДД.ММ.ГГГГ ЧЧ:ММ' по МСК (детерминированно — без расхождений при гидрации). */
function fmtMsk(iso: string | null): string {
  if (!iso) return 'без даты';
  const p = utcToMskParts(iso);
  if (!p) return '—';
  const [y, m, d] = p.date.split('-');
  return `${d}.${m}.${y} ${p.time}`;
}

/**
 * Запросы мастеров на перенос наряда (11.2026) — заметный блок на дашборде менеджера.
 * Одобрить — наряд переезжает на новую дату, бригаде push; отклонить — с необязательным
 * комментарием, мастеру push. Пустой список — ничего не рендерим.
 */
export function RescheduleRequestsPanel({ requests }: { requests: RescheduleRequestView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RescheduleRequestView | null>(null);
  const [comment, setComment] = useState('');

  if (requests.length === 0) return null;

  function decide(r: RescheduleRequestView, decision: 'approve' | 'reject', commentText?: string) {
    setBusyId(r.id);
    startTransition(async () => {
      const res = await decideWorkOrderReschedule({
        requestId: r.id,
        decision,
        comment: commentText?.trim() || null,
      });
      setBusyId(null);
      if (res.ok) {
        toast.success(
          decision === 'approve'
            ? `Перенос одобрен: ${fmtMsk(r.toAt)} (МСК) — бригаде ушёл push`
            : 'Перенос отклонён — мастеру ушёл push',
        );
        setRejecting(null);
        setComment('');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="rounded-lg border-2 border-red-300 bg-red-50/70 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-orbitron font-semibold tracking-wider text-red-700 uppercase mb-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        Запросы на перенос: {requests.length}
      </h2>

      <div className="space-y-3">
        {requests.map((r) => {
          const busy = isPending && busyId === r.id;
          const where = [r.objectName, r.objectAddress ? `(${r.objectAddress})` : null]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={r.id}
              className="rounded-md border border-red-200 bg-bg-primary p-3 sm:p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold text-content-primary break-words">{r.masterName}</span>
                <span className="text-[11px] text-content-muted">запрошено {fmtMsk(r.createdAt)}</span>
              </div>

              <div className="mt-1 text-content-secondary [overflow-wrap:anywhere]">
                <Link
                  href={`/manager/deals/${r.dealId}`}
                  className="text-content-primary hover:text-neon-orange"
                >
                  {r.clientName}
                </Link>
                {where && <> · {where}</>}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs sm:text-sm">
                <span className="text-content-muted line-through decoration-content-muted/60">
                  {fmtMsk(r.fromAt)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="font-semibold text-red-700">{fmtMsk(r.toAt)}</span>
                <span className="text-content-muted font-sans text-[11px]">МСК</span>
              </div>

              <div className="mt-2 rounded border border-gray-200 bg-bg-secondary/60 px-2.5 py-1.5 text-content-primary whitespace-pre-wrap [overflow-wrap:anywhere]">
                <span className="text-content-muted">Причина: </span>
                {r.reason}
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <CyberpunkButton
                  size="sm"
                  onClick={() => decide(r, 'approve')}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <Check className="w-4 h-4 mr-1" />
                  {busy && !rejecting ? 'Одобряю…' : 'Одобрить'}
                </CyberpunkButton>
                <CyberpunkButton
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setComment('');
                    setRejecting(r);
                  }}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <X className="w-4 h-4 mr-1" />
                  Отклонить
                </CyberpunkButton>
              </div>
            </div>
          );
        })}
      </div>

      {rejecting && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setRejecting(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Отклонить перенос</DialogTitle>
              <DialogDescription>
                {rejecting.masterName}: {fmtMsk(rejecting.fromAt)} → {fmtMsk(rejecting.toAt)} (МСК). Наряд
                останется на старой дате.
              </DialogDescription>
            </DialogHeader>
            <div className="min-w-0">
              <Label htmlFor={`rr-reject-${rejecting.id}`}>Комментарий мастеру (необязательно)</Label>
              <textarea
                id={`rr-reject-${rejecting.id}`}
                rows={3}
                maxLength={COMMENT_MAX}
                placeholder="например, клиент ждёт именно в этот день — договорись с напарником"
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none resize-y disabled:opacity-50"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isPending}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <CyberpunkButton variant="outline" onClick={() => setRejecting(null)} disabled={isPending}>
                Отмена
              </CyberpunkButton>
              <CyberpunkButton onClick={() => decide(rejecting, 'reject', comment)} disabled={isPending}>
                {isPending ? 'Отклоняю…' : 'Отклонить'}
              </CyberpunkButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
