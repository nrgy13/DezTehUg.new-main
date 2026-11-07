'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Clock, CheckCircle2, XCircle } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { mskLocalToUtcISO, utcToMskParts } from '@/lib/datetime/msk';
import type { RescheduleRequestView } from '@/lib/visits/reschedule-requests';
import { cancelWorkOrderReschedule, requestWorkOrderReschedule } from './reschedule-actions';

const fieldClass =
  'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none disabled:opacity-50';

/** Как на сервере (RESCHEDULE_REASON_MAX) — длиннее сервер не примет. */
const REASON_MAX = 1000;

/** ISO → 'ДД.ММ ЧЧ:ММ' по МСК (не зависит от TZ браузера — без расхождений при гидрации). */
function fmtMskShort(iso: string | null): string {
  if (!iso) return 'без даты';
  const p = utcToMskParts(iso);
  if (!p) return '—';
  const [, m, d] = p.date.split('-');
  return `${d}.${m} ${p.time}`;
}

/**
 * Мастер просит перенести запланированный наряд (11.2026): сам дату не меняет — менеджеру уходит
 * срочное уведомление, решение за ним. Новые дата и время — в МСК, причина обязательна.
 */
export function RescheduleRequestButton({
  workLogId,
  plannedAtIso,
  reasonMin = 10,
}: {
  workLogId: string;
  /** Текущее время выезда (UTC ISO); null — наряд без даты. */
  plannedAtIso: string | null;
  /** Минимум символов причины — с сервера (RESCHEDULE_REASON_MIN). */
  reasonMin?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const reasonLen = reason.trim().length;
  const reasonOk = reasonLen >= reasonMin;

  function openDialog() {
    const cur = plannedAtIso ? utcToMskParts(plannedAtIso) : null;
    const today = utcToMskParts(new Date())?.date;
    setDate(cur?.date ?? today ?? '');
    setTime(cur?.time ?? '09:00');
    setMinDate(today);
    setReason('');
    setOpen(true);
  }

  function submit() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      toast.error('Укажи новую дату и время');
      return;
    }
    const toAtIso = mskLocalToUtcISO(`${date}T${time}`);
    if (plannedAtIso && new Date(plannedAtIso).getTime() === new Date(toAtIso).getTime()) {
      toast.error('Это то же самое время — выбери другое');
      return;
    }
    if (new Date(toAtIso).getTime() < Date.now() - 60 * 60 * 1000) {
      toast.error('Новая дата уже прошла');
      return;
    }
    if (!reasonOk) {
      toast.error(`Напиши, почему переносишь (минимум ${reasonMin} символов)`);
      return;
    }
    startTransition(async () => {
      const res = await requestWorkOrderReschedule({ workLogId, toAtIso, reason: reason.trim() });
      if (res.ok) {
        toast.success('Запрос отправлен менеджеру. Пока не одобрит — наряд на старой дате.');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <CyberpunkButton
        variant="secondary"
        size="sm"
        onClick={openDialog}
        className="w-full sm:w-auto"
      >
        <CalendarClock className="w-4 h-4 mr-1.5" />
        Запросить перенос
      </CyberpunkButton>

      {open && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setOpen(false)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Запросить перенос</DialogTitle>
              <DialogDescription>
                Сейчас: {plannedAtIso ? `${fmtMskShort(plannedAtIso)} (МСК)` : 'без даты'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <Label htmlFor={`rr-date-${workLogId}`}>Новая дата</Label>
                <input
                  id={`rr-date-${workLogId}`}
                  type="date"
                  min={minDate}
                  className={fieldClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor={`rr-time-${workLogId}`}>Время (МСК)</Label>
                <input
                  id={`rr-time-${workLogId}`}
                  type="time"
                  step={60}
                  className={fieldClass}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="min-w-0">
              <Label htmlFor={`rr-reason-${workLogId}`}>Почему переносишь *</Label>
              <textarea
                id={`rr-reason-${workLogId}`}
                rows={3}
                maxLength={REASON_MAX}
                placeholder="например, клиент попросил перенести — на объекте ремонт до среды"
                className={cn(fieldClass, 'resize-y')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
              />
              <div
                className={cn(
                  'mt-1 text-[11px] text-right',
                  reasonOk ? 'text-emerald-700' : 'text-red-600',
                )}
              >
                {reasonOk
                  ? `${reasonLen} символов`
                  : `${reasonLen} / минимум ${reasonMin} символов`}
              </div>
            </div>
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Перенос одобряет менеджер. Пока не одобрит — наряд остаётся на старой дате.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <CyberpunkButton variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Отмена
              </CyberpunkButton>
              <CyberpunkButton onClick={submit} disabled={isPending || !reasonOk}>
                {isPending ? 'Отправляю…' : 'Отправить запрос'}
              </CyberpunkButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * Плашка со статусом последнего запроса на перенос (данные — latestRequestForWorkLog на сервере).
 * pending — «ждёт решения» + «Отозвать» (если запрос твой); rejected/approved — итог решения.
 */
export function RescheduleRequestStatus({
  request,
  workLogId,
  canCancel,
}: {
  request: RescheduleRequestView;
  workLogId: string;
  /** Отозвать может только тот, кто просил (сервер проверяет requested_by). */
  canCancel: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const res = await cancelWorkOrderReschedule(request.id, workLogId);
      if (res.ok) {
        toast.success('Запрос на перенос отозван');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (request.status === 'pending') {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div>
                Запрос на перенос на <b>{fmtMskShort(request.toAt)}</b> (МСК) отправлен, ждёт решения
                менеджера.
              </div>
              {!canCancel && (
                <div className="text-xs text-amber-800 mt-0.5">Запросил: {request.masterName}</div>
              )}
              <div className="text-xs text-amber-800 mt-0.5 [overflow-wrap:anywhere]">
                Причина: {request.reason}
              </div>
            </div>
          </div>
          {canCancel && (
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="self-start sm:self-center shrink-0 rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
            >
              {isPending ? 'Отзываю…' : 'Отозвать'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (request.status === 'rejected') {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
        <div className="flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0 [overflow-wrap:anywhere]">
            {request.decisionComment ? (
              <>
                Перенос отклонён: {request.decisionComment}
              </>
            ) : (
              <>Перенос отклонён — наряд остаётся на {fmtMskShort(request.fromAt)} (МСК).</>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (request.status === 'approved') {
    return (
      <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0 [overflow-wrap:anywhere]">
            Перенос одобрен — новая дата {fmtMskShort(request.toAt)} (МСК).
            {request.decisionComment && <> Комментарий: {request.decisionComment}</>}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
