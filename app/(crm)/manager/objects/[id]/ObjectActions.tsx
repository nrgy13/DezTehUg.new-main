'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, ClipboardList, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { removeObject } from '../../clients/actions';

type ActType = 'act_inspection' | 'act_work';

const ACT_LABEL: Record<ActType, string> = {
  act_inspection: 'Акт обследования',
  act_work: 'Акт выполненных работ',
};

export function ObjectActions({
  objectId,
  objectName,
  dealId,
  clientId,
}: {
  objectId: string;
  objectName: string;
  dealId: string | null;
  clientId: string;
}) {
  const router = useRouter();
  const [pendingType, setPendingType] = useState<ActType | null>(null);
  const [isDeleting, startDelete] = useTransition();

  async function generate(type: ActType) {
    if (!dealId) {
      toast.error('Объект не привязан к договору — привяжите его, чтобы формировать акты');
      return;
    }
    setPendingType(type);
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, dealId, objectId, format: 'both' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? `HTTP ${res.status}`);
        return;
      }
      toast.success(`${ACT_LABEL[type]} ${json.data.number} готов`);
      const url = json.data.pdfUrl ?? json.data.docxUrl;
      if (url) window.open(url, '_blank');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сети');
    } finally {
      setPendingType(null);
    }
  }

  function handleDelete() {
    if (!confirm(`Удалить объект «${objectName}»? Это действие нельзя отменить.`)) return;
    startDelete(async () => {
      let res = await removeObject(objectId);
      // Объект в прайсе/нарядах → второе подтверждение, затем форс-удаление.
      if (!res.ok && 'needsConfirm' in res && res.needsConfirm) {
        if (!confirm(res.message)) return;
        res = await removeObject(objectId, { force: true });
      }
      if (!res.ok) {
        toast.error('error' in res ? res.error : 'Не удалось удалить объект');
        return;
      }
      toast.success('Объект удалён');
      router.push(`/manager/clients/${clientId}?tab=objects`);
      router.refresh();
    });
  }

  const busy = pendingType !== null || isDeleting;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CyberpunkButton
        variant="primary"
        onClick={() => generate('act_inspection')}
        disabled={busy || !dealId}
        title={dealId ? undefined : 'Сначала привяжите объект к договору'}
      >
        {pendingType === 'act_inspection' ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <ClipboardCheck className="w-4 h-4 mr-1.5" />
        )}
        Сформировать АО
      </CyberpunkButton>
      <CyberpunkButton
        variant="secondary"
        onClick={() => generate('act_work')}
        disabled={busy || !dealId}
        title={dealId ? undefined : 'Сначала привяжите объект к договору'}
      >
        {pendingType === 'act_work' ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <ClipboardList className="w-4 h-4 mr-1.5" />
        )}
        Сформировать АВР
      </CyberpunkButton>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm text-content-muted hover:text-red-600 hover:bg-red-50 rounded-md border border-gray-200 disabled:opacity-50 transition-colors"
        title="Удалить объект"
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Удалить
      </button>
    </div>
  );
}
