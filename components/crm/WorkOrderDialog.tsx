'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, MapPin } from 'lucide-react';
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
import { CrewPicker } from '@/components/crm/CrewPicker';
import {
  NO_MASTER_PAY_LABEL,
  PriceSourceTag,
  isBadPrice,
  normalizePrice,
  priceToInput,
  toPriceSource,
  type PriceSource,
} from '@/components/crm/WorkOrderPricingButton';
import { UNIT_OPTIONS, formatQuantity, unitLabel } from '@/lib/constants/units';
import { TREATMENT_METHODS } from '@/lib/constants/treatment';
import { mskLocalToUtcISO } from '@/lib/datetime/msk';
import { formatRub, toKop } from '@/lib/finance/compute';
import {
  getDealPriceHints,
  type DealPriceHint,
} from '@/app/(crm)/manager/calendar/work-order-pricing-actions';
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
  type WorkOrderObject,
} from '@/app/(crm)/manager/calendar/work-order-actions';
import {
  updateWorkOrderAction,
  type WorkOrderEditPrefill,
  type WorkOrderEditChecklistItem,
} from '@/app/(crm)/manager/calendar/work-order-edit-actions';
import type { PriceItemUnit } from '@/lib/db/schema/deals';

const fieldClass =
  'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none';

type SvcRow = {
  serviceId: string;
  customName: string;
  method: string;
  unit: PriceItemUnit;
  quantity: string;
  /** Цена строки, ₽ (ввод как есть, допускает запятую); '' — не указана. */
  price: string;
  /**
   * 'contract' — подставлена из прайса договора (пересчитывается при смене договора/объекта/
   * услуги), 'manual' — введена руками (не трогаем, в т.ч. осознанно очищенная), null — пусто,
   * форма может подставить цену из прайса.
   */
  priceSource: PriceSource;
  /**
   * Строка существующего наряда в режиме правки: цену из прайса НЕ пересчитываем и пустую
   * не подставляем (иначе правка препаратов молча переоценила бы старый наряд). Снимается,
   * как только в строке меняют услугу или объект.
   */
  frozen?: boolean;
};

/**
 * Блок наряда = один объект + его услуги. Наряд состоит из 1..N блоков (мульти-объектный
 * наряд, запрос Регины 03.09.2026): один выезд на несколько объектов клиента (АРУМ: Отель 4*,
 * ТКО 4*, Отель 5*…), в АВР/АО каждая услуга идёт строкой со СВОИМ объектом и площадью.
 * Первый блок — основной объект наряда (календарь/списки показывают его + «+N»).
 */
type ObjectBlock = {
  /** Локальный стабильный ключ (React key, адресация при async-подгрузке). */
  key: string;
  objectId: string;
  rows: SvcRow[];
  loading: boolean;
};

type ChecklistRow = {
  /** Локальный стабильный ключ строки (для React key при удалении). */
  id: string;
  title: string;
  description: string;
  required: boolean;
  source: 'template' | 'manager';
  sourceTemplateId: string | null;
  /** Режим правки: id пункта в БД (нет — новый пункт). */
  dbId?: string;
  /** Пункт отмечен мастером (статус/заметка/фото) — только просмотр, удалить нельзя. */
  marked?: boolean;
  status?: 'pending' | 'done' | 'na';
  photosCount?: number;
  /** Пункт добавил сам мастер на выезде. */
  byMaster?: boolean;
};

// Пункты существующего наряда (режим правки) → строки формы, с id из БД и отметками мастера.
function editChkRows(items: WorkOrderEditChecklistItem[]): ChecklistRow[] {
  return items.map((c) => ({
    id: crypto.randomUUID(),
    title: c.title,
    description: c.description ?? '',
    required: c.required,
    source: c.source === 'template' ? 'template' : 'manager',
    sourceTemplateId: c.sourceTemplateId,
    dbId: c.id,
    marked: c.marked,
    status: c.status,
    photosCount: c.photosCount,
    byMaster: c.source === 'master',
  }));
}

