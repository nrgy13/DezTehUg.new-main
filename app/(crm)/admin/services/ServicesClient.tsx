'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { ServiceFormDialog } from './ServiceFormDialog';
import { toggleServiceActive } from './actions';
import type { Service } from '@/lib/db/schema/services';

export function ServicesClient({ services }: { services: Service[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(service: Service, next: boolean) {
    setPendingId(service.id);
    startTransition(async () => {
      const res = await toggleServiceActive(service.id, next);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(next ? 'Услуга активирована' : 'Услуга деактивирована');
      }
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-content-muted">
          Всего {services.length} {pluralize(services.length, ['услуга', 'услуги', 'услуг'])}
        </p>
        <CyberpunkButton variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить услугу
        </CyberpunkButton>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary border-b border-gray-200">
            <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
              <th className="text-left px-4 py-3 w-16">№</th>
              <th className="text-left px-4 py-3">Название</th>
              <th className="text-left px-4 py-3 w-40">Код</th>
              <th className="text-left px-4 py-3 w-48">Способ</th>
              <th className="text-left px-4 py-3 w-24">Активна</th>
              <th className="text-right px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-bg-secondary/50">
                <td className="px-4 py-3 text-content-muted">{service.sortOrder}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-content-primary">{service.name}</div>
                  {service.shortName && service.shortName !== service.name && (
                    <div className="text-xs text-content-muted">{service.shortName}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-content-secondary">
                  {service.code}
                </td>
                <td className="px-4 py-3 text-content-secondary text-xs">
                  {service.defaultMethod ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={service.isActive}
                    onCheckedChange={(v) => handleToggle(service, v)}
                    disabled={pendingId === service.id}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditService(service)}
                    className="p-2 text-content-muted hover:text-neon-orange transition-colors"
                    aria-label="Редактировать"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-content-muted">
                  Услуг пока нет. Нажми «Добавить услугу» чтобы создать первую.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CyberpunkCard>

      <ServiceFormDialog
        mode={{ kind: 'create' }}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {editService && (
        <ServiceFormDialog
          key={editService.id}
          mode={{ kind: 'edit', service: editService }}
          open={true}
          onOpenChange={(open) => !open && setEditService(null)}
        />
      )}
    </div>
  );
}

function pluralize(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
