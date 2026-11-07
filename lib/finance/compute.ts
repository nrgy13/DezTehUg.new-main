/**
 * Деньги нарядов — чистые функции без БД (11.2026, запрос Сани).
 *
 * Правила (согласованы с Саней, msg 522–536):
 *  - стоимость наряда = сумма цен строк услуг; строки без цены не считаются; наряд, где нет НИ
 *    ОДНОЙ цены, — «без цены» (н/д), а не 0 ₽;
 *  - мастеру за наряд = его % от ПОЛНОЙ стоимости наряда (в бригаде — каждому от полной);
 *    «документальный» наряд (noMasterPay) — 0; ручная сумма (override) перекрывает расчёт;
 *  - ставка берётся на дату наряда (история ставок: последняя effective_from <= даты);
 *  - за месяц мастеру = max(Σ за наряды, минималка), минималка — по ставке на последний день месяца.
 *
 * Все суммы внутри — в КОПЕЙКАХ (целые), чтобы 0.1 + 0.2 не превращалось в 0.30000000000000004.
 */

export type Kopecks = number;

/** '1234.50' | 1234.5 | null → копейки (null, если пусто/мусор). */
export function toKop(v: string | number | null | undefined): Kopecks | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Копейки → рубли числом (для Excel/графиков). */
export function kopToRub(k: Kopecks): number {
  return Math.round(k) / 100;
}

/** Копейки → '12 345 ₽' / '12 345,50 ₽' (копейки только если есть). */
export function formatRub(k: Kopecks | null | undefined): string {
  if (k === null || k === undefined) return 'н/д';
  const rub = k / 100;
  const hasKop = Math.round(k) % 100 !== 0;
  return `${rub.toLocaleString('ru-RU', {
    minimumFractionDigits: hasKop ? 2 : 0,
    maximumFractionDigits: 2,
  })} ₽`;
}

export type PayRate = {
  userId: string;
  /** Процент от стоимости наряда, 0..100. */
  percent: number;
  minMonthlyKop: Kopecks;
  /** 'YYYY-MM-DD' (дата по МСК, с которой действует). */
  effectiveFrom: string;
};

/**
 * Ставка мастера на дату (YYYY-MM-DD): последняя запись с effectiveFrom <= day.
 * Строковое сравнение ISO-дат корректно. null — ставка ещё не задана.
 */
export function rateAt(rates: PayRate[], userId: string, day: string): PayRate | null {
  let best: PayRate | null = null;
  for (const r of rates) {
    if (r.userId !== userId || r.effectiveFrom > day) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best;
}

export type PricedLine = { priceKop: Kopecks | null };

/** Стоимость наряда: Σ цен; null — ни одной цены (наряд «без цены»). */
export function workOrderCost(lines: PricedLine[]): Kopecks | null {
  let sum = 0;
  let any = false;
  for (const l of lines) {
    if (l.priceKop === null) continue;
    sum += l.priceKop;
    any = true;
  }
  return any ? sum : null;
}

export type MasterShare = {
  userId: string;
  /** Сколько начислено мастеру за наряд, коп. */
  amountKop: Kopecks;
  /** Откуда сумма — для подсказок и Excel. */
  basis: 'percent' | 'override' | 'no_master_pay' | 'no_price' | 'no_rate';
  percent: number | null;
};

/**
 * Начисление каждому члену бригады за ОДИН наряд.
 *  crew — основной мастер + напарники (порядок сохраняется).
 *  day — дата наряда (МСК, YYYY-MM-DD) для выбора ставки.
 */
export function masterSharesForOrder(params: {
  crew: string[];
  costKop: Kopecks | null;
  noMasterPay: boolean;
  overrides: Map<string, Kopecks>;
  rates: PayRate[];
  day: string;
}): MasterShare[] {
  const { crew, costKop, noMasterPay, overrides, rates, day } = params;
  return crew.map((userId) => {
    // Ручная сумма — сильнее всего (Регина договорилась иначе), даже для документального.
    const ov = overrides.get(userId);
    if (ov !== undefined) return { userId, amountKop: ov, basis: 'override', percent: null };
    if (noMasterPay) return { userId, amountKop: 0, basis: 'no_master_pay', percent: null };
    const rate = rateAt(rates, userId, day);
    if (!rate) return { userId, amountKop: 0, basis: 'no_rate', percent: null };
    if (costKop === null) return { userId, amountKop: 0, basis: 'no_price', percent: rate.percent };
    return {
      userId,
      amountKop: Math.round((costKop * rate.percent) / 100),
      basis: 'percent',
      percent: rate.percent,
    };
  });
}

export type MonthPay = {
  userId: string;
  /** Набрано за наряды месяца. */
  earnedKop: Kopecks;
  /** Минималка по ставке на конец месяца (0 — не задана). */
  minKop: Kopecks;
  /** К выплате = max(earned, min). */
  payKop: Kopecks;
  /** Доплата организации до минималки = max(0, min − earned). */
  topUpKop: Kopecks;
  percent: number | null;
};

/** Итог мастера за месяц: max(набрал, минималка). monthEnd — 'YYYY-MM-DD' последнего дня месяца. */
export function monthPay(
  userId: string,
  earnedKop: Kopecks,
  rates: PayRate[],
  monthEnd: string,
): MonthPay {
  const rate = rateAt(rates, userId, monthEnd);
  const minKop = rate?.minMonthlyKop ?? 0;
  const payKop = Math.max(earnedKop, minKop);
  return {
    userId,
    earnedKop,
    minKop,
    payKop,
    topUpKop: payKop - earnedKop,
    percent: rate?.percent ?? null,
  };
}

/**
 * Регулярный ли договор: есть позиция прайса с периодичностью («Ежемесячно», «2 раза в месяц»,
 * «Ежеквартально», «1 раз в 2 месяца», «Июнь-сентябрь» и т.п.). «По заявке» и пусто — разовые.
 * Нужен для разделения выручки на регулярную и разовую (аналог MRR в SaaS-отчётности).
 */
export function isRecurringFrequency(freq: string | null | undefined): boolean {
  if (!freq) return false;
  const f = freq.trim().toLowerCase();
  if (f === '' || f.startsWith('по заявке')) return false;
  return /(раз|ежемес|ежекварт|ежегод|ежеднев|еженед|месяц|квартал|недел|январ|феврал|март|апрел|май|мая|июн|июл|август|сентябр|октябр|ноябр|декабр)/.test(
    f,
  );
}

/** Δ в процентах (null, если базы нет). */
export function deltaPct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}
