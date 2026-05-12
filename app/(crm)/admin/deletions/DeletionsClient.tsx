'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { FileText, Trash2, X, Inbox, AlertCircle } from 'lucide-react';
import { approveDocumentDeletion, rejectDocumentDeletion } from './actions';

const DOC_TYPE_LABEL: Record<string, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  act_work: 'Акт работ',
  act_inspection: 'Акт обследования',
  invoice: 'Счёт',
  commercial_offer: 'Коммерческое предложение',
  other: 'Документ',
};

export type DeletionItem = {
  id: string;
  number: string | null;
  type: string;
  date: string | null;
  documentStatus: string;
  deletionStatus: 'pending' | 'rejected';
  requestedAt: string;
  reason: string;
  adminNote: string | null;
  resolvedAt: string | null;
  requesterName: string | null;
  resolverName: string | null;
  dealId: string | null;
  contractNumber: string | null;
  clientId: string | null;
  clientShortName: string | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DeletionsClient({ items }: { items: DeletionItem[] }) {
  const pending = items.filter((i) => i.deletionStatus === 'pending');
  const rejected = items.filter((i) => i.deletionStatus === 'rejected');

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-primary mb-3 uppercase">
          Ждут решения ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
            <Inbox className="w-8 h-8 mx-auto mb-2 text-content-muted opacity-40" />
            <p className="text-sm text-content-muted">
              Все запросы обработаны. Когда менеджер запросит удаление — карточки появятся здесь.
            </p>
          </CyberpunkCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pending.map((item) => (
              <PendingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {rejected.length > 0 && (
        <section>
          <h2 className="text-base font-orbitron font-semibold tracking-wider text-content-muted mb-3 uppercase">
            Отклонено за 30 дней ({rejected.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {rejected.map((item) => (
              <RejectedCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PendingCard({ item }: { item: DeletionItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const docLabel = `${DOC_TYPE_LABEL[item.type] ?? 'Документ'} ${item.number ?? ''}`.trim();

  function handleApprove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    startTransition(async () => {
      const res = await approveDocumentDeletion(item.id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmDelete(false);
        return;
      }
      toast.success(`«${docLabel}» удалён`);
      router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectDocumentDeletion(item.id, rejectNote);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Запрос отклонён');
      setRejectOpen(false);
      setRejectNote('');
      router.refresh();
    });
  }

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4 border-l-2 border-l-neon-orange/60">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-neon-orange flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="font-medium text-content-primary text-sm">{docLabel}</div>
            <div className="text-xs text-content-muted font-mono mt-0.5">
              {item.date ? item.date.split('-').reverse().join('.') : '—'} · статус документа:{' '}
              {item.documentStatus}
            </div>
          </div>

          <div className="text-xs text-content-secondary space-y-0.5">
            {item.contractNumber && item.dealId && (
              <div>
                Сделка:{' '}
                <Link
                  href={`/manager/deals/${item.dealId}`}
                  className="text-poison-green hover:underline font-mono"
                >
                  {item.contractNumber}
                </Link>
              </div>
            )}
            {item.clientShortName && item.clientId && (
              <div>
                Клиент:{' '}
                <Link
                  href={`/manager/clients/${item.clientId}`}
                  className="text-poison-green hover:underline"
                >
                  {item.clientShortName}
                </Link>
              </div>
            )}
            <div>
              Запросил: <span className="text-content-primary">{item.requesterName ?? '—'}</span>
              {' · '}
              <span className="text-content-muted">{formatDateTime(item.requestedAt)}</span>
            </div>
          </div>

          <div className="bg-bg-secondary/60 rounded p-2 border border-border/40">
            <div className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted mb-1">
              Причина
            </div>
            <div className="text-sm text-content-primary whitespace-pre-wrap">{item.reason}</div>
          </div>

          <div className="flex gap-2 pt-1">
            <CyberpunkButton
              variant="primary"
              onClick={handleApprove}
              disabled={isPending}
              className={confirmDelete ? '!bg-red-600 hover:!bg-red-700' : ''}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {isPending ? 'Удаляю…' : confirmDelete ? 'Точно удалить?' : 'Удалить'}
            </CyberpunkButton>
            <button
              onClick={() => setRejectOpen(true)}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-content-secondary border border-border/40 rounded hover:bg-bg-card/40 hover:text-content-primary disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Отклонить
            </button>
          </div>

          {confirmDelete && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50/50 rounded p-2 border border-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Жми «Точно удалить?» снова в течение 4 секунд. Файлы DOCX/PDF и подписанный
                скан удалятся безвозвратно.
              </span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-orbitron uppercase tracking-wide">
              Отклонить запрос
            </DialogTitle>
            <DialogDescription>
              «{docLabel}» останется в обращении. Объясни менеджеру почему.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Заметка для менеджера</Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Например: переведи в архив вместо удаления; документ нужен для отчёта; и т.п."
              rows={4}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              disabled={isPending}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Отмена
            </button>
            <CyberpunkButton
              variant="primary"
              onClick={handleReject}
              disabled={isPending || rejectNote.trim().length === 0}
            >
              {isPending ? 'Отклоняю…' : 'Отклонить запрос'}
            </CyberpunkButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CyberpunkCard>
  );
}

function RejectedCard({ item }: { item: DeletionItem }) {
  const docLabel = `${DOC_TYPE_LABEL[item.type] ?? 'Документ'} ${item.number ?? ''}`.trim();
  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4 opacity-75">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-content-muted flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-content-primary text-sm">{docLabel}</div>
            <span className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
              Отклонено
            </span>
          </div>
          <div className="text-xs text-content-secondary space-y-0.5">
            <div>
              Запросил: {item.requesterName ?? '—'} · {formatDateTime(item.requestedAt)}
            </div>
            {item.resolvedAt && item.resolverName && (
              <div>
                Отклонил: {item.resolverName} · {formatDateTime(item.resolvedAt)}
              </div>
            )}
          </div>
          <div className="bg-bg-secondary/60 rounded p-2 border border-border/40 text-xs">
            <span className="text-content-muted">Причина запроса:</span>{' '}
            <span className="text-content-primary">{item.reason}</span>
          </div>
          {item.adminNote && (
            <div className="bg-bg-secondary/60 rounded p-2 border border-border/40 text-xs">
              <span className="text-content-muted">Заметка админа:</span>{' '}
              <span className="text-content-primary">{item.adminNote}</span>
            </div>
          )}
        </div>
      </div>
    </CyberpunkCard>
  );
}
