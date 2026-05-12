'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import {
  updateNotificationThresholds,
  resetNotificationThresholds,
} from './actions';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая заявка',
  contacted: 'Связались',
  qualified: 'Квалифицирована (legacy)',
  proposal_sent: 'КП отправлено',
  contract_signed: 'Договор подписан',
  works_completed: 'Работа реализована',
};

const STATUS_HINTS: Record<string, string> = {
  new: 'Заявка ждёт первого контакта',
  contacted: 'Контакт состоялся, ждём квалификации',
  qualified: 'Старая стадия — не используется в актуальной воронке',
  proposal_sent: 'КП у клиента, ждём решения',
  contract_signed: 'Договор подписан, ждём начала работ',
  works_completed: 'Работы выполнены, ждём оплату/закрытие',
};

type ThresholdsValue = Record<string, { warn: number; stale: number }>;

export function NotificationThresholdsSection({
  initial,
  defaults,
  isOverridden,
}: {
  initial: ThresholdsValue;
  defaults: ThresholdsValue;
  isOverridden: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<ThresholdsValue>(initial);

  function setOne(status: string, key: 'warn' | 'stale', val: number) {
    setValues((prev) => ({
      ...prev,
      [status]: { ...prev[status], [key]: val },
    }));
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateNotificationThresholds(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Пороги сохранены');
      router.refresh();
    });
  }

  function handleReset() {
    if (!confirm('Сбросить пороги к дефолтным значениям?')) return;
    startTransition(async () => {
      const res = await resetNotificationThresholds();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Сброшено к дефолтам');
      setValues(defaults);
      router.refresh();
    });
  }

  const hasChanges = Object.keys(values).some(
    (s) =>
      values[s]?.warn !== initial[s]?.warn || values[s]?.stale !== initial[s]?.stale,
  );

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted border-b border-gray-100">
            <th className="text-left py-2 pr-2">Стадия</th>
            <th className="text-center py-2 px-2 w-28">Warn (жёлтый)</th>
            <th className="text-center py-2 px-2 w-28">Stale (красный)</th>
            <th className="text-center py-2 pl-2 w-24">Дефолт</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.keys(values).map((status) => {
            const v = values[status];
            const def = defaults[status];
            const isCustom = v.warn !== def.warn || v.stale !== def.stale;
            return (
              <tr key={status}>
                <td className="py-2.5 pr-2">
                  <div className="text-content-primary font-medium">
                    {STATUS_LABELS[status] ?? status}
                  </div>
                  <div className="text-[10px] text-content-muted">
                    {STATUS_HINTS[status]}
                  </div>
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={v.warn}
                    onChange={(e) => setOne(status, 'warn', Number(e.target.value))}
                    className="w-full px-2 py-1 text-sm text-center bg-bg-secondary border border-border/40 rounded focus:border-poison-green focus:outline-none"
                    disabled={isPending}
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={v.stale}
                    onChange={(e) => setOne(status, 'stale', Number(e.target.value))}
                    className={`w-full px-2 py-1 text-sm text-center bg-bg-secondary border rounded focus:border-poison-green focus:outline-none ${
                      isCustom ? 'border-neon-orange/60' : 'border-border/40'
                    }`}
                    disabled={isPending}
                  />
                </td>
                <td className="py-2 pl-2 text-xs text-content-muted text-center font-mono">
                  {def.warn} / {def.stale}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-[11px] text-content-muted leading-snug">
        <strong>Warn</strong> — стадия начинает желтеть в канбане (есть индикатор, но
        ещё не критично). <strong>Stale</strong> — лид считается зависшим и попадает
        в утренний digest менеджеру. Cron `/api/cron/stuck-leads` использует
        порог stale.
      </p>

      <div className="flex gap-2">
        <CyberpunkButton
          variant="primary"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
        >
          <Save className="w-4 h-4 mr-1" />
          {isPending ? 'Сохраняю…' : hasChanges ? 'Сохранить' : 'Без изменений'}
        </CyberpunkButton>
        {isOverridden && (
          <button
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-content-secondary border border-border/40 rounded hover:bg-bg-card/40 hover:text-content-primary disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Сбросить к дефолту
          </button>
        )}
      </div>
    </div>
  );
}
