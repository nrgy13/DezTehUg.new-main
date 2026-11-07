'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { cn } from '@/lib/utils';
import { deleteMasterRate, setMasterRate } from './actions';

/** Запись истории ставок — всё уже отформатировано на сервере (МСК). */
export type MasterRateView = {
  id: string;
  /** 'YYYY-MM-DD' — для сверки с датой в форме (upsert по (мастер, дата)). */
  effectiveFrom: string;
  effectiveFromLabel: string;
  percentLabel: string;
  minMonthlyLabel: string;
  note: string | null;
  createdLabel: string;
  createdByName: string | null;
  /** current — действует сегодня; future — запланирована; past — уже сменилась. */
  state: 'current' | 'future' | 'past';
};

type RateSummary = { percentLabel: string; minMonthlyLabel: string; fromLabel: string };

export type MasterView = {
  id: string;
  fullName: string;
  contact: string | null;
  isActive: boolean;
  /** Ставка на сегодня (МСК); null — не задана. */
  current: (RateSummary & { percent: string; minMonthly: string }) | null;
  /** Ближайшая будущая ставка, если запланирована. */
  upcoming: RateSummary | null;
  /** effectiveFrom DESC. */
  history: MasterRateView[];
};

const fieldClass =
  'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none disabled:opacity-50';

function fmtDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}.${m}.${y}`;
}

function parseNum(v: string): number | null {
  const s = v.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Карточка мастера на «Мастера и ставки»: текущая ставка, история с удалением,
 * форма новой ставки (upsert по дате начала действия — сервер setMasterRate).
 */
export function MasterRateCard({ master, defaultFrom }: { master: MasterView; defaultFrom: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ─── Форма новой ставки ───
  const [formOpen, setFormOpen] = useState(false);
  const [percent, setPercent] = useState('');
  const [minMonthly, setMinMonthly] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(defaultFrom);
  const [note, setNote] = useState('');

  // ─── Удаление ставки ───
  const [toDelete, setToDelete] = useState<MasterRateView | null>(null);

  function openForm() {
    // Чаще всего меняют только процент — подставляем действующие цифры.
    setPercent(master.current?.percent ?? '');
    setMinMonthly(master.current?.minMonthly ?? '');
    setEffectiveFrom(defaultFrom);
    setNote('');
    setFormOpen(true);
  }

  const sameDate = master.history.find((h) => h.effectiveFrom === effectiveFrom) ?? null;
  const backdated = /^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) && effectiveFrom < defaultFrom;

  function save() {
    const p = parseNum(percent);
    if (p === null || Number.isNaN(p) || p < 0 || p > 100) {
      toast.error('Процент — число от 0 до 100');
      return;
    }
    const mm = parseNum(minMonthly);
    if (mm !== null && (Number.isNaN(mm) || mm < 0)) {
      toast.error('Минималка — неотрицательное число (или пусто = 0)');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      toast.error('Укажи дату, с которой действует ставка');
      return;
    }
    startTransition(async () => {
      const res = await setMasterRate({
        userId: master.id,
        percent: String(p),
        minMonthly: mm === null ? null : String(mm),
        effectiveFrom,
        note: note.trim() || null,
      });
      if (res.ok) {
        toast.success(`Ставка «${master.fullName}» сохранена — действует с ${fmtDay(effectiveFrom)}`);
        setFormOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const rate = toDelete;
    startTransition(async () => {
      const res = await deleteMasterRate(rate.id);
      if (res.ok) {
        toast.success(`Ставка с ${rate.effectiveFromLabel} удалена`);
        setToDelete(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <CyberpunkCard
      variant="default"
      hoverEffect={false}
      className={cn('p-4 sm:p-5', !master.isActive && 'opacity-60')}
    >
      {/* Шапка: мастер + ставка на сегодня */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-content-primary break-words">
              {master.fullName}
            </h2>
            {!master.isActive && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-gray-300 text-content-muted">
                неактивен
              </span>
            )}
          </div>
          {master.contact && (
            <div className="text-xs text-content-muted break-all">{master.contact}</div>
          )}
          <div className="mt-2 text-sm">
            {master.current ? (
              <span className="text-content-secondary">
                <b className="text-content-primary">{master.current.percentLabel}</b> от наряда, минималка{' '}
                <b className="text-content-primary">{master.current.minMonthlyLabel}</b>/мес
                <span className="text-content-muted"> · с {master.current.fromLabel}</span>
              </span>
            ) : (
              <span className="font-medium text-red-600">Ставка не задана</span>
            )}
          </div>
          {master.upcoming && (
            <div className="mt-1 text-xs text-neon-orange">
              С {master.upcoming.fromLabel} — {master.upcoming.percentLabel}, минималка{' '}
              {master.upcoming.minMonthlyLabel}/мес
            </div>
          )}
        </div>
        <CyberpunkButton
          variant="secondary"
          size="sm"
          onClick={openForm}
          disabled={isPending}
          className="self-start shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          Новая ставка
        </CyberpunkButton>
      </div>

      {/* История ставок */}
      <div className="mt-4">
        <div className="text-xs font-orbitron tracking-wider text-content-muted uppercase mb-2">
          История ставок
        </div>
        {master.history.length === 0 ? (
          <p className="text-sm text-content-muted">Ставок ещё не было.</p>
        ) : (
          <>
            {/* Desktop: таблица */}
            <table className="hidden md:table w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
                  <th className="text-left px-2 py-2 w-40">С даты</th>
                  <th className="text-left px-2 py-2 w-20">%</th>
                  <th className="text-left px-2 py-2 w-36">Минималка/мес</th>
                  <th className="text-left px-2 py-2">Заметка</th>
                  <th className="text-left px-2 py-2 w-48">Задано</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {master.history.map((h) => (
                  <tr key={h.id} className={cn(h.state === 'past' && 'text-content-muted')}>
                    <td className="px-2 py-2">
                      <span className="font-mono text-xs">{h.effectiveFromLabel}</span>
                      <StateBadge state={h.state} />
                    </td>
                    <td className="px-2 py-2 font-medium">{h.percentLabel}</td>
                    <td className="px-2 py-2">{h.minMonthlyLabel}</td>
                    <td className="px-2 py-2 text-xs [overflow-wrap:anywhere]">
                      {h.note || <span className="text-content-muted">—</span>}
                    </td>
                    <td className="px-2 py-2 text-xs text-content-muted">
                      {h.createdLabel}
                      {h.createdByName && <div className="truncate">{h.createdByName}</div>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <DeleteRateButton onClick={() => setToDelete(h)} disabled={isPending} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: карточки */}
            <div className="md:hidden divide-y divide-gray-100 border-t border-gray-100">
              {master.history.map((h) => (
                <div
                  key={h.id}
                  className={cn('py-2.5 text-sm', h.state === 'past' && 'text-content-muted')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs">с {h.effectiveFromLabel}</span>
                      <StateBadge state={h.state} />
                      <div className="mt-0.5">
                        <b className={cn(h.state !== 'past' && 'text-content-primary')}>{h.percentLabel}</b>{' '}
                        от наряда · минималка {h.minMonthlyLabel}/мес
                      </div>
                    </div>
                    <DeleteRateButton onClick={() => setToDelete(h)} disabled={isPending} />
                  </div>
                  {h.note && <div className="mt-1 text-xs [overflow-wrap:anywhere]">{h.note}</div>}
                  <div className="mt-1 text-[11px] text-content-muted">
                    задано {h.createdLabel}
                    {h.createdByName && ` · ${h.createdByName}`}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Диалог новой ставки */}
      {formOpen && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setFormOpen(false)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Новая ставка</DialogTitle>
              <DialogDescription>{master.fullName}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="min-w-0">
                <Label htmlFor={`rate-pct-${master.id}`}>Процент, %</Label>
                <input
                  id={`rate-pct-${master.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="например, 30"
                  className={fieldClass}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor={`rate-min-${master.id}`}>Минималка, ₽/мес</Label>
                <input
                  id={`rate-min-${master.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  className={fieldClass}
                  value={minMonthly}
                  onChange={(e) => setMinMonthly(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor={`rate-from-${master.id}`}>Действует с</Label>
                <input
                  id={`rate-from-${master.id}`}
                  type="date"
                  className={fieldClass}
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="min-w-0">
              <Label htmlFor={`rate-note-${master.id}`}>Заметка (необязательно)</Label>
              <textarea
                id={`rate-note-${master.id}`}
                rows={2}
                maxLength={500}
                placeholder="например, повышение с декабря по договорённости"
                className={cn(fieldClass, 'resize-y')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
              />
            </div>
            {sameDate && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                С {sameDate.effectiveFromLabel} ставка уже есть ({sameDate.percentLabel}, минималка{' '}
                {sameDate.minMonthlyLabel}) — она будет заменена новой.
              </p>
            )}
            {backdated && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Дата раньше текущего месяца — начисления за месяцы начиная с {fmtDay(effectiveFrom)}{' '}
                пересчитаются по этой ставке.
              </p>
            )}
            <p className="text-xs text-content-muted">
              Ставка действует с указанной даты до следующей. Пустая минималка = 0 ₽.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <CyberpunkButton variant="outline" onClick={() => setFormOpen(false)} disabled={isPending}>
                Отмена
              </CyberpunkButton>
              <CyberpunkButton onClick={save} disabled={isPending}>
                {isPending ? 'Сохраняю…' : 'Сохранить'}
              </CyberpunkButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Подтверждение удаления ставки (не нативный confirm) */}
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(v) => {
          if (!v && !isPending) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Удалить ставку?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {toDelete && (
                  <p className="text-content-primary">
                    {master.fullName}: с {toDelete.effectiveFromLabel} — {toDelete.percentLabel}, минималка{' '}
                    {toDelete.minMonthlyLabel}/мес.
                  </p>
                )}
                <p className="text-content-muted">
                  С этой даты снова будет действовать предыдущая ставка (а если её нет — «ставка не
                  задана», начисление 0 ₽). Суммы за затронутые месяцы пересчитаются.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? 'Удаляю…' : 'Удалить'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CyberpunkCard>
  );
}

function StateBadge({ state }: { state: MasterRateView['state'] }) {
  if (state === 'past') return null;
  return (
    <span
      className={cn(
        'ml-1.5 inline-block align-middle text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border',
        state === 'current'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-neon-orange/40 bg-neon-orange/10 text-neon-orange',
      )}
    >
      {state === 'current' ? 'действует' : 'запланирована'}
    </span>
  );
}

function DeleteRateButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 p-1.5 text-content-muted hover:text-red-600 hover:bg-red-50 rounded border border-gray-200 disabled:opacity-50"
      title="Удалить ставку"
      aria-label="Удалить ставку"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
