'use client';

import { Check, Users } from 'lucide-react';

/**
 * Выбор напарников для заказ-наряда (бригада, 10.2026). Плашки-переключатели по всем
 * мастерам, кроме основного: тап — добавить/убрать. Пустой выбор — наряд на одного.
 * Используется в форме наряда (WorkOrderDialog) и в диалоге «Бригада» (WorkOrderCrewButton).
 */
export function CrewPicker({
  masters,
  primaryId,
  value,
  onChange,
  disabled = false,
}: {
  masters: { id: string; fullName: string }[];
  /** Основной мастер наряда — в напарники его не предлагаем. */
  primaryId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const candidates = masters.filter((m) => m.id !== primaryId);
  if (candidates.length === 0) {
    return <p className="text-xs text-content-muted">Других мастеров нет — наряд на одного.</p>;
  }
  const selected = new Set(value.filter((id) => id !== primaryId));
  return (
    <div className="flex flex-wrap gap-2">
      {candidates.map((m) => {
        const on = selected.has(m.id);
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => {
              const next = new Set(selected);
              if (on) next.delete(m.id);
              else next.add(m.id);
              onChange(Array.from(next));
            }}
            className={`inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 text-sm rounded-full border transition-colors disabled:opacity-50 ${
              on
                ? 'bg-neon-orange text-white border-neon-orange'
                : 'bg-bg-primary text-content-secondary border-gray-300 hover:border-neon-orange'
            }`}
          >
            {on ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Users className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{m.fullName}</span>
          </button>
        );
      })}
    </div>
  );
}
