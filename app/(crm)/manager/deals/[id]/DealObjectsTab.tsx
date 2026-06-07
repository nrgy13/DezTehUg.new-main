'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Link2, Unlink, CalendarClock, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { formatQuantity } from '@/lib/constants/units';
import { attachObjectToDeal } from '../../clients/actions';

type ObjectService = { label: string; method: string | null; frequency: string | null };

type DealObject = {
  id: string;
  name: string;
  objectType: string | null;
  address: string;
  areaM2: string | null;
  plannedTreatmentDate: string | null;
  services: ObjectService[];
};

type Attachable = { id: string; name: string; address: string };

function formatDate(d: string | null): string {
  if (!d) return '—';
  // d — 'YYYY-MM-DD'
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export function DealObjectsTab({
  dealId,
  objects,
  attachable,
}: {
  dealId: string;
  objects: DealObject[];
  attachable: Attachable[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [attachId, setAttachId] = useState('');

  function handleAttach() {
    if (!attachId) return;
    startTransition(async () => {
      const res = await attachObjectToDeal(attachId, dealId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Объект привязан к договору');
      setAttachId('');
      router.refresh();
    });
  }

  function handleDetach(objectId: string, name: string) {
    if (!confirm(`Отвязать объект «${name}» от договора? Сам объект и его услуги сохранятся у клиента.`))
      return;
    startTransition(async () => {
      const res = await attachObjectToDeal(objectId, null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Объект отвязан');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-content-muted">
          Объекты этого договора. На их основе формируются акты (АО/АВР) и заявки мастерам.
        </p>
        <CyberpunkButton href={`/manager/deals/${dealId}/objects/new`} variant="primary">
          <Plus className="w-4 h-4 mr-1.5" />
          Добавить объект
        </CyberpunkButton>
      </div>

      {/* Привязать существующий объект клиента (временная функция миграции) */}
      {attachable.length > 0 && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Link2 className="w-4 h-4 text-poison-green flex-shrink-0" />
            <span className="text-xs font-orbitron uppercase tracking-wider text-content-muted">
              Привязать существующий объект
            </span>
            <select
              value={attachId}
              onChange={(e) => setAttachId(e.target.value)}
              className="flex-1 rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none"
            >
              <option value="">— выберите объект клиента —</option>
              {attachable.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.address}
                </option>
              ))}
            </select>
            <CyberpunkButton onClick={handleAttach} disabled={!attachId || isPending} variant="ghost">
              Привязать
            </CyberpunkButton>
          </div>
        </CyberpunkCard>
      )}

      {objects.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-8 text-center">
          <MapPin className="w-8 h-8 text-content-muted mx-auto mb-2" />
          <p className="text-sm text-content-muted">
            К договору пока не привязан ни один объект. Добавьте объект — он станет основанием
            для актов и заявок мастерам.
          </p>
        </CyberpunkCard>
      ) : (
        <div className="space-y-2">
          {objects.map((o) => (
            <CyberpunkCard key={o.id} variant="default" hoverEffect={false} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link
                    href={`/manager/objects/${o.id}`}
                    className="text-sm font-medium text-content-primary hover:text-neon-orange transition-colors"
                  >
                    {o.name}
                  </Link>
                  {o.objectType && (
                    <span className="ml-2 text-xs text-content-muted">({o.objectType})</span>
                  )}
                  <div className="text-xs text-content-muted mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {o.address}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-content-secondary">
                    <span>
                      Площадь: {o.areaM2 != null ? `${formatQuantity(o.areaM2)} м²` : '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      План: {formatDate(o.plannedTreatmentDate)}
                    </span>
                  </div>
                  {o.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {o.services.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded bg-poison-green/10 text-poison-green border border-poison-green/20"
                        >
                          {s.label}
                          {s.method ? ` · ${s.method}` : ''}
                          {s.frequency ? ` · ${s.frequency}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Link
                    href={`/manager/objects/${o.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-content-secondary hover:text-neon-orange hover:bg-bg-secondary rounded-md border border-gray-200 transition-colors"
                    title="Открыть карточку объекта"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Карточка
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDetach(o.id, o.name)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-content-muted hover:text-red-600 hover:bg-red-50 rounded-md border border-gray-200 disabled:opacity-50 transition-colors"
                    title="Отвязать от договора"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Отвязать
                  </button>
                </div>
              </div>
            </CyberpunkCard>
          ))}
        </div>
      )}
    </div>
  );
}
