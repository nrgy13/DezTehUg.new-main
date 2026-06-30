'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { UNIT_OPTIONS } from '@/lib/constants/units';
import { TREATMENT_METHODS } from '@/lib/constants/treatment';
import { mskLocalToUtcISO } from '@/lib/datetime/msk';
import {
  createWorkOrderAction,
  getObjectWorkOrderDefaults,
  getServiceChecklistTemplates,
  getLastOrderChecklist,
  type WorkOrderFormData,
  type WorkOrderChecklistDefault,
  type WorkOrderDefaultService,
  type WorkOrderDuplicateService,
  type WorkOrderDuplicatePrefill,
} from '@/app/(crm)/manager/calendar/work-order-actions';
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

type ChecklistRow = {
  /** Локальный стабильный ключ строки (для React key при удалении). */
  id: string;
  title: string;
  description: string;
  required: boolean;
  source: 'template' | 'manager';
  sourceTemplateId: string | null;
};

// Нормализуем пункты-дефолты (description null → '') в строки формы.
function toChkRows(items: WorkOrderChecklistDefault[]): ChecklistRow[] {
  return items.map((c) => ({
    id: crypto.randomUUID(),
    title: c.title,
    description: c.description ?? '',
    required: c.required,
    source: c.source,
    sourceTemplateId: c.sourceTemplateId,
  }));
}

/** Предзаполнение формы: открыть с уже выбранным клиентом/договором/объектом/датой. */
export type WorkOrderPreset = {
  clientId?: string;
  dealId?: string;
  objectId?: string;
  /** datetime-local формат "YYYY-MM-DDTHH:mm". */
  plannedAtLocal?: string;
};

// Способ-select: показываем справочник + текущее значение, если оно вне списка
// (например, составной default из каталога услуг «Сухая/Туман»).
function methodOptions(cur: string): string[] {
  const base = [...TREATMENT_METHODS] as string[];
  return cur && !base.includes(cur) ? [cur, ...base] : base;
}

// Decimal из БД приходит строкой ("120.00") — убираем лишние нули для поля ввода.
function trimNum(s: string | null): string {
  if (s == null || s === '') return '';
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s;
}

// Услуга-дефолт (из последнего наряда / дубля) → строка формы.
function svcToRow(s: WorkOrderDefaultService): SvcRow {
  return {
    serviceId: s.serviceId ?? '',
    customName: s.customName ?? '',
    method: s.method ?? '',
    unit: s.unit,
    quantity: trimNum(s.quantity),
  };
}

// Услуга дубля → строка формы. Если услуга деактивирована (нет в активном каталоге) —
// показываем её как «свою» с именем-снимком, иначе select был бы пустым без поля ввода.
function dupSvcToRow(s: WorkOrderDuplicateService, catalogIds: Set<string>): SvcRow {
  if (s.serviceId && !catalogIds.has(s.serviceId)) {
    return {
      serviceId: '',
      customName: s.customName ?? s.serviceName ?? '',
      method: s.method ?? '',
      unit: s.unit,
      quantity: trimNum(s.quantity),
    };
  }
  return svcToRow(s);
}

/**
 * Форма заказ-наряда. Рендерить только когда открыт (вызывающий: `{open && <... />}`),
 * чтобы preset применялся при каждом открытии. Используется из календаря (кнопка),
 * панели напоминаний и карточки объекта.
 */
