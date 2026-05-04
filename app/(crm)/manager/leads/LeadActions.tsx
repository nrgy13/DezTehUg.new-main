'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserPlus, Repeat, Building2, User } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { takeLead, convertLeadToClient } from './actions';

export function TakeLeadButton({
  leadId,
  alreadyAssigned,
  isMine,
}: {
  leadId: string;
  alreadyAssigned: boolean;
  isMine: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const click = () => {
    startTransition(async () => {
      const res = await takeLead({ id: leadId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Лид взят в работу');
      router.refresh();
    });
  };

  if (isMine) return null;

  return (
    <CyberpunkButton
      variant={alreadyAssigned ? 'outline' : 'primary'}
      size="sm"
      onClick={click}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <UserPlus className="w-4 h-4 mr-2" />
      )}
      {alreadyAssigned ? 'Перехватить' : 'Взять в работу'}
    </CyberpunkButton>
  );
}

export function ConvertLeadButton({
  leadId,
  defaultName,
  alreadyConverted,
  clientId,
}: {
  leadId: string;
  defaultName: string;
  alreadyConverted: boolean;
  clientId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'legal' | 'individual'>('legal');
  const [shortName, setShortName] = useState(defaultName);
  // Default ON (согласовано с Саней): чтобы из лида одним кликом получить и клиента, и сделку
  const [createDeal, setCreateDeal] = useState(true);
  const [isPending, startTransition] = useTransition();

  if (alreadyConverted && clientId) {
    return (
      <CyberpunkButton href={`/manager/clients/${clientId}`} variant="outline" size="sm">
        <Repeat className="w-4 h-4 mr-2" />
        Перейти к клиенту
      </CyberpunkButton>
    );
  }

  const submit = () => {
    if (!shortName.trim()) {
      toast.error('Введите название клиента');
      return;
    }
    startTransition(async () => {
      const res = await convertLeadToClient({
        id: leadId,
        type,
        shortName: shortName.trim(),
        createDeal,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(createDeal ? 'Клиент и сделка созданы' : 'Клиент создан');
      // Если создали сделку — редиректим сразу в неё, иначе в карточку клиента
      router.push(
        res.data.dealId
          ? `/manager/deals/${res.data.dealId}`
          : `/manager/clients/${res.data.clientId}`,
      );
      router.refresh();
    });
  };

  return (
    <>
      <CyberpunkButton variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Repeat className="w-4 h-4 mr-2" />
        Конвертировать в клиента
      </CyberpunkButton>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-bg-primary rounded-xl border border-gray-200 shadow-2xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-1">
              Конвертация
            </h2>
            <p className="text-xs text-content-muted mb-4">
              Создаём клиента из заявки. Реквизиты и адреса можно дозаполнить в карточке.
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
              <CyberpunkButton onClick={submit} disabled={isPending} variant="primary" size="default">
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Создаю…
                  </>
                ) : (
                  'Создать клиента'
                )}
              </CyberpunkButton>
              <CyberpunkButton onClick={() => setOpen(false)} variant="ghost" size="default">
                Отмена
              </CyberpunkButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
