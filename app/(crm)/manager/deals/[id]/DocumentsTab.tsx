'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, FileText, FileDown, FileX, Loader2, RefreshCw, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { sendDocumentToClient } from './send-document-action';
import { deleteDocument } from '../actions';
import type { DocumentType, DocumentStatus } from '@/lib/db/schema/documents';

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
};

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(doc: DocumentRow) {
    const label = `${DOC_TYPE_LABEL[doc.type]} ${doc.number ?? ''}`.trim();
    if (
      !confirm(
        `Удалить документ «${label}»?\n\nФайлы DOCX/PDF и подписанный скан будут удалены безвозвратно.`,
      )
    ) {
      return;
    }
    setDeletingId(doc.id);
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(`«${label}» удалён`);
        router.refresh();
      }
      setDeletingId(null);
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
                <th className="text-right px-4 py-3 w-64">Файлы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((d) => (
                <tr key={d.id} className={d.status === 'archived' ? 'opacity-50' : ''}>
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
                    {d.status !== 'archived' && (
                      <button
                        onClick={() => handleGenerate(d.type)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-content-muted hover:text-content-primary"
                        title="Перегенерировать"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                      title="Удалить документ"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
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
    </div>
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