const CHK_STATUS_LABEL: Record<'pending' | 'done' | 'na', string> = {
  pending: 'не отмечен',
  done: 'выполнено',
  na: 'неприменимо',
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

// Дедуп по заголовку (без регистра) — повторный подтяг не плодит дубли.
function mergeChecklist(cur: ChecklistRow[], ins: ChecklistRow[]): ChecklistRow[] {
  const seen = new Set(cur.map((c) => c.title.trim().toLowerCase()));
  const fresh = ins.filter((c) => !seen.has(c.title.trim().toLowerCase()));
  return [...cur, ...fresh];
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

// Услуга-дефолт (из последнего наряда / дубля) → строка формы. Цена прошлого наряда
// приезжает вместе с источником; пустая — форма подставит из прайса договора.
function svcToRow(s: WorkOrderDefaultService): SvcRow {
  return {
    serviceId: s.serviceId ?? '',
    customName: s.customName ?? '',
    method: s.method ?? '',
    unit: s.unit,
    quantity: trimNum(s.quantity),
    price: priceToInput(s.price),
    priceSource: toPriceSource(s.price, s.priceSource),
  };
}

function emptyRow(): SvcRow {
  return {
    serviceId: '',
    customName: '',
    method: '',
    unit: 'm2',
    quantity: '',
    price: '',
    priceSource: null,
  };
}

// Цена «из договора» относится к прежней паре договор/объект/услуга — при их смене её
// снимаем, эффект подставит заново (если в новом прайсе цена однозначна). Ручную не трогаем.
function dropContractPrice(r: SvcRow): SvcRow {
  return r.priceSource === 'contract' ? { ...r, price: '', priceSource: null, frozen: false } : r;
}

/**
 * Различные цены прайса договора для (объект, услуга) — то же правило, что
 * pickContractPrice на сервере: подставляем, только если цена ровно одна.
 */
function contractPrices(hints: DealPriceHint[], objectId: string, serviceId: string): string[] {
  const set = new Set<string>();
  for (const h of hints) {
    if (h.serviceId !== serviceId || h.objectId !== objectId) continue;
    const p = normalizePrice(h.priceWithVat);
    if (p !== null) set.add(p);
  }
  return Array.from(set);
}

type PriceChoice = { price: string; note: string };

/**
 * Варианты цены для ручного выбора, когда авто-подстановки нет (в прайсе несколько цен
 * на услугу или позиция прайса без объекта). Если однозначная цена есть — только она
 * (кнопка «вернуть цену договора» после ручной правки).
 */
function priceChoices(hints: DealPriceHint[], objectId: string, serviceId: string): PriceChoice[] {
  const strict = contractPrices(hints, objectId, serviceId);
  const seen = new Map<string, PriceChoice>();
  for (const h of hints) {
    if (h.serviceId !== serviceId) continue;
    if (h.objectId !== objectId && h.objectId !== null) continue;
    const p = normalizePrice(h.priceWithVat);
    if (p === null || seen.has(p)) continue;
    if (strict.length === 1 && p !== strict[0]) continue;
    const area = Number(h.areaM2) > 0 ? `${formatQuantity(h.areaM2)} ${unitLabel(h.unit)}` : '';
    const note = [h.label, area, h.frequency ?? '', h.objectId === null ? 'без объекта' : '']
      .filter(Boolean)
      .join(' · ');
    seen.set(p, { price: p, note });
  }
  return Array.from(seen.values());
}

// «2 цены», «5 цен», «21 цена».
function pricesWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'цена';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'цены';
  return 'цен';
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
      price: priceToInput(s.price),
      priceSource: toPriceSource(s.price, s.priceSource),
    };
  }
  return svcToRow(s);
}

function rowFilled(r: SvcRow): boolean {
  return !!(r.serviceId || r.customName.trim());
}

function newBlock(objectId = ''): ObjectBlock {
  return { key: crypto.randomUUID(), objectId, rows: [], loading: false };
}

// Блоки дубля: услуги исходного наряда разложены по своим объектам (порядок = objectIds,
// основной первым). Объект без услуг (маловероятно) остаётся пустым блоком.
function blocksFromDuplicate(
  prefill: Pick<WorkOrderDuplicatePrefill, 'objectIds' | 'services'>,
  catalogIds: Set<string>,
  /** Режим правки: цены строк существующего наряда не пересчитываем из прайса. */
  freeze = false,
): ObjectBlock[] {
  const byObject = new Map<string, SvcRow[]>();
  for (const id of prefill.objectIds) byObject.set(id, []);
  for (const s of prefill.services) {
    const arr = byObject.get(s.objectId) ?? [];
    const row = dupSvcToRow(s, catalogIds);
    arr.push(freeze ? { ...row, frozen: true } : row);
    byObject.set(s.objectId, arr);
  }
  const blocks = Array.from(byObject.entries()).map(([objectId, rows]) => ({
    key: crypto.randomUUID(),
    objectId,
    rows,
    loading: false,
  }));
  return blocks.length > 0 ? blocks : [newBlock()];
}

// Опция объекта для Combobox. В описании — площадь и услуги объекта, а не только адрес:
// у Регины объекты заведены «место × услуга» (АРУМ: два «Отель 4*» с одним адресом,
// 2 067,82 м² дезинсекция и 4 694,40 м² дератизация) — без площади/услуги они неразличимы.
// Адрес остаётся — для сетей (Хадыжи: 31 магазин с одним именем) различает именно он.
function objectOption(o: WorkOrderObject): ComboboxOption {
  const area = o.areaM2 ? `${formatQuantity(o.areaM2)} м²` : '';
  const svcs = o.services.map((s) => s.label).join(', ');
  const showType = !!o.objectType && o.objectType.trim() !== o.name.trim();
  return {
    value: o.id,
    label: `${o.name}${showType ? ` — ${o.objectType}` : ''}`,
    description: [area, svcs, o.address].filter(Boolean).join(' · '),
    keywords: [o.name, o.objectType, o.address, area, o.areaM2, svcs].filter(
      (x): x is string => !!x,
    ),
  };
}

/**
 * Форма заказ-наряда. Рендерить только когда открыт (вызывающий: `{open && <... />}`),
 * чтобы preset применялся при каждом открытии. Используется из календаря (кнопка),
 * панели напоминаний, карточки объекта и таба сделки.
 */
