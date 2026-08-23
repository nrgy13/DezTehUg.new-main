'use client';

import { useState, useTransition } from 'react';
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
} from 'lucide-react';
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
import { ShareDocumentButton } from '@/components/crm/ShareDocumentButton';
import { sendDocumentToClient, sendDocumentToAccountant } from './send-document-action';
import { deleteDocument } from '../actions';
import type { DocumentType, DocumentStatus, DeletionStatus } from '@/lib/db/schema/documents';
import type { PriceItemUnit } from '@/lib/db/schema/deals';
import { unitLabel, formatQuantity } from '@/lib/constants/units';

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  act_work: 'Акт работ',
  act_inspection: 'Акт обследования',
  invoice: 'Счёт',
  commercial_offer: 'Коммерческое предложение',
  upd: 'УПД',
  other: 'Другой документ',
};

const ACCOUNTANT_TYPES: DocumentType[] = ['invoice', 'upd'];

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
  'upd',
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

export type PriceItemForDoc = {
  id: string;
  objectName: string | null;
  serviceName: string;
  areaM2: string;
  unit: PriceItemUnit;
  priceWithVat: number;
};

export function DocumentsTab({
  dealId,
  documents,
  clientEmail,
  priceItems,
}: {
  dealId: string;
  documents: DocumentRow[];
  clientEmail: string | null;
  priceItems: PriceItemForDoc[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sendingDoc, setSendingDoc] = useState<DocumentRow | null>(null);
  const [generatePending, setGeneratePending] = useState<DocumentType | null>(null);

  function handleDelete(doc: DocumentRow) {
    const label = `${DOC_TYPE_LABEL[doc.type]} ${doc.number ?? ''}`.trim();
    if (!confirm(`Удалить «${label}» безвозвратно? Файлы DOCX/PDF и скан подписи будут удалены из storage.`)) return;
    startTransition(async () => {
      const res = await deleteDocument(doc.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Документ удалён');
      router.refresh();
    });
  }

  function openGenerate(type: DocumentType) {
    setGeneratePending(type);
  }

  function handleSendToAccountant(doc: DocumentRow) {
    const label = `${DOC_TYPE_LABEL[doc.type]} ${doc.number ?? ''}`.trim();
    if (!confirm(`Отправить «${label}» на email бухгалтера ДезТехЮг?`)) return;
    startTransition(async () => {
      const res = await sendDocumentToAccountant(doc.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Отправлено бухгалтеру (${res.data.email})`);
      router.refresh();
    });
  }

  // Кнопки документа — ОДИН набор на две вёрстки (таблица + мобильные карточки),
  // чтобы действия не разъехались при будущих правках.
  function renderActions(d: DocumentRow) {
    return (
      <>
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
        {/* Системное «Поделиться». На iPhone ссылки выше открывают файл во
            встроенном просмотрщике без панели Safari — оттуда документ никуда
            не отправить. Кнопка сама решает, показываться ли: если браузер не
            умеет делиться файлами, она не рендерится. */}
        <ShareDocumentButton
          documentId={d.id}
          label={`${DOC_TYPE_LABEL[d.type]} ${d.number ?? ''}`.trim()}
          hasPdf={Boolean(d.pdfS3Key)}
          hasDocx={Boolean(d.docxS3Key)}
        />
        {d.status !== 'archived' && (d.docxS3Key || d.pdfS3Key) && (
          <button
            onClick={() => setSendingDoc(d)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-cyber-blue hover:text-cyber-blue/80"
            title="Отправить клиенту"
          >
            <Send className="w-3 h-3" />
          </button>
        )}
        {d.status !== 'archived' &&
          (d.docxS3Key || d.pdfS3Key) &&
          ACCOUNTANT_TYPES.includes(d.type) && (
            <button
              onClick={() => handleSendToAccountant(d)}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded disabled:opacity-50"
              title="Отправить бухгалтеру"
            >
              <Send className="w-3 h-3" />
              БУХ
            </button>
          )}
        {d.status !== 'archived' && (
          <button
            onClick={() => openGenerate(d.type)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-content-muted hover:text-content-primary"
            title="Перегенерировать"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={() => handleDelete(d)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
          title="Удалить документ безвозвратно"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </>
    );
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
              <FileText className="w-4 h-4 mr-1" />
              Сгенерировать
              <ChevronDown className="w-3 h-3 ml-1" />
            </CyberpunkButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {GENERATABLE.map((t) => (
              <DropdownMenuItem key={t} onSelect={() => openGenerate(t)}>
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
          {/* Desktop: таблица */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-bg-secondary border-b border-gray-200">
              <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
                <th className="text-left px-4 py-3">Тип / Номер</th>
                <th className="text-left px-4 py-3 w-32">Дата</th>
                <th className="text-left px-4 py-3 w-32">Статус</th>
                <th className="text-right px-4 py-3 w-72">Файлы</th>
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
                  <td className="px-4 py-3 text-right space-x-2">{renderActions(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: карточки. Таблица на телефоне не влезала (4 колонки, жёсткие
              ширины) и обрезалась обёрткой overflow-hidden — колонка с кнопками
              уезжала за край экрана без возможности доскроллить пальцем, поэтому
              документ нельзя было ни скачать, ни отправить с телефона. */}
          <div className="md:hidden divide-y divide-gray-100">
            {documents.map((d) => (
              <div
                key={d.id}
                className={`p-4 ${d.status === 'archived' ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-medium text-content-primary">
                    {DOC_TYPE_LABEL[d.type]}
                  </span>
                  <span className={`text-xs shrink-0 ${STATUS_LABEL[d.status]?.color ?? ''}`}>
                    {STATUS_LABEL[d.status]?.label ?? d.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-content-muted mb-3">
                  <span className="font-mono">{d.number}</span>
                  <span>·</span>
                  <span>{d.date ? d.date.split('-').reverse().join('.') : '—'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">{renderActions(d)}</div>
              </div>
            ))}
          </div>
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

      {generatePending && (
        <GenerateDocumentDialog
          dealId={dealId}
          type={generatePending}
          priceItems={priceItems}
          onClose={() => setGeneratePending(null)}
          onDone={() => {
            setGeneratePending(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function GenerateDocumentDialog({
  dealId,
  type,
  priceItems,
  onClose,
  onDone,
}: {
  dealId: string;
  type: DocumentType;
  priceItems: PriceItemForDoc[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(priceItems.map((p) => p.id)),
  );
  const [isPending, startTransition] = useTransition();

  const allSelected = priceItems.length > 0 && selectedIds.size === priceItems.length;
  const noneSelected = selectedIds.size === 0;

  // Группировка по объекту (null → «Без объекта»)
  const groups = new Map<string, PriceItemForDoc[]>();
  for (const pi of priceItems) {
    const key = pi.objectName ?? '— Без объекта —';
    const arr = groups.get(key) ?? [];
    arr.push(pi);
    groups.set(key, arr);
  }

  const selectedItems = priceItems.filter((p) => selectedIds.has(p.id));
  const totalSelected = selectedItems.reduce((s, p) => s + p.priceWithVat, 0);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(priceItems.map((p) => p.id)));
  }

  function handleSubmit() {
    // Если позиций нет — генерим без фильтра (могут быть док-ты без прайса, типа акт обследования).
    const priceItemIds = priceItems.length > 0 ? Array.from(selectedIds) : undefined;
    startTransition(async () => {
      try {
        const res = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, dealId, format: 'both', priceItemIds }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? `HTTP ${res.status}`);
          return;
        }
        toast.success(`${DOC_TYPE_LABEL[type]} ${json.data.number} готов`);
        onDone();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка сети');
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Сгенерировать «{DOC_TYPE_LABEL[type]}»
          </DialogTitle>
        </DialogHeader>

        {priceItems.length === 0 ? (
          <p className="text-sm text-content-muted">
            У сделки нет позиций прайса. Документ будет сгенерирован пустым шаблоном.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-cyber-blue hover:underline"
              >
                {allSelected ? 'Снять все' : 'Выбрать все'}
              </button>
              <span className="text-xs text-content-muted">
                Выбрано: {selectedIds.size} из {priceItems.length}
              </span>
            </div>

            <div className="max-h-[50vh] overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
              {Array.from(groups.entries()).map(([objectName, items]) => (
                <div key={objectName}>
                  <div className="px-3 py-1.5 bg-bg-secondary text-[11px] font-orbitron uppercase tracking-wide text-content-muted">
                    {objectName}
                  </div>
                  {items.map((p) => {
                    const unitLbl = unitLabel(p.unit);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary/40 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggle(p.id)}
                          disabled={isPending}
                          className="w-4 h-4 rounded border-gray-300 text-neon-orange focus:ring-neon-orange/40"
                        />
                        <span className="flex-1 text-content-primary">{p.serviceName}</span>
                        <span className="text-content-muted text-xs">
                          {formatQuantity(p.areaM2)} {unitLbl}
                        </span>
                        <span className="text-content-primary font-medium tabular-nums">
                          {p.priceWithVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-content-muted">Итого с НДС по выбранным:</span>
              <span className="font-orbitron font-bold text-content-primary tabular-nums">
                {totalSelected.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
          >
            Отмена
          </button>
          <CyberpunkButton
            type="button"
            variant="primary"
            disabled={isPending || (priceItems.length > 0 && noneSelected)}
            onClick={handleSubmit}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Генерация…
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-1" />
                Сгенерировать
              </>
            )}
          </CyberpunkButton>
        </DialogFooter>
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
