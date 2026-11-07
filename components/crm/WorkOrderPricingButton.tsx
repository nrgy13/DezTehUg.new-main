'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Banknote, Loader2 } from 'lucide-react';
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
import { formatQuantity, unitLabel } from '@/lib/constants/units';
import { formatRub, toKop } from '@/lib/finance/compute';
import {
  getWorkOrderPricing,
  saveWorkOrderPricing,
  type WorkOrderPricing,
} from '@/app/(crm)/manager/calendar/work-order-pricing-actions';

// ─── Общие помощники цены (их же использует форма наряда WorkOrderDialog) ───

export type PriceSource = 'contract' | 'manual' | null;

/** Потолок суммы — как в серверной валидации (numeric(12,2) и здравый смысл). */
const MAX_PRICE = 100_000_000;

/**
 * Ввод цены → '1234.50' | null (пусто/мусор/минус). Зеркало normalizeLinePrice из
 * lib/visits/create.ts — тот модуль server-only, в клиент его не импортировать.
 * Допускает запятую и пробелы-разделители: «1 500,5» → '1500.50'.
 */
export function normalizePrice(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Непустой ввод, который сервер не примет (мусор, минус, слишком большая сумма). */
export function isBadPrice(v: string): boolean {
  if (!v.trim()) return false;
  const p = normalizePrice(v);
  return p === null || Number(p) >= MAX_PRICE;
}

/** Цена из БД ('1234.50') → значение поля ввода ('1234.5'). */
export function priceToInput(p: string | null | undefined): string {
  if (p === null || p === undefined || p === '') return '';
  const n = Number(p);
  return Number.isFinite(n) ? String(n) : p;
}

/** Источник цены из БД/дефолтов → значение формы (без цены источника нет). */
export function toPriceSource(price: string | null | undefined, src: string | null | undefined): PriceSource {
  if (!price || !String(price).trim()) return null;
  return src === 'contract' ? 'contract' : 'manual';
}

/** Метка рядом с полем цены: «из договора» / «своя». Без цены — ничего. */
export function PriceSourceTag({ price, source }: { price: string; source: PriceSource }) {
  if (!price.trim() || isBadPrice(price)) return null;
  return source === 'contract' ? (
    <span className="text-[10px] px-1.5 py-px rounded border border-emerald-200 bg-emerald-50 text-emerald-700 whitespace-nowrap">
      из договора
    </span>
  ) : (
    <span className="text-[10px] px-1.5 py-px rounded border border-neon-orange/30 bg-neon-orange/5 text-neon-orange whitespace-nowrap">
      своя
    </span>
  );
}

export const NO_MASTER_PAY_LABEL =
  'Без процента мастеру (документальный наряд — вся сумма в кассу организации)';

const priceInputClass = (bad: boolean) =>
  `w-28 sm:w-32 px-2 py-1.5 text-sm bg-bg-primary border rounded-md focus:outline-none tabular-nums ${
    bad ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-neon-orange'
  }`;

// ─── Кнопка + диалог «Цена наряда» ───

type Loaded = Extract<WorkOrderPricing, { ok: true }>;

type LineState = {
  id: string;
  name: string;
  objectName: string | null;
  quantity: string | null;
  unit: string;
  price: string;
  priceSource: PriceSource;
  contractPrice: string | null;
};

type CrewState = {
  userId: string;
  name: string;
  percent: number | null;
  /** Ручная сумма (ввод); пусто — считать по ставке. */
  override: string;
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'запланирован',
  in_progress: 'в работе',
  completed: 'выполнен',
};

function fmtDay(day: string | null): string | null {
  if (!day) return null;
  const [y, m, d] = day.split('-');
  return y && m && d ? `${d}.${m}.${y}` : day;
}

function fmtPercent(p: number): string {
  return `${p.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
}

/**
 * Кнопка «Цена» на карточке заказ-наряда (только менеджер/админ): цены строк услуг,
 * «документальный» наряд и начисления бригаде. Работает в ЛЮБОМ статусе — в т.ч.
 * выполненным нарядам можно задним числом указать цену (для сводки директору).
 */
export function WorkOrderPricingButton({
  workLogId,
  label,
}: {
  workLogId: string;
  /** true — кнопка с подписью «Цена», иначе только значок. */
  label?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<Loaded | null>(null);
  const [lines, setLines] = useState<LineState[]>([]);
  const [crew, setCrew] = useState<CrewState[]>([]);
  const [noMasterPay, setNoMasterPay] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Защита от гонки: закрыли/открыли заново, пока шёл прошлый запрос.
  const reqId = useRef(0);

  function openDialog() {
    const id = ++reqId.current;
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    setInfo(null);
    getWorkOrderPricing(workLogId)
      .then((res) => {
        if (id !== reqId.current) return;
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setInfo(res);
        setNoMasterPay(res.noMasterPay);
        setLines(
          res.lines.map((l) => ({
            id: l.id,
            name: l.name,
            objectName: l.objectName,
            quantity: l.quantity,
            unit: l.unit,
            price: priceToInput(l.price),
            priceSource: toPriceSource(l.price, l.priceSource),
            contractPrice: l.contractPrice,
          })),
        );
        setCrew(
          res.crew.map((c) => ({
            userId: c.userId,
            name: c.name,
            percent: c.percent,
            override: priceToInput(c.override),
          })),
        );
      })
      .catch(() => {
        if (id === reqId.current) setLoadError('Не удалось загрузить цену наряда');
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }

  function close() {
    if (isPending) return;
    reqId.current++;
    setOpen(false);
  }

  function patchLine(id: string, patch: Partial<LineState>) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function patchCrew(userId: string, override: string) {
    setCrew((cs) => cs.map((c) => (c.userId === userId ? { ...c, override } : c)));
  }

  // Итог наряда в копейках: Σ цен; null — ни одной цены (как workOrderCost в lib/finance).
  const totals = useMemo(() => {
    let sum = 0;
    let priced = 0;
    let unpriced = 0;
    for (const l of lines) {
      const p = normalizePrice(l.price);
      if (p === null) {
        unpriced++;
        continue;
      }
      sum += toKop(p) ?? 0;
      priced++;
    }
    return { totalKop: priced > 0 ? sum : null, unpriced };
  }, [lines]);

  // Начисление мастеру — то же правило, что masterSharesForOrder: ручная сумма сильнее всего,
  // документальный → 0, нет ставки/цены → не считается, иначе итог × % (копейки округляем).
  function shareOf(c: CrewState): { kop: number | null; note: string } {
    const ov = normalizePrice(c.override);
    if (ov !== null) return { kop: toKop(ov), note: 'ручная сумма' };
    if (noMasterPay) return { kop: 0, note: 'документальный наряд' };
    if (c.percent === null) return { kop: null, note: 'ставка не задана' };
    if (totals.totalKop === null) return { kop: null, note: 'нет цены наряда' };
    return {
      kop: Math.round((totals.totalKop * c.percent) / 100),
      note: `${fmtPercent(c.percent)} от итога`,
    };
  }

  function save() {
    if (!info) return;
    if (lines.some((l) => isBadPrice(l.price))) {
      toast.error('Цена — неотрицательное число, например 1500 или 1500,50');
      return;
    }
    if (crew.some((c) => isBadPrice(c.override))) {
      toast.error('Ручная сумма мастеру — неотрицательное число или пусто');
      return;
    }
    const payload = {
      workLogId,
      noMasterPay,
      lines: lines.map((l) => {
        const price = normalizePrice(l.price);
        const priceSource: PriceSource =
          price === null ? null : l.priceSource === 'contract' ? 'contract' : 'manual';
        return { id: l.id, price, priceSource };
      }),
      overrides: crew.map((c) => ({ userId: c.userId, amount: normalizePrice(c.override) })),
    };
    startTransition(async () => {
      try {
        const res = await saveWorkOrderPricing(payload);
        if (res.ok) {
          toast.success('Цена наряда сохранена');
          setOpen(false);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error('Не удалось сохранить цену наряда');
      }
    });
  }

  const dayLabel = fmtDay(info?.day ?? null);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          label
            ? 'inline-flex items-center gap-1 px-2 py-1 text-[11px] text-content-secondary hover:text-neon-orange border border-gray-200 rounded'
            : 'p-1.5 text-content-muted hover:text-neon-orange hover:bg-neon-orange/10 rounded border border-gray-200'
        }
        title="Цена наряда и начисления мастерам (видят только менеджер и админ)"
        aria-label="Цена наряда"
      >
        <Banknote className={label ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label && 'Цена'}
      </button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Цена наряда</DialogTitle>
            </DialogHeader>

            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-content-muted" />
              </div>
            ) : loadError || !info ? (
              <p className="text-sm text-red-600 py-6 text-center">
                {loadError ?? 'Не удалось загрузить цену наряда'}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-content-secondary break-words">
                    {info.clientName}
                    {info.contractNumber ? ` · договор ${info.contractNumber}` : ''}
                    {dayLabel ? ` · ${dayLabel}` : ' · без даты'}
                    {` · ${STATUS_LABEL[info.status] ?? info.status}`}
                  </p>
                  <p className="text-xs text-content-muted">
                    Цену видят только менеджер и админ. Мастер цен не видит.
                  </p>
                </div>

                {/* Строки услуг */}
                <div>
                  <Label>Услуги наряда</Label>
                  {lines.length === 0 ? (
                    <p className="text-xs text-content-muted mt-1">
                      В наряде нет строк услуг — цену указать не к чему.
                    </p>
                  ) : (
                    <div className="mt-1 rounded-md border border-gray-200 divide-y divide-gray-100">
                      {lines.map((l) => {
                        const bad = isBadPrice(l.price);
                        const cur = normalizePrice(l.price);
                        const showContract = l.contractPrice !== null && cur !== l.contractPrice;
                        const qty = l.quantity ? `${formatQuantity(l.quantity)} ${unitLabel(l.unit)}` : '';
                        return (
                          <div
                            key={l.id}
                            className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-content-primary break-words">{l.name}</div>
                              {(l.objectName || qty) && (
                                <div className="text-xs text-content-muted break-words">
                                  {[l.objectName, qty].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:justify-end">
                              <input
                                className={priceInputClass(bad)}
                                inputMode="decimal"
                                placeholder="не указана"
                                aria-label={`Цена, ₽: ${l.name}`}
                                value={l.price}
                                onChange={(e) =>
                                  patchLine(l.id, { price: e.target.value, priceSource: 'manual' })
                                }
                                disabled={isPending}
                              />
                              <span className="text-xs text-content-muted">₽</span>
                              <PriceSourceTag price={l.price} source={l.priceSource} />
                              {showContract && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchLine(l.id, {
                                      price: priceToInput(l.contractPrice),
                                      priceSource: 'contract',
                                    })
                                  }
                                  disabled={isPending}
                                  className="text-[11px] px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                                  title="Подставить цену из прайса договора"
                                >
                                  из договора: {formatRub(toKop(l.contractPrice))}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {lines.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm text-content-primary">
                        Итого по наряду:{' '}
                        <b className="tabular-nums">
                          {totals.totalKop === null ? 'цена не указана' : formatRub(totals.totalKop)}
                        </b>
                      </span>
                      {totals.unpriced > 0 && totals.totalKop !== null && (
                        <span className="text-xs text-amber-700">
                          без цены: {totals.unpriced} стр.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2 text-sm text-content-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-neon-orange mt-1 flex-shrink-0"
                    checked={noMasterPay}
                    onChange={(e) => setNoMasterPay(e.target.checked)}
                    disabled={isPending}
                  />
                  <span>{NO_MASTER_PAY_LABEL}</span>
                </label>

                {/* Начисления бригаде */}
                <div>
                  <Label>Мастерам</Label>
                  {crew.length === 0 ? (
                    <p className="text-xs text-content-muted mt-1">Мастер в наряде не назначен.</p>
                  ) : (
                    <div className="mt-1 space-y-2">
                      {crew.map((c) => {
                        const share = shareOf(c);
                        const bad = isBadPrice(c.override);
                        return (
                          <div key={c.userId} className="rounded-md border border-gray-200 p-2.5 space-y-1.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                              <span className="text-sm font-medium text-content-primary break-words min-w-0">
                                {c.name}
                              </span>
                              {c.percent !== null ? (
                                <span className="text-xs text-content-muted">
                                  ставка {fmtPercent(c.percent)}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-700">
                                  {info.day ? 'ставка не задана' : 'у наряда нет даты — ставка не определена'}
                                  {' · '}
                                  <Link
                                    href="/manager/masters"
                                    className="underline hover:text-neon-orange"
                                  >
                                    ставки мастеров
                                  </Link>
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-xs text-content-secondary">Ручная сумма</span>
                              <input
                                className={priceInputClass(bad)}
                                inputMode="decimal"
                                placeholder="по ставке"
                                aria-label={`Ручная сумма, ₽: ${c.name}`}
                                value={c.override}
                                onChange={(e) => patchCrew(c.userId, e.target.value)}
                                disabled={isPending}
                              />
                              <span className="text-xs text-content-muted">₽</span>
                            </div>
                            <div className="text-xs text-content-secondary">
                              Начислится:{' '}
                              <b className="tabular-nums text-content-primary">
                                {share.kop === null ? '—' : formatRub(share.kop)}
                              </b>{' '}
                              <span className="text-content-muted">({share.note})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {noMasterPay && crew.length > 0 && (
                    <p className="text-[11px] text-content-muted mt-1">
                      Документальный наряд: мастерам 0 ₽, если не указана ручная сумма.
                    </p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <CyberpunkButton variant="outline" onClick={close} disabled={isPending}>
                Отмена
              </CyberpunkButton>
              {info && !loading && (
                <CyberpunkButton onClick={save} disabled={isPending}>
                  {isPending ? 'Сохраняю…' : 'Сохранить'}
                </CyberpunkButton>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
