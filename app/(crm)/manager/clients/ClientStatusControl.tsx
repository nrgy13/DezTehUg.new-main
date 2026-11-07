'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  CLIENT_REFUSAL_REASONS,
  type ClientRefusalReason,
  type ClientStatus,
} from '@/lib/db/schema/clients';
import { ClientStatusBadge } from '@/components/crm/ClientStatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { updateClientStatus } from './actions';

const ALL_STATUSES: ClientStatus[] = ['lead', 'active', 'inactive', 'blocked', 'refused'];
const STATUS_LABEL: Record<ClientStatus, string> = {
  lead: 'Лид',
  active: 'Активный',
  inactive: 'Неактивный',
  blocked: 'Заблокирован',
  refused: 'Отказался',
};

const fieldClass =
  'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none';

export function ClientStatusControl({
  clientId,
  initial,
  refusalReason,
  refusalComment,
}: {
  clientId: string;
  initial: ClientStatus;
  refusalReason?: string | null;
  refusalComment?: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  const [isPending, startTransition] = useTransition();
  // «Отказался» — только через диалог с причиной (для статистики отказов на дашборде).
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [reason, setReason] = useState<ClientRefusalReason | ''>('');
  const [comment, setComment] = useState('');

  const change = (
    status: ClientStatus,
    refusal?: { refusalReason: ClientRefusalReason; refusalComment: string },
  ) => {
    if (status === current && status !== 'refused') return;
    startTransition(async () => {
      const result = await updateClientStatus({ id: clientId, status, ...refusal });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(status);
      setRefuseOpen(false);
      toast.success(`Статус: ${STATUS_LABEL[status]}`);
      router.refresh();
    });
  };

  const openRefuse = () => {
    const known = refusalReason && refusalReason in CLIENT_REFUSAL_REASONS;
    setReason(known ? (refusalReason as ClientRefusalReason) : '');
    setComment(refusalComment ?? '');
    setRefuseOpen(true);
  };

  const submitRefuse = () => {
    if (!reason) {
      toast.error('Выбери причину отказа');
      return;
    }
    if (reason === 'other' && !comment.trim()) {
      toast.error('Для «Другое» напиши причину словами');
      return;
    }
    change('refused', { refusalReason: reason, refusalComment: comment.trim() });
  };

  const reasonLabel =
    current === 'refused' && refusalReason && refusalReason in CLIENT_REFUSAL_REASONS
      ? CLIENT_REFUSAL_REASONS[refusalReason as ClientRefusalReason]
      : null;

  // Radix: меню в портале, с обходом краёв экрана. Самодельное «absolute right-0» на телефоне
  // уезжало за левый край (кнопка стоит слева) — жалоба Регины 13.10.2026.
  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 hover:border-neon-orange transition-colors text-sm bg-bg-primary"
            >
              <ClientStatusBadge status={current} />
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3 text-content-muted" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            collisionPadding={8}
            className="w-48 rounded-lg border-gray-200 bg-bg-primary shadow-xl p-1"
          >
            {ALL_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => (s === 'refused' ? openRefuse() : change(s))}
                className={`cursor-pointer px-3 py-2 focus:bg-poison-green/10 ${
                  s === current ? 'bg-neon-orange/5' : ''
                }`}
              >
                <ClientStatusBadge status={s} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {reasonLabel && (
          <span className="text-xs text-amber-700" title={refusalComment ?? undefined}>
            Причина: {reasonLabel}
            {refusalComment ? ` — ${refusalComment}` : ''}
          </span>
        )}
      </div>

      {refuseOpen && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setRefuseOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Клиент отказался</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Причина</Label>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(CLIENT_REFUSAL_REASONS) as ClientRefusalReason[]).map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer ${
                        reason === r ? 'border-neon-orange bg-neon-orange/5' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`refusal-${clientId}`}
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        disabled={isPending}
                      />
                      {CLIENT_REFUSAL_REASONS[r]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor={`refusal-comment-${clientId}`}>
                  Комментарий{reason === 'other' ? ' (обязательно)' : ''}
                </Label>
                <textarea
                  id={`refusal-comment-${clientId}`}
                  className={`${fieldClass} min-h-[72px]`}
                  value={comment}
                  maxLength={1000}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Например: нашли дешевле у конкурента"
                  disabled={isPending}
                />
              </div>
              <p className="text-xs text-content-muted">
                Причина попадёт в статистику отказов на дашборде и в выгрузку для директора.
              </p>
            </div>
            <DialogFooter>
              <CyberpunkButton variant="outline" onClick={() => setRefuseOpen(false)} disabled={isPending}>
                Отмена
              </CyberpunkButton>
              <CyberpunkButton onClick={submitRefuse} disabled={isPending}>
                {isPending ? 'Сохраняю…' : 'Отметить отказ'}
              </CyberpunkButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
