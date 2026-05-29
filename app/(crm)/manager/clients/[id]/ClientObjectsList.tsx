'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, CalendarClock, FileText, Unlink, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { formatQuantity } from '@/lib/constants/units';
import { attachObjectToDeal } from '../actions';
import { DeleteObjectButton } from '../DeleteObjectButton';

type ObjectService = { label: string; method: string | null };

type ClientObjectView = {
  id: string;
  name: string;
  objectType: string | null;
  address: string;
  areaM2: string | null;
  plannedTreatmentDate: string | null;
  dealId: string | null;
  contractNumber: string | null;
  services: ObjectService[];
};

type DealOption = { id: string; contractNumber: string };

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export function ClientObjectsList({
  objects,
  deals,
}: {
  objects: ClientObjectView[];
  deals: DealOption[];
}) {
  return (
    <div className="space-y-2">
      {objects.map((o) => (
        <ObjectRow key={o.id} object={o} deals={deals} />
      ))}
    </div>
  );
}

function ObjectRow({ object: o, deals }: { object: ClientObjectView; deals: DealOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickDealId, setPickDealId] = useState('');

  function handleAttach() {
    if (!pickDealId) return;
    startTransition(async () => {
      const res = await attachObjectToDeal(o.id, pickDealId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Объект привязан к договору');
      setPickDealId('');
      router.refresh();
    });
  }

  function handleDetach() {
    if (!confirm(`Отвязать объект «${o.name}» от договора ${o.contractNumber ?? ''}?`)) return;
    startTransition(async () => {
      const res = await attachObjectToDeal(o.id, null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Объект отвязан');
      router.refresh();
    });
  }

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link
            href={`/manager/objects/${o.id}`}
            className="text-sm font-medium text-content-primary hover:text-neon-orange transition-colors inline-flex items-center gap-1"
          >
            {o.name}
            <ArrowRight className="w-3 h-3 opacity-50" />
          </Link>
          {o.objectType && (
            <span className="ml-2 text-xs text-content-muted">({o.objectType})</span>
          )}
          <div className="text-xs text-content-muted mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {o.address}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-content-secondary">
            <span>Площадь: {o.areaM2 != null ? `${formatQuantity(o.areaM2)} м²` : '—'}</span>
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
                </span>
              ))}
            </div>
          )}
        </div>
        <DeleteObjectButton objectId={o.id} objectName={o.name} />
      </div>

      {/* Привязка к договору */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        {o.dealId ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-neon-orange" />
            <span className="text-content-muted">Договор:</span>
            <Link
              href={`/manager/deals/${o.dealId}?tab=objects`}
              className="font-mono text-neon-orange hover:underline"
            >
              {o.contractNumber ?? o.dealId}
            </Link>
            <button
              type="button"
              onClick={handleDetach}
              disabled={isPending}
              className="ml-auto inline-flex items-center gap-1 text-content-muted hover:text-red-600 disabled:opacity-50"
              title="Отвязать от договора"
            >
              <Unlink className="w-3.5 h-3.5" />
              Отвязать
            </button>
          </div>
        ) : deals.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-content-muted">Без договора. Привязать:</span>
            <select
              value={pickDealId}
              onChange={(e) => setPickDealId(e.target.value)}
              className="rounded-md bg-bg-primary px-2 py-1 text-xs border border-gray-200 focus:border-poison-green focus:outline-none"
            >
              <option value="">— договор —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.contractNumber}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAttach}
              disabled={!pickDealId || isPending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-poison-green hover:bg-poison-green/10 rounded border border-poison-green/30 disabled:opacity-50"
            >
              Привязать
            </button>
          </div>
        ) : (
          <span className="text-xs text-content-muted">
            Без договора. Создайте договор клиенту, чтобы привязать объект.
          </span>
        )}
      </div>
    </CyberpunkCard>
  );
}
