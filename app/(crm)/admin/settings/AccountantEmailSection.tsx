'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save, Trash2 } from 'lucide-react';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import {
  updateAccountantEmail,
  resetAccountantEmail,
} from './actions';

export function AccountantEmailSection({ initial }: { initial: string | null }) {
  const [email, setEmail] = useState(initial ?? '');
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await updateAccountantEmail(email.trim());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Email бухгалтера сохранён');
    });
  }

  function handleReset() {
    if (!confirm('Удалить email бухгалтера? Кнопка «Отправить буху» перестанет работать.')) return;
    startTransition(async () => {
      const res = await resetAccountantEmail();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEmail('');
      toast.success('Email бухгалтера удалён');
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-content-muted">
        На этот email уходят счета и УПД по кнопке «Отправить буху» в карточке сделки. Если пусто — кнопка не работает.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <NeonInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="buh@deztehyug.ru"
            disabled={isPending}
          />
        </div>
        <CyberpunkButton
          type="button"
          variant="primary"
          size="default"
          onClick={handleSave}
          disabled={isPending || email.trim().length === 0}
        >
          <Save className="w-4 h-4 mr-1" />
          Сохранить
        </CyberpunkButton>
        {initial && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md border border-red-300/50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Очистить
          </button>
        )}
      </div>
      {initial && (
        <p className="text-[11px] text-content-muted">
          Текущий email: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{initial}</code>
        </p>
      )}
    </div>
  );
}
