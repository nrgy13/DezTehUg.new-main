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
import type { PriceItemUnit } from '@/lib/db/schema/deals';
import { unitLabel, formatQuantity, UNIT_OPTIONS } from '@/lib/constants/units';
import { TREATMENT_METHODS, TREATMENT_FREQUENCIES } from '@/lib/constants/treatment';

type PriceItem = {
  id: string;
  objectId: string | null;
  serviceId: string | null;
  customName: string | null;
  areaM2: string;
  unit: PriceItemUnit;
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

      {/* Desktop: таблица */}
      <table className="hidden md:table w-full text-sm">
        <thead className="bg-bg-secondary/50 border-b border-gray-200">
          <tr className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
            <th className="text-left px-4 py-2">Объект</th>
            <th className="text-left px-4 py-2">Услуга</th>
            <th className="text-right px-4 py-2 w-24">Кол-во</th>
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
                <td className="px-4 py-2 text-right text-content-secondary">
                  {formatQuantity(it.areaM2)} <span className="text-content-muted text-xs">{unitLabel(it.unit)}</span>
                </td>
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
        </tbody>
        {items.length > 0 && (
          <tfoot className="bg-bg-secondary/50 border-t border-gray-200">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right text-xs uppercase font-orbitron tracking-wider text-content-muted">
                Итого по прайсу
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

      {/* Mobile: карточки */}
      <div className="md:hidden divide-y divide-gray-100">
        {items.map((it) => {
          const obj = objects.find((o) => o.id === it.objectId);
          const svc = services.find((s) => s.id === it.serviceId);
          const name = it.customName || svc?.name || '—';
          return (
            <div key={it.id} className="p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-medium text-content-primary">{name}</span>
                <button
                  onClick={() => setEditing(it)}
                  className="p-1 -mt-0.5 -mr-0.5 text-content-muted hover:text-neon-orange shrink-0"
                  aria-label="Редактировать"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              {obj && <div className="text-xs text-content-muted mb-1">{obj.name}</div>}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-content-secondary mb-1.5">
                <span>{formatQuantity(it.areaM2)} {unitLabel(it.unit)}</span>
                {it.method && <span>{it.method}</span>}
                {it.frequency && <span>{it.frequency}</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-content-muted">
                  без НДС {fmt(it.priceNoVat)} · НДС {Number(it.vatRate)}%
                </span>
                <span className="text-sm font-medium text-content-primary">
                  {fmt(it.priceWithVat)} ₽
                </span>
              </div>
            </div>
          );
        })}
        {items.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-bg-secondary/50">
            <span className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
              Итого по прайсу
            </span>
            <span className="font-orbitron font-bold text-content-primary">
              {fmt(totalWithVat)} ₽
            </span>
          </div>
        )}
      </div>

      {items.length === 0 && (
        <div className="px-4 py-10 text-center text-content-muted">
          Нет прайс-позиций. Нажми «Добавить позицию» чтобы начать.
        </div>
      )}

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
  const [areaM2, setAreaM2] = useState(item?.areaM2 ?? '');
  const [unit, setUnit] = useState<PriceItemUnit>(item?.unit ?? 'm2');
  const [method, setMethod] = useState(item?.method ?? '');
  // Периодичность: select из справочника + «Своё…» (свободный ввод). Если у
  // позиции уже стоит значение вне справочника — это «своё», открываем текст-поле.
  const initialFreqCustom =
    !!item?.frequency && !(TREATMENT_FREQUENCIES as readonly string[]).includes(item.frequency);
  const [freqSelect, setFreqSelect] = useState(
    initialFreqCustom ? '__custom__' : item?.frequency ?? '',
  );
  const [freqCustom, setFreqCustom] = useState(initialFreqCustom ? item!.frequency! : '');
  const [priceNoVat, setPriceNoVat] = useState(item?.priceNoVat ?? '');
  const [priceWithVat, setPriceWithVat] = useState(item?.priceWithVat ?? '');
  // БД хранит vatRate как numeric "5.00", а option value у select — "5".
  // Нормализуем через Number, иначе select не находит matching option
  // и валится на первое значение ("0"), затирая ставку при сохранении.
  const [vatRate, setVatRate] = useState(
    item?.vatRate != null ? String(Number(item.vatRate)) : '5',
  );
  const [inputMode, setInputMode] = useState<'noVat' | 'withVat'>('noVat');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isPending, startTransition] = useTransition();

  // Один источник правды — priceNoVat. priceWithVat пересчитывается
  // на лету в зависимости от vatRate. Если режим «С НДС» — наоборот.
  function handlePriceNoVatChange(v: string) {
    setPriceNoVat(v);
    const rate = Number(vatRate) || 0;
    const noVat = Number(v) || 0;
    setPriceWithVat(round2(noVat * (1 + rate / 100)).toString());
  }
  function handlePriceWithVatChange(v: string) {
    setPriceWithVat(v);
    const rate = Number(vatRate) || 0;
    const withVat = Number(v) || 0;
    setPriceNoVat(round2(withVat / (1 + rate / 100)).toString());
  }
  function handleVatRateChange(v: string) {
    setVatRate(v);
    const rate = Number(v) || 0;
    if (inputMode === 'noVat') {
      const noVat = Number(priceNoVat) || 0;
      setPriceWithVat(round2(noVat * (1 + rate / 100)).toString());
    } else {
      const withVat = Number(priceWithVat) || 0;
      setPriceNoVat(round2(withVat / (1 + rate / 100)).toString());
    }
  }
  function round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

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
    const frequencyValue = freqSelect === '__custom__' ? freqCustom.trim() : freqSelect;
    const payload = {
      objectId: objectId || null,
      serviceId: serviceId || null,
      customName,
      areaM2: Number(areaM2.replace(',', '.')) || 0,
      unit,
      method,
      frequency: frequencyValue,
      priceNoVat: Number(String(priceNoVat).replace(',', '.')) || 0,
      // Шлём и цену С НДС, как её видит менеджер: сервер сохранит именно её,
      // иначе обратный пересчёт net→gross возвращает ±1 копейку (5500 → 5500,01).
      priceWithVat: Number(String(priceWithVat).replace(',', '.')) || 0,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    {`${o.name}${o.objectType ? ` — ${o.objectType}` : ''}${o.address ? ` · ${o.address}` : ''}`}
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
                    {/* Полное название (с видом) — короткое имя у нескольких услуг
                        совпадает («Дезинсекция»), различает только полное. */}
                    {s.name}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="areaM2">Кол-во</Label>
              <div className="flex gap-2 mt-1">
                <NeonInput
                  id="areaM2"
                  type="text"
                  inputMode="decimal"
                  value={areaM2}
                  onChange={(e) => setAreaM2(e.target.value)}
                  disabled={isPending}
                  required
                  placeholder="напр. 7,7"
                  className="flex-1"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as PriceItemUnit)}
                  disabled={isPending}
                  className="px-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none h-11"
                  aria-label="Единица измерения"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="method">Способ</Label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={isPending}
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none h-11"
              >
                <option value="">— не указан —</option>
                {method && !(TREATMENT_METHODS as readonly string[]).includes(method) && (
                  <option value={method}>{method}</option>
                )}
                {TREATMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="frequency">Периодичность</Label>
              <select
                id="frequency"
                value={freqSelect}
                onChange={(e) => setFreqSelect(e.target.value)}
                disabled={isPending}
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none h-11"
              >
                <option value="">— не указана —</option>
                {TREATMENT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value="__custom__">Своё…</option>
              </select>
              {freqSelect === '__custom__' && (
                <NeonInput
                  value={freqCustom}
                  onChange={(e) => setFreqCustom(e.target.value)}
                  placeholder="Впиши периодичность"
                  disabled={isPending}
                  className="mt-2"
                />
              )}
            </div>
          </div>

          <div>
            <Label>Что ввожу?</Label>
            <div className="flex gap-3 mt-1 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="inputMode"
                  value="noVat"
                  checked={inputMode === 'noVat'}
                  onChange={() => setInputMode('noVat')}
                  disabled={isPending}
                />
                Цену БЕЗ НДС
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="inputMode"
                  value="withVat"
                  checked={inputMode === 'withVat'}
                  onChange={() => setInputMode('withVat')}
                  disabled={isPending}
                />
                Цену С НДС
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="priceNoVat">
                Без НДС, ₽ {inputMode === 'withVat' && <span className="text-[10px] text-content-muted">(авто)</span>}
              </Label>
              <NeonInput
                id="priceNoVat"
                type="number"
                step="0.01"
                min={0}
                value={priceNoVat}
                onChange={(e) => handlePriceNoVatChange(e.target.value)}
                disabled={isPending || inputMode === 'withVat'}
                required={inputMode === 'noVat'}
              />
            </div>
            <div>
              <Label htmlFor="priceWithVat">
                С НДС, ₽ {inputMode === 'noVat' && <span className="text-[10px] text-content-muted">(авто)</span>}
              </Label>
              <NeonInput
                id="priceWithVat"
                type="number"
                step="0.01"
                min={0}
                value={priceWithVat}
                onChange={(e) => handlePriceWithVatChange(e.target.value)}
                disabled={isPending || inputMode === 'noVat'}
                required={inputMode === 'withVat'}
              />
            </div>
            <div>
              <Label htmlFor="vatRate">НДС</Label>
              <select
                id="vatRate"
                value={vatRate}
                onChange={(e) => handleVatRateChange(e.target.value)}
                disabled={isPending}
                className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none h-[42px]"
              >
                <option value="0">Без НДС (0%)</option>
                <option value="5">5% (УСН)</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
              </select>
            </div>
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
              className="max-w-[120px]"
            />
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
