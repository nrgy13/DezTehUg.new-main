'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Check, Trash2, Star, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { uploadTemplate, setTemplateActive, deleteTemplate } from './actions';
import type { DocumentType } from '@/lib/db/schema/documents';

const TYPE_LABEL: Record<DocumentType, string> = {
  contract: 'Договор',
  addendum: 'Доп. соглашение',
  act_work: 'Акт работ',
  act_inspection: 'Акт обследования',
  invoice: 'Счёт',
  commercial_offer: 'Коммерческое предложение',
  other: 'Другой документ',
};

const TYPE_ORDER: DocumentType[] = [
  'contract',
  'addendum',
  'commercial_offer',
  'invoice',
  'act_inspection',
  'act_work',
  'other',
];

export type TemplateRow = {
  id: string;
  type: DocumentType;
  name: string;
  description: string | null;
  s3Key: string;
  version: number;
  isActive: boolean;
  uploadedAt: string;
  uploaderName: string | null;
};

export function TemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [uploadType, setUploadType] = useState<DocumentType | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    items: templates.filter((tpl) => tpl.type === t),
  })).filter((g) => g.items.length > 0 || g.type !== 'other');

  function handleActivate(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const res = await setTemplateActive(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success('Шаблон активирован');
        router.refresh();
      }
      setPendingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить шаблон «${name}»?`)) return;
    setPendingId(id);
    startTransition(async () => {
      const res = await deleteTemplate(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success('Шаблон удалён');
        router.refresh();
      }
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <CyberpunkCard
          key={group.type}
          variant="default"
          hoverEffect={false}
          className="p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-orbitron font-semibold uppercase tracking-wider text-content-primary">
              {TYPE_LABEL[group.type]}
            </h2>
            <CyberpunkButton
              variant="primary"
              size="sm"
              onClick={() => setUploadType(group.type)}
            >
              <Upload className="w-3 h-3 mr-1" />
              Загрузить версию
            </CyberpunkButton>
          </div>

          {group.items.length === 0 ? (
            <p className="text-sm text-content-muted">Нет шаблонов. Загрузи DOCX.</p>
          ) : (
            <div className="space-y-2">
              {group.items
                .sort((a, b) => b.version - a.version)
                .map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                      tpl.isActive
                        ? 'border-poison-green/40 bg-poison-green/5'
                        : 'border-gray-200 bg-bg-secondary'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-content-primary">{tpl.name}</span>
                        <span className="text-[10px] font-orbitron tracking-wider text-content-muted">
                          v{tpl.version}
                        </span>
                        {tpl.isActive && (
                          <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-poison-green/20 text-poison-green font-orbitron uppercase">
                            <Check className="w-2.5 h-2.5" />
                            Активен
                          </span>
                        )}
                        {tpl.s3Key.startsWith('seed:') && (
                          <span className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyber-blue/10 text-cyber-blue font-orbitron uppercase">
                            <Star className="w-2.5 h-2.5" />
                            Базовый
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-content-muted mt-0.5">
                        Загружен {new Date(tpl.uploadedAt).toLocaleString('ru-RU')}
                        {tpl.uploaderName && ` · ${tpl.uploaderName}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!tpl.s3Key.startsWith('seed:') && (
                        <a
                          href={`/api/admin/templates/${tpl.id}/download`}
                          className="p-2 text-content-muted hover:text-content-primary"
                          title="Скачать DOCX"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {!tpl.isActive && (
                        <button
                          onClick={() => handleActivate(tpl.id)}
                          disabled={pendingId === tpl.id || isPending}
                          className="px-3 py-1 text-xs border border-poison-green/40 text-poison-green rounded hover:bg-poison-green/10 disabled:opacity-50"
                        >
                          Активировать
                        </button>
                      )}
                      {!tpl.isActive && !tpl.s3Key.startsWith('seed:') && (
                        <button
                          onClick={() => handleDelete(tpl.id, tpl.name)}
                          disabled={pendingId === tpl.id || isPending}
                          className="p-2 text-red-400 hover:text-red-600 disabled:opacity-50"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CyberpunkCard>
      ))}

      {uploadType && (
        <UploadDialog
          type={uploadType}
          onClose={() => setUploadType(null)}
          onUploaded={() => {
            setUploadType(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function UploadDialog({
  type,
  onClose,
  onUploaded,
}: {
  type: DocumentType;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [name, setName] = useState(`Кастомный: ${TYPE_LABEL[type]}`);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error('Выбери DOCX файл');
      return;
    }
    const fd = new FormData();
    fd.append('type', type);
    fd.append('name', name);
    fd.append('file', file);
    startTransition(async () => {
      const res = await uploadTemplate(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Шаблон загружен и активирован');
      onUploaded();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Загрузка шаблона: {TYPE_LABEL[type]}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tpl-name">Название</Label>
            <NeonInput
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div>
            <Label htmlFor="tpl-file">DOCX файл</Label>
            <input
              id="tpl-file"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isPending}
              required
              className="block w-full mt-1 text-sm file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-neon-orange/10 file:text-neon-orange file:cursor-pointer hover:file:bg-neon-orange/20"
            />
            <p className="text-[10px] text-content-muted mt-1">
              Файл проходит валидацию через docxtemplater. Битые шаблоны не загрузятся.
            </p>
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
              {isPending ? 'Загружаем…' : 'Загрузить и активировать'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
