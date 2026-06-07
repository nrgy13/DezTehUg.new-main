'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
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
import { UNIT_OPTIONS } from '@/lib/constants/units';
import { TREATMENT_METHODS } from '@/lib/constants/treatment';
import { createWorkOrderAction, type WorkOrderFormData } from './work-order-actions';
import type { PriceItemUnit } from '@/lib/db/schema/deals';

const fieldClass =
  'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none';

type SvcRow = {
  serviceId: string;
  customName: string;
  method: string;
  unit: PriceItemUnit;
  quantity: string;
};

// Способ-select: показываем справочник + текущее значение, если оно вне списка
// (например, составной default из каталога услуг «Сухая/Туман»).
function methodOptions(cur: string): string[] {
  const base = [...TREATMENT_METHODS] as string[];
  return cur && !base.includes(cur) ? [cur, ...base] : base;
}

export function WorkOrderLauncher({ data }: { data: WorkOrderFormData }) {
  const [open, setOpen] = useState(false);
  const hasClients = data.clients.length > 0;
  return (
    <>
      <CyberpunkButton variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" />
        Заказ-наряд
      </CyberpunkButton>
      {open && (
        <WorkOrderDialog data={data} hasClients={hasClients} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function WorkOrderDialog({
  data,
  hasClients,
  onClose,
}: {
  data: WorkOrderFormData;
  hasClients: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [clientId, setClientId] = useState('');
  const [dealId, setDealId] = useState('');
  const [objectId, setObjectId] = useState('');
  const [masterId, setMasterId] = useState('');
  const [plannedAt, setPlannedAt] = useState(''); // datetime-local
  const [preparations, setPreparations] = useState('');
  const [rows, setRows] = useState<SvcRow[]>([]);

  const client = useMemo(
    () => data.clients.find((c) => c.id === clientId) ?? null,
    [data.clients, clientId],
  );
  const deal = useMemo(() => client?.deals.find((d) => d.id === dealId) ?? null, [client, dealId]);

  function onClient(v: string) {
    setClientId(v);
    setDealId('');
    setObjectId('');
    setRows([]);
  }
  function onDeal(v: string) {
    setDealId(v);
    setObjectId('');
    setRows([]);
  }
  function onObject(v: string) {
    setObjectId(v);
    const o = deal?.objects.find((x) => x.id === v);
    // Предзаполняем услуги из объекта (snapshot для правки).
    setRows(
      (o?.services ?? []).map((s) => ({
        serviceId: s.serviceId ?? '',
        customName: s.serviceId ? '' : s.label,
        method: s.method ?? '',
        unit: s.unit,
        quantity: s.quantity ?? o?.areaM2 ?? '',
      })),
    );
  }

  function addRow() {
    setRows((r) => [...r, { serviceId: '', customName: '', method: '', unit: 'm2', quantity: '' }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function patchRow(i: number, patch: Partial<SvcRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function onPickService(i: number, value: string) {
    if (value === '__custom__') {
      patchRow(i, { serviceId: '', customName: '' });
      return;
    }
    const svc = data.catalog.find((c) => c.id === value);
    patchRow(i, { serviceId: value, customName: '', method: svc?.defaultMethod ?? '' });
  }

  function submit() {
    if (!dealId || !objectId) {
      toast.error('Выбери договор и объект');
      return;
    }
    if (!masterId) {
      toast.error('Выбери мастера');
      return;
    }
    const services = rows
      .filter((r) => r.serviceId || r.customName.trim())
      .map((r) => ({
        serviceId: r.serviceId || null,
        customName: r.customName.trim() || null,
        method: r.method.trim() || null,
        unit: r.unit,
        quantity: r.quantity.trim() ? r.quantity.replace(',', '.') : null,
      }));
    if (services.length === 0) {
      toast.error('Добавь хотя бы одну услугу');
      return;
    }
    const plannedAtIso = plannedAt ? new Date(plannedAt).toISOString() : null;

    startTransition(async () => {
      const res = await createWorkOrderAction({
        dealId,
        objectId,
        masterId,
        plannedAtIso,
        preparations: preparations.trim() || null,
        services,
      });
      if (res.ok) {
        toast.success('Заказ-наряд создан — выезд появился в календаре');
        router.refresh();
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Новый заказ-наряд
          </DialogTitle>
        </DialogHeader>

        {!hasClients ? (
          <p className="text-sm text-content-muted py-6 text-center">
            Нет объектов, привязанных к договору. Сначала заведи объект в карточке клиента
            (с договором-основанием) — тогда по нему можно оформить заказ-наряд.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Клиент + договор */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wo-client">Клиент</Label>
                <select
                  id="wo-client"
                  className={fieldClass}
                  value={clientId}
                  onChange={(e) => onClient(e.target.value)}
                >
                  <option value="">— выбери клиента —</option>
                  {data.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="wo-deal">Договор</Label>
                <select
                  id="wo-deal"
                  className={fieldClass}
                  value={dealId}
                  onChange={(e) => onDeal(e.target.value)}
                  disabled={!client}
                >
                  <option value="">— договор —</option>
                  {client?.deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.contractNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Объект + мастер */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wo-object">Объект</Label>
                <select
                  id="wo-object"
                  className={fieldClass}
                  value={objectId}
                  onChange={(e) => onObject(e.target.value)}
                  disabled={!deal}
                >
                  <option value="">— объект —</option>
                  {deal?.objects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="wo-master">Мастер</Label>
                <select
                  id="wo-master"
                  className={fieldClass}
                  value={masterId}
                  onChange={(e) => setMasterId(e.target.value)}
                >
                  <option value="">— мастер —</option>
                  {data.masters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Дата + время */}
            <div>
              <Label htmlFor="wo-date">Дата и время выезда</Label>
              <input
                id="wo-date"
                type="datetime-local"
                className={fieldClass}
                value={plannedAt}
                onChange={(e) => setPlannedAt(e.target.value)}
              />
            </div>

            {/* Услуги */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Услуги {objectId ? '(из объекта — можно править)' : ''}</Label>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
                >
                  <Plus className="w-3 h-3" /> услуга
                </button>
              </div>
              {rows.length === 0 && (
                <p className="text-xs text-content-muted">
                  Выбери объект — услуги подтянутся, либо добавь вручную.
                </p>
              )}
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-4">
                      <select
                        className={fieldClass}
                        value={row.serviceId || '__custom__'}
                        onChange={(e) => onPickService(i, e.target.value)}
                      >
                        <option value="__custom__">— своя услуга —</option>
                        {data.catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.shortName ?? c.name}
                          </option>
                        ))}
                      </select>
                      {!row.serviceId && (
                        <input
                          className={fieldClass}
                          placeholder="Название услуги"
                          value={row.customName}
                          onChange={(e) => patchRow(i, { customName: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <select
                        className={fieldClass}
                        value={row.method}
                        onChange={(e) => patchRow(i, { method: e.target.value })}
                      >
                        <option value="">способ…</option>
                        {methodOptions(row.method).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        placeholder="кол-во"
                        value={row.quantity}
                        onChange={(e) => patchRow(i, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <select
                        className={fieldClass}
                        value={row.unit}
                        onChange={(e) => patchRow(i, { unit: e.target.value as PriceItemUnit })}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-2 text-content-muted hover:text-red-500"
                        aria-label="Удалить услугу"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Препараты */}
            <div>
              <Label htmlFor="wo-prep">Препараты обработки</Label>
              <textarea
                id="wo-prep"
                className={fieldClass}
                rows={2}
                value={preparations}
                onChange={(e) => setPreparations(e.target.value)}
                placeholder="Напр.: Циперметрин 0.5%, гель Globol"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
          >
            Отмена
          </button>
          {hasClients && (
            <CyberpunkButton variant="primary" onClick={submit} disabled={isPending}>
              {isPending ? 'Создаю…' : 'Создать наряд'}
            </CyberpunkButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