export function WorkOrderDialog({
  data,
  preset,
  duplicatePrefill,
  editPrefill,
  onClose,
  onCreated,
}: {
  data: WorkOrderFormData;
  preset?: WorkOrderPreset;
  /**
   * Режим дублирования: форма открывается с данными конкретного наряда (клиент/договор/
   * объекты/мастер/услуги/препараты/чеклист), дата пустая. Поля цели редактируемы — копию
   * можно перенести на другие объекты/договор/клиента (услуги/чеклист не перетираются).
   */
  duplicatePrefill?: WorkOrderDuplicatePrefill;
  /**
   * Режим правки существующего наряда (07.11.2026, любой статус): клиент и договор
   * зафиксированы, остальное правится; пункты чеклиста, отмеченные мастером, — только просмотр.
   */
  editPrefill?: WorkOrderEditPrefill;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasClients = data.clients.length > 0;
  const isDuplicate = !!duplicatePrefill;
  const isEdit = !!editPrefill;
  // Источник предзаполнения: правка существующего наряда или копия.
  const src = editPrefill ?? duplicatePrefill;

  const [clientId, setClientId] = useState(src?.clientId ?? preset?.clientId ?? '');
  const [dealId, setDealId] = useState(src?.dealId ?? preset?.dealId ?? '');
  // Мастер дубля — только если он ещё мастер (мог сменить роль/уволиться); иначе пусто.
  // В правке неактивный мастер наряда приходит в data.masters с пометкой «(неактивен)».
  const [masterId, setMasterId] = useState(
    src?.masterId && data.masters.some((m) => m.id === src.masterId) ? src.masterId : '',
  );
  // Напарники (бригада, 10.2026): дубль едет тем же составом — кроме тех, кто уже не мастер.
  const [partnerIds, setPartnerIds] = useState<string[]>(() =>
    (src?.partnerIds ?? []).filter((id) => data.masters.some((m) => m.id === id)),
  );
  const [plannedAt, setPlannedAt] = useState(
    editPrefill?.plannedAtLocal ?? preset?.plannedAtLocal ?? '',
  ); // datetime-local
  const [preparations, setPreparations] = useState(src?.preparations ?? '');
  // Объекты наряда с услугами. Всегда ≥1 блок (пустой блок = «выбери объект»).
  const [blocks, setBlocks] = useState<ObjectBlock[]>(() => {
    if (!src) return [newBlock()];
    const catalogIds = new Set(data.catalog.map((c) => c.id));
    return blocksFromDuplicate(src, catalogIds, isEdit);
  });
  const [checklist, setChecklist] = useState<ChecklistRow[]>(
    editPrefill
      ? editChkRows(editPrefill.checklist)
      : duplicatePrefill
        ? toChkRows(duplicatePrefill.checklist)
        : [],
  );
  const [chkLoading, setChkLoading] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<{
    items: ChecklistRow[];
    label: string;
  } | null>(null);
  // «Документальный» наряд: мастеру 0 %, вся сумма в кассу организации.
  // Дубль копирует и «документальный» (копия того же типа наряда).
  const [noMasterPay, setNoMasterPay] = useState(src?.noMasterPay ?? false);
  // Прайс выбранного договора — подсказки цены строк. Привязан к dealId: пока грузится
  // прайс нового договора, старые подсказки не применяются.
  const [hints, setHints] = useState<{ dealId: string; items: DealPriceHint[] } | null>(null);
  // Открытый выбор цены из прайса: ключ `${blockKey}:${rowIndex}`.
  const [choiceOpen, setChoiceOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      setHints(null);
      return;
    }
    let alive = true;
    getDealPriceHints(dealId)
      .then((items) => {
        if (alive) setHints({ dealId, items });
      })
      .catch(() => {
        // Без подсказок форма работает как раньше — цену можно ввести руками.
        if (alive) setHints({ dealId, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [dealId]);
  const dealHints = hints && hints.dealId === dealId ? hints.items : null;

  // Подстановка цены из прайса: строкам с услугой из каталога, где цена пуста или взята
  // из договора, ставим ОДНОЗНАЧНУЮ цену (объект блока + услуга). Ручные цены не трогаем.
  // Апдейтер возвращает тот же массив, если менять нечего, — без лишних рендеров и циклов.
  useEffect(() => {
    if (!dealHints || dealHints.length === 0) return;
    setBlocks((bs) => {
      let changed = false;
      const next = bs.map((b) => {
        if (!b.objectId) return b;
        let rowsChanged = false;
        const rows = b.rows.map((r) => {
          if (!r.serviceId || r.frozen) return r;
          const auto = r.priceSource === 'contract' || (r.priceSource === null && !r.price.trim());
          if (!auto) return r;
          const prices = contractPrices(dealHints, b.objectId, r.serviceId);
          if (prices.length !== 1) return r;
          const v = priceToInput(prices[0]);
          if (r.price === v && r.priceSource === 'contract') return r;
          rowsChanged = true;
          return { ...r, price: v, priceSource: 'contract' as const };
        });
        if (!rowsChanged) return b;
        changed = true;
        return { ...b, rows };
      });
      return changed ? next : bs;
    });
  }, [dealHints, blocks]);

  const client = useMemo(
    () => data.clients.find((c) => c.id === clientId) ?? null,
    [data.clients, clientId],
  );

  // Combobox-опции для клиента и объектов (поиск по подстроке вместо нативного select).
  const clientOptions = useMemo<ComboboxOption[]>(
    () => data.clients.map((c) => ({ value: c.id, label: c.shortName, keywords: [c.shortName] })),
    [data.clients],
  );
  const allObjectOptions = useMemo<ComboboxOption[]>(
    () => (client?.objects ?? []).map(objectOption),
    [client],
  );
  const objectsById = useMemo(
    () => new Map((client?.objects ?? []).map((o) => [o.id, o])),
    [client],
  );
  // Объект, уже взятый в другой блок, из выпадашки этого блока убираем — один объект = один блок.
  function optionsFor(blockKey: string): ComboboxOption[] {
    const taken = new Set(
      blocks.filter((b) => b.key !== blockKey && b.objectId).map((b) => b.objectId),
    );
    return allObjectOptions.filter((o) => !taken.has(o.value));
  }

  function patchBlock(key: string, patch: Partial<ObjectBlock>) {
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }

  // Выбор объекта в блоке + подгрузка его дефолтов (последний наряд → услуги объекта).
  async function pickObject(key: string, objectId: string) {
    setPendingInsert(null);
    // Режим дубля/правки: услуги/препараты/чеклист уже подставлены из наряда —
    // смена объекта НЕ должна затирать их дефолтами целевого объекта.
    if (isDuplicate || isEdit) {
      // Цены «из договора» были по прежнему объекту — снимаем, подставятся по новому.
      setBlocks((bs) =>
        bs.map((b) =>
          b.key === key && b.objectId !== objectId
            ? { ...b, objectId, rows: b.rows.map(dropContractPrice) }
            : b,
        ),
      );
      return;
    }
    if (!objectId) {
      patchBlock(key, { objectId: '', rows: [], loading: false });
      return;
    }
    // Первый блок задаёт стартовый чеклист/препараты/мастера (как раньше в одиночном
    // наряде); остальные блоки только ДОПИСЫВАЮТ пункты чеклиста и заполняют пустое.
    const isFirst = blocks.findIndex((b) => b.key === key) === 0;
    patchBlock(key, { objectId, loading: true });
    try {
      const d = await getObjectWorkOrderDefaults(objectId);
      // Пока грузили, объект в блоке могли сменить — тогда эти услуги уже не нужны.
      setBlocks((bs) =>
        bs.map((b) =>
          b.key === key && b.objectId === objectId
            ? { ...b, rows: d.services.map(svcToRow), loading: false }
            : b,
        ),
      );
      const chk = toChkRows(d.checklist);
      if (isFirst) setChecklist(chk);
      else if (chk.length > 0) setChecklist((cur) => mergeChecklist(cur, chk));
      if (d.source === 'last_order') {
        if (isFirst) setPreparations(d.preparations ?? '');
        else if (d.preparations) setPreparations((p) => p || d.preparations || '');
        if (d.masterId) {
          const mid = d.masterId;
          if (isFirst) setMasterId(mid);
          else setMasterId((m) => m || mid);
        }
        // Бригада прошлого наряда объекта — по умолчанию едет тем же составом.
        const known = d.partnerIds.filter((id) => data.masters.some((m) => m.id === id));
        if (isFirst) setPartnerIds(known);
        else if (known.length > 0) setPartnerIds((cur) => (cur.length > 0 ? cur : known));
      }
    } catch {
      toast.error('Не удалось подтянуть услуги объекта — добавь вручную');
    } finally {
      setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, loading: false } : b)));
    }
  }

  function addBlock() {
    setBlocks((bs) => [...bs, newBlock()]);
  }
  function removeBlock(key: string) {
    setBlocks((bs) => {
      const next = bs.filter((b) => b.key !== key);
      return next.length > 0 ? next : [newBlock()];
    });
  }

  // Применяем preset при открытии (объект → первый блок + подгрузка дефолтов).
  useEffect(() => {
    // В режиме дубля/правки данные уже подставлены — дефолты по объекту не тянем.
    if (isDuplicate || isEdit) return;
    if (preset?.objectId) {
      // Подстраховка: combobox объекта показывает подпись из опций, а опции зависят
      // от выбранного клиента. Если caller дал objectId без clientId — выведем клиента
      // из дерева, иначе строка объекта осталась бы пустой (placeholder при непустом id).
      if (!preset.clientId) {
        const owner = data.clients.find((c) => c.objects.some((o) => o.id === preset.objectId));
        if (owner) setClientId(owner.id);
      }
      pickObject(blocks[0].key, preset.objectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onClient(v: string) {
    setClientId(v);
    setDealId('');
    setPendingInsert(null);
    setChoiceOpen(null);
    if (isDuplicate) {
      // В режиме дубля услуги/чеклист/препараты переносятся на нового клиента — не чистим,
      // только снимаем объекты (они принадлежали старому клиенту) и цены старого договора.
      setBlocks((bs) =>
        bs.map((b) => ({ ...b, objectId: '', rows: b.rows.map(dropContractPrice) })),
      );
    } else {
      setBlocks([newBlock()]);
      setChecklist([]);
    }
  }

  // Смена договора: цены «из договора» были по старому прайсу — снимаем, эффект подставит
  // однозначные цены нового договора, как только прайс загрузится.
  function onDeal(v: string) {
    if (v === dealId) return;
    setDealId(v);
    setChoiceOpen(null);
    setBlocks((bs) => bs.map((b) => ({ ...b, rows: b.rows.map(dropContractPrice) })));
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
    // Отмеченный мастером пункт удалить нельзя (кнопки у него нет; страховка от гонки).
    setChecklist((c) => c.filter((row, idx) => idx !== i || row.marked));
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
    // «Заменить» в правке не трогает пункты, отмеченные мастером.
    setChecklist((cur) =>
      mode === 'replace' ? mergeChecklist(cur.filter((c) => c.marked), ins) : mergeChecklist(cur, ins),
    );
    setPendingInsert(null);
  }
  async function loadFromTemplates() {
    // Услуги всех блоков — чеклист один на весь выезд.
    const serviceIds = blocks
      .flatMap((b) => b.rows.map((r) => r.serviceId))
      .filter((x): x is string => !!x);
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
    const first = blocks.find((b) => b.objectId);
    if (!first) {
      toast.error('Сначала выбери объект');
      return;
    }
    setChkLoading(true);
    try {
      const items = await getLastOrderChecklist(first.objectId);
      applyOrAsk(toChkRows(items), 'прошлый наряд');
    } finally {
      setChkLoading(false);
    }
  }

  // ── Услуги блока ──
  function addRow(blockKey: string) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key === blockKey ? { ...b, rows: [...b.rows, emptyRow()] } : b,
      ),
    );
  }
  function removeRow(blockKey: string, i: number) {
    setChoiceOpen(null);
    setBlocks((bs) =>
      bs.map((b) => (b.key === blockKey ? { ...b, rows: b.rows.filter((_, idx) => idx !== i) } : b)),
    );
  }
  function patchRow(blockKey: string, i: number, patch: Partial<SvcRow>) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key === blockKey
          ? { ...b, rows: b.rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) }
          : b,
      ),
    );
  }
  function onPickService(blockKey: string, i: number, value: string) {
    // Другая услуга — другая цена: снимаем всё, кроме введённой руками суммы
    // (пустая/из договора освобождается под подстановку из прайса).
    const cur = blocks.find((b) => b.key === blockKey)?.rows[i];
    const keepManual = cur?.priceSource === 'manual' && cur.price.trim() !== '';
    const pricePatch: Partial<SvcRow> = keepManual
      ? { frozen: false }
      : { price: '', priceSource: null, frozen: false };
    if (choiceOpen === `${blockKey}:${i}`) setChoiceOpen(null);
    if (value === '__custom__') {
      patchRow(blockKey, i, { serviceId: '', customName: '', ...pricePatch });
      return;
    }
    const svc = data.catalog.find((c) => c.id === value);
    patchRow(blockKey, i, {
      serviceId: value,
      customName: '',
      method: svc?.defaultMethod ?? '',
      ...pricePatch,
    });
  }

  // allowSameDay — второй заход после переспроса «на объект в этот день уже есть наряд».
  // Пустой по умолчанию: сама форма флаг не ставит, только пользователь через подтверждение.
  function submit(allowSameDay = false) {
    const filled = blocks.filter((b) => b.objectId);
    if (!dealId || filled.length === 0) {
      toast.error('Выбери договор и объект');
      return;
    }
    if (blocks.some((b) => !b.objectId && b.rows.some(rowFilled))) {
      toast.error('Есть услуги без объекта — выбери объект в этом блоке или удали его');
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
    if (isEdit && !plannedAt) {
      toast.error('Укажи дату и время наряда');
      return;
    }
    // Объект без услуг выпал бы из акта (строки идут по услугам) — не даём его сохранить.
    const empty = filled.find((b) => !b.rows.some(rowFilled));
    if (empty) {
      const name = objectsById.get(empty.objectId)?.name ?? 'объект';
      toast.error(`У объекта «${name}» нет услуг — добавь услугу или убери объект из наряда`);
      return;
    }
    if (filled.some((b) => b.rows.some((r) => rowFilled(r) && isBadPrice(r.price)))) {
      toast.error('Цена услуги — неотрицательное число, например 1500 или 1500,50');
      return;
    }
    const objectIds = filled.map((b) => b.objectId);
    const services = filled.flatMap((b) =>
      b.rows.filter(rowFilled).map((r) => {
        // Нормализуем как сервер («1 500,5» → '1500.50'); пусто → цены нет, источника тоже.
        const price = normalizePrice(r.price);
        const priceSource: PriceSource =
          price === null ? null : r.priceSource === 'contract' ? 'contract' : 'manual';
        return {
          serviceId: r.serviceId || null,
          customName: r.customName.trim() || null,
          method: r.method.trim() || null,
          unit: r.unit,
          quantity: r.quantity.trim() ? r.quantity.replace(',', '.') : null,
          objectId: b.objectId,
          price,
          priceSource,
        };
      }),
    );
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

    if (editPrefill) {
      const editId = editPrefill.workLogId;
      startTransition(async () => {
        const res = await updateWorkOrderAction({
          workLogId: editId,
          objectIds,
          masterId,
          partnerIds: partnerIds.filter((id) => id !== masterId),
          plannedAtIso,
          preparations: preparations.trim() || null,
          services,
          checklist: checklist
            .filter((c) => c.title.trim())
            .map((c) => ({
              id: c.dbId ?? null,
              title: c.title.trim(),
              description: c.description.trim() || null,
              required: c.required,
              source: c.source,
              sourceTemplateId: c.sourceTemplateId,
            })),
          noMasterPay,
          allowSameDay,
          // Пункты, которые были в форме при открытии: удалять сервер будет только из них.
          knownChecklistIds: editPrefill.checklist.map((c) => c.id),
        });
        if (res.ok) {
          toast.success('Наряд сохранён');
          onCreated?.();
          router.refresh();
          onClose();
        } else if (res.needsConfirm) {
          if (window.confirm(`${res.error}\n\nВсё равно сохранить на этот день?`)) {
            submit(true);
          }
        } else {
          toast.error(res.error);
        }
      });
      return;
    }

    startTransition(async () => {
      const res = await createWorkOrderAction({
        dealId,
        objectId: objectIds[0],
        objectIds,
        masterId,
        // Основного мастера в напарниках быть не может (сменили основного на напарника).
        partnerIds: partnerIds.filter((id) => id !== masterId),
        plannedAtIso,
        preparations: preparations.trim() || null,
        services,
        checklist: checklistPayload,
        allowSameDay,
        noMasterPay,
      });
      if (res.ok) {
        toast.success(
          objectIds.length > 1
            ? `Заказ-наряд на ${objectIds.length} объекта(ов) создан — выезд появился в календаре`
            : 'Заказ-наряд создан — выезд появился в календаре',
        );
        onCreated?.();
        router.refresh();
        onClose();
      } else if (res.needsConfirm) {
        // Не ошибка, а вопрос: на объект в этот день уже стоит наряд. Разные услуги
        // на одном объекте — законный сценарий, поэтому даём создать второй.
        if (window.confirm(`${res.error}\n\nСоздать ещё один наряд на этот день?`)) {
          submit(true);
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  const canAddBlock = blocks.every((b) => b.objectId);
  const multi = blocks.length > 1;

  // Итог наряда по заполненным строкам: Σ цен (копейки); null — ни одной цены.
  const priceTotals = useMemo(() => {
    let sum = 0;
    let priced = 0;
    let unpriced = 0;
    for (const b of blocks) {
      for (const r of b.rows) {
        if (!rowFilled(r)) continue;
        const p = normalizePrice(r.price);
        if (p === null) {
          unpriced++;
          continue;
        }
        sum += toKop(p) ?? 0;
        priced++;
      }
    }
    return { totalKop: priced > 0 ? sum : null, unpriced, rows: priced + unpriced };
  }, [blocks]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            {isEdit
              ? 'Редактировать заказ-наряд'
              : isDuplicate
                ? 'Дублировать заказ-наряд'
                : 'Новый заказ-наряд'}
          </DialogTitle>
        </DialogHeader>

        {editPrefill && (
          <p className="text-xs text-content-muted -mt-1">
            {editPrefill.status === 'completed'
              ? 'Наряд выполнен. Правка услуг и цен сразу меняет сводку месяца; уже выданные акты не меняются — после правки сформируй их заново.'
              : editPrefill.status === 'in_progress'
                ? 'Мастер уже в работе — изменения бригада увидит сразу (придёт уведомление).'
                : 'Изменения бригада увидит сразу (придёт уведомление).'}{' '}
            Клиент и договор у наряда не меняются; пункты чеклиста, отмеченные мастером, — только
            для просмотра.
          </p>
        )}

        {isDuplicate && hasClients && (
          <p className="text-xs text-content-muted -mt-1">
            Скопировано из наряда. Поставь новую дату; при необходимости смени объекты, договор
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
              {/* min-w-0 на ячейках грида: иначе селект с длинным option (полное имя услуги,
                  номер договора) держит intrinsic-ширину, ряд распирает диалог и появляется
                  горизонтальный скролл (жалоба Регины 11.09) */}
              <div className="min-w-0">
                <Label htmlFor="wo-client">Клиент</Label>
                <Combobox
                  id="wo-client"
                  options={clientOptions}
                  value={clientId}
                  onChange={onClient}
                  disabled={isEdit}
                  placeholder="— выбери клиента —"
                  searchPlaceholder="Поиск по названию…"
                  emptyText="Клиент не найден"
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="wo-deal">Договор</Label>
                <select
                  id="wo-deal"
                  className={fieldClass}
                  value={dealId}
                  onChange={(e) => onDeal(e.target.value)}
                  disabled={!client || isEdit}
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

            {/* Мастер + дата */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
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
              <div className="min-w-0">
                <Label htmlFor="wo-date">Дата и время выезда</Label>
                <input
                  id="wo-date"
                  type="datetime-local"
                  className={fieldClass}
                  value={plannedAt}
                  onChange={(e) => setPlannedAt(e.target.value)}
                />
              </div>
            </div>

            {/* Бригада: напарники основного мастера (объекты, где работают вдвоём и больше) */}
            {masterId && data.masters.length > 1 && (
              <div>
                <Label>Напарники (бригада)</Label>
                <p className="text-xs text-content-muted mb-2">
                  Наряд увидит каждый из бригады, отметить чеклист и завершить может любой.
                </p>
                <CrewPicker
                  masters={data.masters}
                  primaryId={masterId}
                  value={partnerIds}
                  onChange={setPartnerIds}
                />
              </div>
            )}

            {/* Объекты и услуги: блок на объект, один наряд может охватывать несколько объектов */}
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <Label>Объекты и услуги</Label>
                <button
                  type="button"
                  onClick={addBlock}
                  disabled={!client || !canAddBlock}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10 disabled:opacity-50 disabled:pointer-events-none"
                  title="Добавить ещё один объект в этот же выезд"
                >
                  <Plus className="w-3 h-3" /> объект
                </button>
              </div>
              <p className="text-xs text-content-muted mb-2">
                Один наряд может охватывать несколько объектов клиента — в акте каждый пойдёт
                отдельной строкой со своей площадью и услугой.
              </p>

              <div className="space-y-3">
                {blocks.map((b, bi) => (
                  <div
                    key={b.key}
                    className="rounded-md border border-gray-200 p-3 space-y-2 bg-bg-secondary/30"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-neon-orange flex-shrink-0 mt-3" />
                      <div className="flex-1 min-w-0">
                        {multi && (
                          <div className="text-[10px] uppercase tracking-wider text-content-muted font-orbitron">
                            Объект {bi + 1}
                            {bi === 0 ? ' · основной' : ''}
                          </div>
                        )}
                        <Combobox
                          id={`wo-object-${b.key}`}
                          options={optionsFor(b.key)}
                          value={b.objectId}
                          onChange={(v) => pickObject(b.key, v)}
                          placeholder="— объект —"
                          searchPlaceholder="Поиск по имени, адресу, площади…"
                          emptyText="Объект не найден"
                          disabled={!client}
                          className="mt-0"
                        />
                      </div>
                      {(multi || b.objectId) && (
                        <button
                          type="button"
                          onClick={() => removeBlock(b.key)}
                          className="p-2 mt-1 text-content-muted hover:text-red-500"
                          aria-label="Убрать объект из наряда"
                          title="Убрать объект из наряда"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-content-secondary">
                        Услуги
                        {b.rows.length > 0 && !isDuplicate && !isEdit && ' (из прошлого наряда — можно править)'}
                        {isEdit && b.rows.length > 0 && ' наряда'}
                        {isDuplicate && b.rows.length > 0 && ' (скопировано — можно править)'}
                        {b.loading && (
                          <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin text-content-muted" />
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => addRow(b.key)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-neon-orange border border-neon-orange/40 rounded hover:bg-neon-orange/10"
                      >
                        <Plus className="w-3 h-3" /> услуга
                      </button>
                    </div>
                    {b.rows.length === 0 && !b.loading && (
                      <p className="text-xs text-content-muted">
                        Выбери объект — услуги подтянутся, либо добавь вручную.
                      </p>
                    )}
                    <div className="space-y-2">
                      {b.rows.map((row, i) => {
                        // Цена строки: подсказки из прайса договора (объект блока + услуга).
                        const rowKey = `${b.key}:${i}`;
                        const choices =
                          dealHints && b.objectId && row.serviceId
                            ? priceChoices(dealHints, b.objectId, row.serviceId)
                            : [];
                        const curPrice = normalizePrice(row.price);
                        const showChoices =
                          choices.length > 1 ||
                          (choices.length === 1 && curPrice !== choices[0].price);
                        const badPrice = isBadPrice(row.price);
                        return (
                          <div
                            key={i}
                            className="space-y-1.5 pb-2 border-b border-gray-100 last:border-b-0 last:pb-0"
                          >
                            <div className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-12 sm:col-span-4 min-w-0">
                                <select
                                  className={fieldClass}
                                  value={row.serviceId || '__custom__'}
                                  onChange={(e) => onPickService(b.key, i, e.target.value)}
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
                                    onChange={(e) => patchRow(b.key, i, { customName: e.target.value })}
                                  />
                                )}
                              </div>
                              <div className="col-span-6 sm:col-span-3 min-w-0">
                                <select
                                  className={fieldClass}
                                  value={row.method}
                                  onChange={(e) => patchRow(b.key, i, { method: e.target.value })}
                                >
                                  <option value="">способ…</option>
                                  {methodOptions(row.method).map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-3 sm:col-span-2 min-w-0">
                                <input
                                  className={fieldClass}
                                  inputMode="decimal"
                                  placeholder="кол-во"
                                  value={row.quantity}
                                  onChange={(e) => patchRow(b.key, i, { quantity: e.target.value })}
                                />
                              </div>
                              <div className="col-span-6 sm:col-span-2 min-w-0">
                                <select
                                  className={fieldClass}
                                  value={row.unit}
                                  onChange={(e) =>
                                    patchRow(b.key, i, { unit: e.target.value as PriceItemUnit })
                                  }
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
                                  onClick={() => removeRow(b.key, i)}
                                  className="p-2 text-content-muted hover:text-red-500"
                                  aria-label="Удалить услугу"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Цена строки (видит только менеджер; мастеру цены не показываются) */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <label
                                htmlFor={`wo-price-${rowKey}`}
                                className="text-xs text-content-secondary"
                              >
                                Цена, ₽
                              </label>
                              <input
                                id={`wo-price-${rowKey}`}
                                className={`w-28 sm:w-32 px-2 py-1.5 text-sm bg-bg-primary border rounded-md focus:outline-none tabular-nums ${
                                  badPrice
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-gray-300 focus:border-neon-orange'
                                }`}
                                inputMode="decimal"
                                placeholder="не указана"
                                value={row.price}
                                onChange={(e) =>
                                  patchRow(b.key, i, { price: e.target.value, priceSource: 'manual' })
                                }
                              />
                              <PriceSourceTag price={row.price} source={row.priceSource} />
                              {showChoices &&
                                (choices.length === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchRow(b.key, i, {
                                        price: priceToInput(choices[0].price),
                                        priceSource: 'contract',
                                      })
                                    }
                                    className="text-[11px] px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                                    title={choices[0].note || 'Подставить цену из прайса договора'}
                                  >
                                    в договоре: {formatRub(toKop(choices[0].price))}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setChoiceOpen((c) => (c === rowKey ? null : rowKey))
                                    }
                                    className="text-[11px] px-1.5 py-0.5 rounded border border-gray-300 text-content-secondary hover:border-neon-orange hover:text-neon-orange whitespace-nowrap"
                                    aria-expanded={choiceOpen === rowKey}
                                  >
                                    в договоре {choices.length} {pricesWord(choices.length)} — выбрать
                                  </button>
                                ))}
                            </div>
                            {choiceOpen === rowKey && choices.length > 1 && (
                              <div className="rounded border border-gray-200 bg-bg-primary divide-y divide-gray-100">
                                {choices.map((c) => (
                                  <button
                                    key={c.price}
                                    type="button"
                                    onClick={() => {
                                      patchRow(b.key, i, {
                                        price: priceToInput(c.price),
                                        priceSource: 'contract',
                                      });
                                      setChoiceOpen(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-neon-orange/5 flex items-baseline justify-between gap-2"
                                  >
                                    <span className="min-w-0 break-words text-content-secondary">
                                      {c.note}
                                    </span>
                                    <span className="font-semibold tabular-nums whitespace-nowrap text-content-primary">
                                      {formatRub(toKop(c.price))}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Деньги наряда: итог по строкам + «документальный» (мастеру 0 %) */}
              <div className="mt-3 rounded-md border border-gray-200 px-3 py-2 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm text-content-primary">
                    Итого по наряду:{' '}
                    <b className="tabular-nums">
                      {priceTotals.totalKop === null
                        ? 'цена не указана'
                        : formatRub(priceTotals.totalKop)}
                    </b>
                  </span>
                  {priceTotals.unpriced > 0 && priceTotals.totalKop !== null && (
                    <span className="text-xs text-amber-700">
                      без цены: {priceTotals.unpriced} стр.
                    </span>
                  )}
                </div>
                <label className="flex items-start gap-2 text-xs text-content-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-neon-orange mt-0.5 flex-shrink-0"
                    checked={noMasterPay}
                    onChange={(e) => setNoMasterPay(e.target.checked)}
                  />
                  <span>{NO_MASTER_PAY_LABEL}</span>
                </label>
                <p className="text-[11px] text-content-muted">
                  Цены видят только менеджер и админ — мастеру они не показываются.
                </p>
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
                {checklist.map((row, i) =>
                  row.marked ? (
                    // Отмечен мастером (статус / заметка / фото) — только просмотр.
                    <div
                      key={row.id}
                      className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className="min-w-0 break-words">
                          {row.title}
                          {row.required && <span className="text-red-500"> *</span>}
                        </span>
                        <span className="text-xs text-content-muted shrink-0">
                          {CHK_STATUS_LABEL[row.status ?? 'pending']}
                          {(row.photosCount ?? 0) > 0 && ` · фото ${row.photosCount}`}
                          {row.byMaster && ' · добавил мастер'}
                        </span>
                      </div>
                      <p className="text-[11px] text-content-muted mt-0.5">
                        Отмечен мастером — не меняется и не удаляется.
                      </p>
                    </div>
                  ) : (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-8 space-y-1 min-w-0">
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
                  ),
                )}
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
          {/* Именно () => submit(): передать submit напрямую нельзя — в первый
              аргумент прилетит MouseEvent, и allowSameDay стал бы «истиной»,
              молча отключив переспрос о втором наряде на тот же день. */}
          {hasClients && (
            <CyberpunkButton variant="primary" onClick={() => submit()} disabled={isPending}>
              {isEdit
                ? isPending
                  ? 'Сохраняю…'
                  : 'Сохранить'
                : isPending
                  ? 'Создаю…'
                  : 'Создать наряд'}
            </CyberpunkButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
