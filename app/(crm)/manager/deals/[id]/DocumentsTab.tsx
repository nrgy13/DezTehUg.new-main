'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  FileText,
  FileDown,
  FileX,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { sendDocumentToClient } from './send-document-action';
import { requestDocumentDeletion, cancelDeletionRequest } from '../actions';
import type { DocumentType, DocumentStatus, DeletionStatus } from '@/lib/db/schema/documents';

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  act_work: 'Акт работ',
  act_inspection: 'Акт обследования',
  invoice: 'Счёт',
  commercial_offer: 'Коммерческое предложение',
  other: 'Другой документ',
};

const STATUS_LABEL: Record<DocumentStatus, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'text-content-muted' },
  generated: { label: 'Сгенерирован', color: 'text-cyber-blue' },
  sent: { label: 'Отправлен', color: 'text-neon-orange' },
  signed: { label: 'Подписан', color: 'text-poison-green' },
  archived: { label: 'Архив', color: 'text-content-muted line-through' },
};

const GENERATABLE: DocumentType[] = [
  'contract',
  'commercial_offer',
  'act_inspection',
  'act_work',
  'invoice',
];

export type DocumentRow = {
  id: string;
  type: DocumentType;
  number: string | null;
  date: string | null;
  status: DocumentStatus;
  docxS3Key: string | null;
  pdfS3Key: string | null;
  createdAt: string;
  templateVersion: number | null;
  deletionStatus: DeletionStatus;
  deletionReason: string | null;
  deletionRequestedAt: string | null;
  deletionAdminNote: string | null;
  deletionResolvedAt: string | null;
  requesterName: string | null;
  resolverName: string | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DocumentsTab({
  dealId,
  documents,
  clientEmail,
}: {
  dealId: string;
  documents: DocumentRow[];
  clientEmail: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generatingType, setGeneratingType] = useState<DocumentType | null>(null);
  const [sendingDoc, setSendingDoc] = useState<DocumentRow | null>(null);
  const [requestingDoc, setRequestingDoc] = useState<DocumentRow | null>(null);

  function handleCancelRequest(doc: DocumentRow) {
    if (!confirm('Отменить запрос на удаление?')) return;
    startTransition(async () => {
      const res = await cancelDeletionRequest(doc.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Запрос отменён');
      router.refresh();
    });
  }

  function handleGenerate(type: DocumentType) {
    setGeneratingType(type);
    startTransition(async () => {
      try {
        const res = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, dealId, format: 'both' }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? `HTTP ${res.status}`);
          return;
        }
        toast.success(`${DOC_TYPE_LABEL[type]} ${json.data.number} готов`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка сети');
      } finally {
        setGeneratingType(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-content-muted">
          Сгенерировано: {documents.filter((d) => d.status !== 'archived').length}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <CyberpunkButton variant="primary" disabled={isPending}>
              {isPending && generatingType ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Генерируем {DOC_TYPE_LABEL[generatingType]}…
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-1" />
                  Сгенерировать
                  <ChevronDown className="w-3 h-3 ml-1" />
                </>
              )}
            </CyberpunkButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {GENERATABLE.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => handleGenerate(t)}>
                {DOC_TYPE_LABEL[t]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {documents.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-10 text-center">
          <FileX className="w-8 h-8 mx-auto mb-2 text-content-muted opacity-40" />
          <p className="text-sm text-content-muted">
            Документов пока нет. Нажми «Сгенерировать» чтобы создать первый.
          </p>
        </CyberpunkCard>
      ) : (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-secondary border-b border-gray-200">
              <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
                <th className="text-left px-4 py-3">Тип / Номер</th>
                <th className="text-left px-4 py-3 w-32">Дата</th>
                <th className="text-left px-4 py-3 w-32">Статус</th>
                <th className="text-right px-4 py-3 w-72">Файлы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((d) => {
                const isPendingDeletion = d.deletionStatus === 'pending';
                const isRejected = d.deletionStatus === 'rejected';
                return (
                  <Fragment key={d.id}>
                    <tr className={d.status === 'archived' ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-content-primary">
                          {DOC_TYPE_LABEL[d.type]}
                        </div>
                        <div className="text-xs text-content-muted font-mono">{d.number}</div>
                      </td>
                      <td className="px-4 py-3 text-content-secondary text-xs">
                        {d.date ? d.date.split('-').reverse().join('.') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={STATUS_LABEL[d.status]?.color ?? ''}>
                          {STATUS_LABEL[d.status]?.label ?? d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {d.docxS3Key && (
                          <a
                            href={`/api/documents/${d.id}/download?format=docx`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-neon-orange/40 text-neon-orange rounded hover:bg-neon-orange/10"
                          >
                            <FileDown className="w-3 h-3" />
                            DOCX
                          </a>
                        )}
                        {d.pdfS3Key && (
                          <a
                            href={`/api/documents/${d.id}/download?format=pdf`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-poison-green/40 text-poison-green rounded hover:bg-poison-green/10"
                          >
                            <FileDown className="w-3 h-3" />
                            PDF
                          </a>
                        )}
                        {d.status !== 'archived' && (d.docxS3Key || d.pdfS3Key) && (
                          <button
                            onClick={() => setSendingDoc(d)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-cyber-blue hover:text-cyber-blue/80"
                            title="Отправить клиенту"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        )}
                        {d.status !== 'archived' && !isPendingDeletion && (
                          <button
                            onClick={() => handleGenerate(d.type)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-content-muted hover:text-content-primary"
                            title="Перегенерировать"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                        {isPendingDeletion ? (
                          <button
                            onClick={() => handleCancelRequest(d)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-content-muted hover:text-content-primary disabled:opacity-50"
                            title="Отменить запрос на удаление"
                          >
                            <X className="w-3 h-3" />
                            Отменить
                          </button>
                        ) : (
                          <button
                            onClick={() => setRequestingDoc(d)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                            title="Запросить удаление документа"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isPendingDeletion && (
                      <tr className="bg-neon-orange/5 border-t-0">
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-start gap-2 text-xs text-content-secondary">
                            <AlertCircle className="w-3.5 h-3.5 text-neon-orange mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-neon-orange font-medium">
                                Запрошено удаление
                              </span>
                              {' · '}
                              <span>{d.requesterName ?? '—'}</span>
                              {d.deletionRequestedAt && (
                                <>
                                  {' · '}
                                  <span className="text-content-muted">
                                    {formatDateTime(d.deletionRequestedAt)}
                                  </span>
                                </>
                              )}
                              {d.deletionReason && (
                                <div className="text-content-muted mt-0.5 italic">
                                  «{d.deletionReason}»
                                </div>
                              )}
                              <div className="text-[10px] text-content-muted mt-0.5">
                                Ждёт решения админа в /admin/deletions
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {isRejected && d.deletionAdminNote && (
                      <tr className="bg-bg-secondary/40 border-t-0">
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-start gap-2 text-xs text-content-secondary">
                            <AlertCircle className="w-3.5 h-3.5 text-content-muted mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <span className="text-content-muted">
                                Удаление отклонено
                                {d.resolverName && ` (${d.resolverName})`}:
                              </span>{' '}
                              <span className="text-content-primary italic">
                                «{d.deletionAdminNote}»
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CyberpunkCard>
      )}

      {sendingDoc && (
        <SendDocumentDialog
          doc={sendingDoc}
          defaultEmail={clientEmail}
          onClose={() => setSendingDoc(null)}
          onSent={() => {
            setSendingDoc(null);
            router.refresh();
          }}
        />
      )}

      {requestingDoc && (
        <RequestDeletionDialog
          doc={requestingDoc}
          onClose={() => setRequestingDoc(null)}
          onRequested={() => {
            setRequestingDoc(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RequestDeletionDialog({
  doc,
  onClose,
  onRequested,
}: {
  doc: DocumentRow;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const docLabel = `${DOC_TYPE_LABEL[doc.type]} ${doc.number ?? ''}`.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await requestDocumentDeletion(doc.id, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Запрос отправлен — админ получит его в /admin/deletions');
      onRequested();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Запросить удаление
          </DialogTitle>
          <DialogDescription>
            «{docLabel}» — удаление выполнит админ после твоего запроса. Файлы DOCX/PDF и
            подписанный скан удалятся безвозвратно.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="deletion-reason">Причина удаления</Label>
            <Textarea
              id="deletion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: документ создан по ошибке (другой клиент); договор расторгнут до подписания; и т.п."
              rows={4}
              disabled={isPending}
              required
            />
            <div className="text-[10px] text-content-muted mt-1">
              Минимум 5 символов. Эту причину увидит админ.
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Отмена
            </button>
            <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Отправляю…' : 'Запросить удаление'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SendDocumentDialog({
  doc,
  defaultEmail,
  onClose,
  onSent,
}: {
  doc: DocumentRow;
  defaultEmail: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(defaultEmail ?? '');
  const [format, setFormat] = useState<'docx' | 'pdf'>(doc.pdfS3Key ? 'pdf' : 'docx');
  const [subject, setSubject] = useState(`Документ ${doc.number ?? ''} от ДезТехЮг`);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await sendDocumentToClient(doc.id, { to: to.trim(), subject, format });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.transport === 'noop'
          ? `Email замокан (MAILER_TRANSPORT=noop). Скачай и отправь руками.`
          : `Отправлено на ${to}`,
      );
      onSent();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Отправить документ клиенту
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="send-to">Email клиента</Label>
            <NeonInput
              id="send-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
              disabled={isPending}
              required
            />
            {!defaultEmail && (
              <p className="text-[10px] text-content-muted mt-1">
                У клиента не указан email — впиши вручную или дополни карточку клиента
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="send-subject">Тема</Label>
            <NeonInput
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div>
            <Label>Формат файла</Label>
            <div className="flex gap-2 mt-1">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="format"
                  value="docx"
                  checked={format === 'docx'}
                  onChange={() => setFormat('docx')}
                  disabled={isPending || !doc.docxS3Key}
                />
                DOCX
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                  disabled={isPending || !doc.pdfS3Key}
                />
                PDF
                {!doc.pdfS3Key && (
                  <span className="text-[10px] text-content-muted">(не сгенерирован)</span>
                )}
              </label>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Отмена
            </button>
            <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Отправка…' : 'Отправить'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
