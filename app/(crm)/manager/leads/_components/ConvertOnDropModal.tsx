'use client';

import { useState } from 'react';
import { Loader2, Building2, User, X } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

export function ConvertOnDropModal({
  open,
  defaultName,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  defaultName: string;
  onClose: () => void;
  onSubmit: (input: { type: 'legal' | 'individual'; shortName: string; createDeal: boolean }) => void;
  isPending: boolean;
}) {
  const [type, setType] = useState<'legal' | 'individual'>('legal');
  const [shortName, setShortName] = useState(defaultName);
  const [createDeal, setCreateDeal] = useState(true);

  if (!open) return null;

  const submit = () => {
    const trimmed = shortName.trim();
    if (!trimmed) return;
    onSubmit({ type, shortName: trimmed, createDeal });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-bg-primary rounded-xl border border-gray-200 shadow-2xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-orbitron font-semibold tracking-wider text-content-primary uppercase">
            Лид выигран — создаём клиента
          </h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-content-muted mb-4">
          Реквизиты и адреса можно дозаполнить уже в карточке клиента.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
              Тип клиента
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('legal')}
                disabled={isPending}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm ${
                  type === 'legal'
                    ? 'border-neon-orange bg-neon-orange/5 text-neon-orange'
                    : 'border-gray-200 text-content-secondary hover:border-poison-green'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="font-orbitron uppercase tracking-wider text-xs">Юрлицо/ИП</span>
              </button>
              <button
                type="button"
                onClick={() => setType('individual')}
                disabled={isPending}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm ${
                  type === 'individual'
                    ? 'border-neon-orange bg-neon-orange/5 text-neon-orange'
                    : 'border-gray-200 text-content-secondary hover:border-poison-green'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="font-orbitron uppercase tracking-wider text-xs">Физлицо</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
              Название
            </label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder={type === 'legal' ? 'ООО «...»' : 'Иванов И.И.'}
              disabled={isPending}
              autoFocus
              className="h-11 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={createDeal}
              onChange={(e) => setCreateDeal(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 accent-neon-orange"
            />
            <span>Сразу создать draft-сделку и перейти в неё</span>
          </label>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <CyberpunkButton
            onClick={submit}
            disabled={isPending || !shortName.trim()}
            variant="primary"
            size="default"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Создаю…
              </>
            ) : (
              'Создать клиента'
            )}
          </CyberpunkButton>
          <CyberpunkButton onClick={onClose} variant="ghost" size="default" disabled={isPending}>
            Отмена
          </CyberpunkButton>
        </div>
      </div>
    </div>
  );
}