export function WorkOrderDialog({
  data,
  preset,
  duplicatePrefill,
  onClose,
  onCreated,
}: {
  data: WorkOrderFormData;
  preset?: WorkOrderPreset;
  /**
   * Режим дублирования: форма открывается с данными конкретного наряда (клиент/договор/
   * объект/мастер/услуги/препараты/чеклист), дата пустая. Поля цели редактируемы — копию
   * можно перенести на другой объект/договор/клиента (услуги/чеклист не перетираются).
   */
  duplicatePrefill?: WorkOrderDuplicatePrefill;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasClients = data.clients.length > 0;
  const isDuplicate = !!duplicatePrefill;

  const [clientId, setClientId] = useState(duplicatePrefill?.clientId ?? preset?.clientId ?? '');
  const [dealId, setDealId] = useState(duplicatePrefill?.dealId ?? preset?.dealId ?? '');
  const [objectId, setObjectId] = useState(duplicatePrefill?.objectId ?? '');
  // Мастер дубля — только если он ещё мастер (мог сменить роль/уволиться); иначе пусто.
  const [masterId, setMasterId] = useState(
    duplicatePrefill?.masterId && data.masters.some((m) => m.id === duplicatePrefill.masterId)
      ? duplicatePrefill.masterId
      : '',
  );
  const [plannedAt, setPlannedAt] = useState(preset?.plannedAtLocal ?? ''); // datetime-local
  const [preparations, setPreparations] = useState(duplicatePrefill?.preparations ?? '');
  const [rows, setRows] = useState<SvcRow[]>(() => {
    if (!duplicatePrefill) return [];
    const catalogIds = new Set(data.catalog.map((c) => c.id));
    return duplicatePrefill.services.map((s) => dupSvcToRow(s, catalogIds));
  });
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistRow[]>(
    duplicatePrefill ? toChkRows(duplicatePrefill.checklist) : [],
  );
  const [chkLoading, setChkLoading] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<{
    items: ChecklistRow[];
    label: string;
  } | null>(null);

  const client = useMemo(
    () => data.clients.find((c) => c.id === clientId) ?? null,
    [data.clients, clientId],
  );

  // Combobox-опции для клиента и объекта (поиск по подстроке вместо нативного select).
  const clientOptions = useMemo<ComboboxOption[]>(
    () => data.clients.map((c) => ({ value: c.id, label: c.shortName, keywords: [c.shortName] })),
    [data.clients],
  );
  // Объект подписываем «Имя — Метка · Адрес» (как в прайсе/привязке) — чтобы различать
  // одноимённые объекты сетей (Гончаров «Хадыжи»: 31 магазин с одним именем). Искать
  // можно по имени/метке/адресу.
  const objectOptions = useMemo<ComboboxOption[]>(
    () =>
      (client?.objects ?? []).map((o) => ({
        value: o.id,
        // Имя + метка на первой строке, адрес — ОТДЕЛЬНОЙ строкой (description): у сетей
        // (Хадыжи: 31 магазин с одним именем) различает только адрес, в одной строке он резался.
        label: `${o.name}${o.objectType ? ` — ${o.objectType}` : ''}`,
        description: o.address ?? undefined,
        keywords: [o.name, o.objectType, o.address].filter((x): x is string => !!x),
      })),
    [client],
  );

  // Подгрузка дефолтов услуг/препаратов/мастера по объекту (последний наряд → услуги объекта).
  async function loadObject(v: string) {
    setObjectId(v);
    setPendingInsert(null);
    // Режим дубля: услуги/препараты/чеклист уже скопированы из исходного наряда —
    // смена объекта (перенос копии) НЕ должна затирать их дефолтами целевого объекта.
    if (isDuplicate) return;
    if (!v) {
      setRows([]);
      setChecklist([]);
      return;
    }
    setLoadingDefaults(true);
    try {
      const d = await getObjectWorkOrderDefaults(v);
      setRows(d.services.map(svcToRow));
      setChecklist(toChkRows(d.checklist));
      if (d.source === 'last_order') {
        setPreparations(d.preparations ?? '');
        if (d.masterId) setMasterId(d.masterId);
      }
    } finally {
      setLoadingDefaults(false);
    }
  }

  // Применяем preset при открытии (объект → подгружаем дефолты).
  useEffect(() => {
    // В режиме дубля данные уже подставлены из duplicatePrefill — дефолты по объекту не тянем.
    if (isDuplicate) return;
    if (preset?.objectId) {
      // Подстраховка: combobox объекта показывает подпись из опций, а опции зависят
      // от выбранного клиента. Если caller дал objectId без clientId — выведем клиента
      // из дерева, иначе строка объекта осталась бы пустой (placeholder при непустом id).
      if (!preset.clientId) {
        const owner = data.clients.find((c) => c.objects.some((o) => o.id === preset.objectId));
        if (owner) setClientId(owner.id);
      }
      loadObject(preset.objectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onClient(v: string) {
    setClientId(v);
    setDealId('');
    setObjectId('');
    setPendingInsert(null);
    // В режиме дубля услуги/чеклист/препараты переносятся на нового клиента — не чистим.
    if (!isDuplicate) {
      setRows([]);
      setChecklist([]);
    }
  }

  // ── Чеклист: ручные правки ──
  function addChkRow() {
    setChecklist((c) => [
      ...c,
      {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        required: false,
        source: 'manager',
        sourceTemplateId: null,
      },
    ]);
  }
  function removeChkRow(i: number) {
    setChecklist((c) => c.filter((_, idx) => idx !== i));
  }
  function patchChkRow(i: number, patch: Partial<ChecklistRow>) {
    setChecklist((c) => c.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  // ── Чеклист: вставка из источников (шаблоны услуг / прошлый наряд) ──
  function applyOrAsk(items: ChecklistRow[], label: string) {
    if (items.length === 0) {
      toast.info(`Нет пунктов: ${label}`);
      return;
    }
    if (checklist.length === 0) {
      setChecklist(items);
      toast.success(`Добавлено пунктов: ${items.length}`);
    } else {
      setPendingInsert({ items, label });
    }
  }
  function confirmInsert(mode: 'append' | 'replace') {
    if (!pendingInsert) return;
    const ins = pendingInsert.items;
    setChecklist((cur) => {
      if (mode === 'replace') return ins;
      // Дедуп по заголовку (без регистра) — повторный клик «Добавить» не плодит дубли.
      const seen = new Set(cur.map((c) => c.title.trim().toLowerCase()));
      const fresh = ins.filter((c) => !seen.has(c.title.trim().toLowerCase()));
      return [...cur, ...fresh];
    });
    setPendingInsert(null);
  }
  async function loadFromTemplates() {
    const serviceIds = rows.map((r) => r.serviceId).filter((x): x is string => !!x);
    if (serviceIds.length === 0) {
      toast.error('Сначала выбери услуги из каталога');
      return;
    }
    setChkLoading(true);
    try {
      const items = await getServiceChecklistTemplates(serviceIds);
      applyOrAsk(toChkRows(items), 'шаблоны услуг');
    } finally {
      setChkLoading(false);
    }
  }
  async function loadFromLastOrder() {
    if (!objectId) {
      toast.error('Сначала выбери объект');
      return;
    }
    setChkLoading(true);
    try {
      const items = await getLastOrderChecklist(objectId);
      applyOrAsk(toChkRows(items), 'прошлый наряд');
    } finally {
      setChkLoading(false);
    }
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
    // Дубль создаёт копию → дата обязательна (иначе молча уйдёт наряд без даты,
    // вопреки подсказке «поставь новую дату»).
    if (isDuplicate && !plannedAt) {
      toast.error('Поставь дату выезда для копии');
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
    // Ввод datetime-local трактуем как МСК (а не TZ браузера) — иначе дата наряда
    // могла уехать на соседний день и флажок напоминания серии не гас.
    const plannedAtIso = plannedAt ? mskLocalToUtcISO(plannedAt) : null;
    const checklistPayload = checklist
      .filter((c) => c.title.trim())
      .map((c) => ({
        title: c.title.trim(),
        description: c.description.trim() || null,
        required: c.required,
        source: c.source,
        sourceTemplateId: c.sourceTemplateId,
      }));

    startTransition(async () => {
      const res = await createWorkOrderAction({
        dealId,
        objectId,
        masterId,
        plannedAtIso,
        preparations: preparations.trim() || null,
        services,
        checklist: checklistPayload,
      });
      if (res.ok) {
        toast.success('Заказ-наряд создан — выезд появился в календаре');
        onCreated?.();
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
            {isDuplicate ? 'Дублировать заказ-наряд' : 'Новый заказ-наряд'}
          </DialogTitle>
        </DialogHeader>

        {isDuplicate && hasClients && (
          <p className="text-xs text-content-muted -mt-1">
            Скопировано из наряда. Поставь новую дату; при необходимости смени объект, договор
            или клиента — услуги, препараты и чеклист перенесутся.
          </p>
        )}

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
                <Combobox
                  id="wo-client"
                  options={clientOptions}
                  value={clientId}
                  onChange={onClient}
                  placeholder="— выбери клиента —"
                  searchPlaceholder="Поиск по названию…"
                  emptyText="Клиент не найден"
                />
              </div>
              <div>
                <Label htmlFor="wo-deal">Договор</Label>
                <select
                  id="wo-deal"
                  className={fieldClass}
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
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
                <Combobox
                  id="wo-object"
                  options={objectOptions}
                  value={objectId}
                  onChange={loadObject}
                  placeholder="— объект —"
                  searchPlaceholder="Поиск по имени или адресу…"
                  emptyText="Объект не найден"
                  disabled={!client}
                />
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
                <Label>
                  Услуги{' '}
                  {isDuplicate
                    ? '(скопировано — можно править)'
                    : objectId
                      ? '(из прошлого наряда — можно править)'
                      : ''}
                  {loadingDefaults && (
                    <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin text-content-muted" />
                  )}
                </Label>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
                >
                  <Plus className="w-3 h-3" /> услуга
                </button>
              </div>
              {rows.length === 0 && !loadingDefaults && (
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
                            {/* Полное название (с видом в скобках) — у Регины несколько услуг
                                с одинаковым коротким именем «Дезинсекция», но разным видом
                                (тараканы/осы/муравьи). Короткое имя их не различало. */}
                            {c.name}
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

            {/* Чеклист для мастера */}
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <Label>
                  Чеклист для мастера
                  {chkLoading && (
                    <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin text-content-muted" />
                  )}
                </Label>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={loadFromTemplates}
                    className="px-2 py-1 text-xs text-content-secondary border border-gray-300 rounded hover:border-neon-orange hover:text-neon-orange"
                  >
                    Из шаблонов услуг
                  </button>
                  <button
                    type="button"
                    onClick={loadFromLastOrder}
                    className="px-2 py-1 text-xs text-content-secondary border border-gray-300 rounded hover:border-neon-orange hover:text-neon-orange"
                  >
                    Из прошлого наряда
                  </button>
                  <button
                    type="button"
                    onClick={addChkRow}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
                  >
                    <Plus className="w-3 h-3" /> пункт
                  </button>
                </div>
              </div>

              {pendingInsert && (
                <div className="mb-2 p-2 rounded border border-neon-orange/40 bg-neon-orange/5 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    Взять {pendingInsert.items.length} пункт(ов) из «{pendingInsert.label}» — в чеклисте
                    уже есть пункты:
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => confirmInsert('append')}
                      className="px-2 py-1 rounded bg-neon-orange/15 text-neon-orange hover:bg-neon-orange/25"
                    >
                      Добавить
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmInsert('replace')}
                      className="px-2 py-1 rounded border border-gray-300 hover:border-red-400 hover:text-red-500"
                    >
                      Заменить
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingInsert(null)}
                      className="px-2 py-1 rounded text-content-muted hover:text-content-primary"
                    >
                      Отмена
                    </button>
                  </span>
                </div>
              )}

              {checklist.length === 0 && !chkLoading && (
                <p className="text-xs text-content-muted">
                  Пунктов нет. Подтянутся из услуг объекта / прошлого наряда, либо добавь вручную.
                </p>
              )}

              <div className="space-y-2">
                {checklist.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-8 space-y-1">
                      <input
                        className={fieldClass}
                        placeholder="Что проверить / сделать"
                        value={row.title}
                        onChange={(e) => patchChkRow(i, { title: e.target.value })}
                      />
                      <input
                        className={fieldClass}
                        placeholder="Подсказка мастеру (необязательно)"
                        value={row.description}
                        onChange={(e) => patchChkRow(i, { description: e.target.value })}
                      />
                    </div>
                    <label className="col-span-9 sm:col-span-3 flex items-center gap-1.5 text-xs text-content-secondary pt-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-neon-orange"
                        checked={row.required}
                        onChange={(e) => patchChkRow(i, { required: e.target.checked })}
                      />
                      обязательный
                    </label>
                    <div className="col-span-3 sm:col-span-1 flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => removeChkRow(i)}
                        className="p-2 text-content-muted hover:text-red-500"
                        aria-label="Удалить пункт"
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
