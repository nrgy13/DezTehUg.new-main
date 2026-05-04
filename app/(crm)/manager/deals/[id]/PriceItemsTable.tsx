'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { addPriceItem, updatePriceItem, deletePriceItem } from '../actions';
import type { Service } from '@/lib/db/schema/services';
import type { ClientObject } from '@/lib/db/schema/objects';

type PriceItem = {
  id: string;
  objectId: string | null;
  serviceId: string | null;
  customName: string | null;
  areaM2: number;
  method: string | null;
  frequency: string | null;
  priceNoVat: string;
  priceWithVat: string;
  vatRate: string;
  sortOrder: number | null;
};

export function PriceItemsTable({
  dealId,
  items,
  objects,
  services,
  totalNoVat,
  totalWithVat,
}: {
  dealId: string;
  items: PriceItem[];
  objects: ClientObject[];
  services: Service[];
  totalNoVat: number;
  totalWithVat: number;
}) {
  const [editing, setEditing] = useState<PriceItem | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-bg-secondary">
        <span className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
          Прайс-позиции ({items.length})
        </span>
        <CyberpunkButton variant="primary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Добавить позицию
        </CyberpunkButton>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-bg-secondary/50 border-b border-gray-200">
          <tr className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
            <th className="text-left px-4 py-2">Объект</th>
            <th className="text-left px-4 py-2">Услуга</th>
            <th className="text-right px-4 py-2 w-20">м²</th>
            <th className="text-left px-4 py-2 w-32">Способ</th>
            <th className="text-left px-4 py-2 w-32">Периодичность</th>
            <th className="text-right px-4 py-2 w-28">Без НДС</th>
            <th className="text-right px-4 py-2 w-16">НДС%</th>
            <th className="text-right px-4 py-2 w-28">С НДС</th>
            <th className="px-2 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((it) => {
            const obj = objects.find((o) => o.id === it.objectId);
            const svc = services.find((s) => s.id === it.serviceId);
            const name = it.customName || svc?.name || '—';
            return (
              <tr key={it.id} className="hover:bg-bg-secondary/30">
                <td className="px-4 py-2 text-content-secondary text-xs">{obj?.name ?? '—'}</td>
                <td className="px-4 py-2 text-content-primary">{name}</td>
                <td className="px-4 py-2 text-right text-content-secondary">{it.areaM2}</td>
                <td className="px-4 py-2 text-content-secondary text-xs">{it.method ?? '—'}</td>
                <td className="px-4 py-2 text-content-secondary text-xs">{it.frequency ?? '—'}</td>
                <td className="px-4 py-2 text-right text-content-secondary">
                  {fmt(it.priceNoVat)}
                </td>
                <td className="px-4 py-2 text-right text-content-muted text-xs">
                  {Number(it.vatRate)}%
                </td>
                <td className="px-4 py-2 text-right text-content-primary font-medium">
                  {fmt(it.priceWithVat)}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => setEditing(it)}
                    className="p-1 text-content-muted hover:text-neon-orange"
                    aria-label="Редактировать"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-content-muted">
                Нет прайс-позиций. Нажми «Добавить позицию» чтобы начать.
              </td>
            </tr>
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot className="bg-bg-secondary/50 border-t border-gray-200">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right text-xs uppercase font-orbitron tracking-wider text-content-muted">
                Итого
              </td>
              <td className="px-4 py-3 text-right text-content-secondary">
                {fmt(totalNoVat)}
              </td>
              <td></td>
              <td className="px-4 py-3 text-right text-content-primary font-orbitron font-bold">
                {fmt(totalWithVat)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>

      {(adding || editing) && (
        <PriceItemDialog
          dealId={dealId}
          item={editing}
          objects={objects}
          services={services}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PriceItemDialog({
  dealId,
  item,
  objects,
  services,
  onClose,
}: {
  dealId: string;
  item: PriceItem | null;
  objects: ClientObject[];
  services: Service[];
  onClose: () => void;
}) {
  const isEdit = !!item;
  const [objectId, setObjectId] = useState(item?.objectId ?? '');
  const [serviceId, setServiceId] = useState(item?.serviceId ?? '');
  const [customName, setCustomName] = useState(item?.customName ?? '');
  const [areaM2, setAreaM2] = useState(String(item?.areaM2 ?? 0));
  const [method, setMethod] = useState(item?.method ?? '');
  const [frequency, setFrequency] = useState(item?.frequency ?? '');
  const [priceNoVat, setPriceNoVat] = useState(item?.priceNoVat ?? '');
  const [vatRate, setVatRate] = useState(item?.vatRate ?? '5');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isPending, startTransition] = useTransition();

  // Auto-fill method from service when service changes
  function handleServiceChange(id: string) {
    setServiceId(id);
    if (id && !method) {
      const svc = services.find((s) => s.id === id);
      if (svc?.defaultMethod) setMethod(svc.defaultMethod);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      objectId: objectId || null,
      serviceId: serviceId || null,
      customName,
      areaM2: Number(areaM2) || 0,
      method,
      frequency,
      priceNoVat: Number(priceNoVat) || 0,
      vatRate: Number(vatRate) || 0,
      sortOrder: Number(sortOrder) || 0,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updatePriceItem(item!.id, payload)
        : await addPriceItem(dealId, payload);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(isEdit ? 'Позиция обновлена' : 'Позиция добавлена');
        onClose();
      }
    });
  }

  function handleDelete() {
    if (!item) return;
    if (!confirm('Удалить позицию? Действие нельзя отменить.')) return;
    startTransition(async () => {
      const res = await deletePriceItem(item.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success('Позиция удалена');
        onClose();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            {isEdit ? 'Редактирование позиции' : 'Новая позиция'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="objectId">Объект</Label>
              <select
                id="objectId"
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
                disabled={isPending}
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
              >
                <option value="">— не указан —</option>
                {objects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="serviceId">Услуга из каталога</Label>
              <select
                id="serviceId"
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                disabled={isPending}
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
              >
                <option value="">— своя услуга —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName ?? s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="customName">Своё название (если не из каталога)</Label>
            <NeonInput
              id="customName"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={serviceId ? 'необязательно' : 'обязательно если услуга не выбрана'}
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="areaM2">Площадь, м²</Label>
              <NeonInput
                id="areaM2"
                type="number"
                min={0}
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div>
              <Label htmlFor="method">Способ</Label>
              <NeonInput
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="Сухая / Туман"
                disabled={isPending}
              />
            </div>
            <div>
              <Label htmlFor="frequency">Периодичность</Label>
              <NeonInput
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="Ежемесячно / Разово"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="priceNoVat">Цена без НДС, ₽</Label>
              <NeonInput
                id="priceNoVat"
                type="number"
                step="0.01"
                min={0}
                value={priceNoVat}
                onChange={(e) => setPriceNoVat(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div>
              <Label htmlFor="vatRate">НДС, %</Label>
              <NeonInput
                id="vatRate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                disabled={isPending}
              />
              <p className="text-[10px] text-content-muted mt-0.5">УСН — обычно 5%</p>
            </div>
            <div>
              <Label htmlFor="sortOrder">Сортировка</Label>
              <NeonInput
                id="sortOrder"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-between items-center">
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Удалить позицию
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
              >
                Отмена
              </button>
              <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
                {isPending ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить'}
              </CyberpunkButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fmt(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (isNaN(v)) return String(n);
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(v);
}
