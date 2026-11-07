/**
 * «Сводка месяца» — форматирование, светофор и вердикт (11.2026, запрос Сани).
 *
 * Чистые функции без БД: импортируются и серверной страницей, и клиентскими компонентами,
 * и компактным блоком на дашборде — чтобы оценки «хорошо/плохо» везде были одинаковые.
 *
 * Принципы:
 *  - неизвестное — «н/д», а не 0: если наряды выполнены, но ни у одного нет цены, выручка/маржа
 *    неизвестны (а не нулевые); если цена есть не у всех — значение показываем, но с пометкой
 *    «неполные»;
 *  - Δ для денег и штук — в % к прошлому месяцу (deltaPct), для метрик-процентов — в п.п.
 *    (маржа 58% → 61% — это +3 п.п., а не +5,2%);
 *  - пока месяц не закончился, накопительные суммы (выручка, наряды…) сравнивать с ПОЛНЫМ
 *    прошлым месяцем нечестно — светофор по ним выключен (серый), Δ показываем справочно.
 */

import { deltaPct, formatRub, type Kopecks } from '@/lib/finance/compute';
import type { MonthKpis } from '@/lib/finance/monthly';

// ─── Месяцы ───────────────────────────────────────────────────────

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
/** «в октябре» */
const MONTHS_LOC = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
];
/** «к сентябрю» */
const MONTHS_DAT = [
  'январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню',
  'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю',
];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/** «6 окт» */
const MONTHS_GEN_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function monthIdx(m: string): number {
  return Number(m.split('-')[1]) - 1;
}

/** '2026-10' → 'Октябрь 2026' */
export function monthTitle(m: string): string {
  return `${MONTHS_NOM[monthIdx(m)] ?? m} ${m.slice(0, 4)}`;
}
/** '2026-10' → 'окт 26' */
export function monthShort(m: string): string {
  return `${MONTHS_SHORT[monthIdx(m)] ?? m} ${m.slice(2, 4)}`;
}
/** '2026-10' → 'октябре' */
export function monthLoc(m: string): string {
  return MONTHS_LOC[monthIdx(m)] ?? m;
}
/** '2026-09' → 'сентябрю' */
export function monthDat(m: string): string {
  return MONTHS_DAT[monthIdx(m)] ?? m;
}

/** День недели 0=Пн…6=Вс для 'YYYY-MM-DD' (календарная дата, без часовых поясов). */
export function weekdayMon0(day: string): number {
  const [y, mo, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
}

/** '2026-10-06' → '6 окт, пн' */
export function dayTitle(day: string): string {
  const [, mo, d] = day.split('-').map(Number);
  return `${d} ${MONTHS_GEN_SHORT[mo - 1] ?? ''}, ${WEEKDAYS_SHORT[weekdayMon0(day)].toLowerCase()}`;
}

/** ISO → '06.10 14:30' по МСК. */
export function fmtMskDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** ISO → '06.10.2026' по МСК. */
export function fmtMskDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** 1 наряд / 2 наряда / 5 нарядов */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export const ORDER_FORMS: [string, string, string] = ['наряд', 'наряда', 'нарядов'];
export const CLIENT_FORMS: [string, string, string] = ['клиент', 'клиента', 'клиентов'];

const MINUS = '−';

/** 61.5 → '61,5%'; null → 'н/д' */
export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'н/д';
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function signed(n: number, suffix: string): string {
  const abs = Math.abs(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  if (n > 0) return `+${abs}${suffix}`;
  if (n < 0) return `${MINUS}${abs}${suffix}`;
  return `0${suffix}`;
}

// ─── Полнота данных ───────────────────────────────────────────────

/** Выручка известна: либо нарядов не было (честный 0), либо хотя бы у одного есть цена. */
export function revenueKnown(k: MonthKpis): boolean {
  return !(k.ordersCompleted > 0 && k.ordersPriced === 0);
}
/** Денежная метрика месяца или null («н/д»), если цен нет совсем. */
export function moneyOrNull(k: MonthKpis, v: Kopecks | null): Kopecks | null {
  return revenueKnown(k) ? v : null;
}
/** Есть наряды без цены — денежные итоги неполные. */
export function isIncomplete(k: MonthKpis): boolean {
  return k.ordersUnpriced > 0;
}

// ─── Светофор ─────────────────────────────────────────────────────

export type Tone = 'good' | 'warn' | 'bad' | 'na' | 'neutral';

export const TONE_LABEL: Record<Tone, string> = {
  good: 'хорошо',
  warn: 'внимание',
  bad: 'плохо',
  na: 'нет данных',
  neutral: 'справочно',
};

/** Классы светофора: полоска слева, точка, текст значения. Цвета — как в остальной CRM. */
export const TONE_CLASSES: Record<Tone, { bar: string; dot: string; text: string; soft: string }> = {
  good: { bar: 'border-l-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50 border-emerald-200' },
  warn: { bar: 'border-l-amber-400', dot: 'bg-amber-400', text: 'text-amber-700', soft: 'bg-amber-50 border-amber-200' },
  bad: { bar: 'border-l-red-500', dot: 'bg-red-500', text: 'text-red-600', soft: 'bg-red-50 border-red-200' },
  na: { bar: 'border-l-gray-300', dot: 'bg-gray-300', text: 'text-content-muted', soft: 'bg-gray-50 border-gray-200' },
  neutral: { bar: 'border-l-gray-300', dot: 'bg-gray-400', text: 'text-content-primary', soft: 'bg-gray-50 border-gray-200' },
};

/**
 * Пороги оценки динамики (для метрик «чем больше, тем лучше»; для «меньше — лучше» зеркально):
 * рост от +3% (или +1 п.п.) — зелёный; падение на 10% (или 3 п.п.) и сильнее — красный;
 * между ними — жёлтый «стоим на месте».
 */
const TH = { pctGood: 3, pctBad: -10, ppGood: 1, ppBad: -3 };

function judgeTrend(cur: number | null, prev: number | null, dir: 'up' | 'down', pp: boolean): Tone {
  if (cur === null) return 'na';
  if (prev === null) return 'neutral';
  let d: number | null = pp ? round1(cur - prev) : deltaPct(cur, prev);
  if (d === null) {
    // Прошлый месяц = 0: рост с нуля — хорошо (или плохо для «меньше — лучше»).
    if (cur === 0) return 'neutral';
    return (dir === 'up') === cur > 0 ? 'good' : 'bad';
  }
  if (dir === 'down') d = -d;
  if (d >= (pp ? TH.ppGood : TH.pctGood)) return 'good';
  if (d <= (pp ? TH.ppBad : TH.pctBad)) return 'bad';
  return 'warn';
}

// ─── Метрики ──────────────────────────────────────────────────────

export type Metric = {
  key: string;
  label: string;
  value: string;
  prevValue: string;
  /** Подпись к прошлому значению: «было» или «весь прошлый месяц» (идущий месяц, накопительная сумма). */
  prevLabel?: string;
  /** '+12%' / '−3 п.п.' / null (нечего сравнивать). */
  delta: string | null;
  /** Δ — улучшение (true), ухудшение (false), справочно (null). */
  deltaGood: boolean | null;
  tone: Tone;
  sub?: string;
  /** Пометка о неполноте («неполные: 8 без цены»). */
  incomplete?: string;
  hint?: string;
};

type Kind = 'money' | 'count' | 'pct';

function makeDelta(
  cur: number | null,
  prev: number | null,
  kind: Kind,
  dir: 'up' | 'down' | 'none',
): { delta: string | null; deltaGood: boolean | null } {
  if (cur === null || prev === null) return { delta: null, deltaGood: null };
  if (kind === 'pct') {
    const d = round1(cur - prev);
    return {
      delta: signed(d, ' п.п.'),
      deltaGood: dir === 'none' || d === 0 ? null : (dir === 'up') === d > 0,
    };
  }
  const d = deltaPct(cur, prev);
  if (d === null) return { delta: null, deltaGood: null };
  return {
    delta: signed(d, '%'),
    deltaGood: dir === 'none' || d === 0 ? null : (dir === 'up') === d > 0,
  };
}

export type MetricsContext = {
  /** Месяц ещё идёт — накопительные метрики без светофора. */
  inProgress: boolean;
};

/**
 * Все метрики месяца, ключ → Metric. Группы для сетки — METRIC_GROUPS.
 * Порядок свойств cur/prev: cur — выбранный месяц, prev — прошлый (якорь сравнения).
 */
export function buildMetrics(cur: MonthKpis, prev: MonthKpis, ctx: MetricsContext): Record<string, Metric> {
  const out: Record<string, Metric> = {};
  const incompleteNote = isIncomplete(cur)
    ? `неполные: ${cur.ordersUnpriced} ${plural(cur.ordersUnpriced, ORDER_FORMS)} без цены`
    : undefined;

  /** Накопительная метрика (сумма за месяц): в незаконченном месяце — без светофора. */
  const cumulative = (tone: Tone): Tone => (ctx.inProgress && tone !== 'na' ? 'neutral' : tone);

  function add(
    key: string,
    m: Omit<Metric, 'key' | 'delta' | 'deltaGood'> & {
      cur: number | null;
      prev: number | null;
      kind: Kind;
      dir: 'up' | 'down' | 'none';
      isCumulative?: boolean;
    },
  ) {
    const { cur: c, prev: p, kind, dir, isCumulative, ...rest } = m;
    const d = makeDelta(c, p, kind, dir);
    const tone = isCumulative ? cumulative(rest.tone) : rest.tone;
    // Идущий месяц: накопительную сумму сравнивать с ПОЛНЫМ прошлым месяцем бессмысленно
    // (1-го числа было бы «−100%») — Δ не показываем, прошлое значение подписываем честно.
    const partial = isCumulative && ctx.inProgress;
    out[key] = {
      key,
      ...rest,
      tone,
      delta: partial ? null : d.delta,
      deltaGood: partial ? null : d.deltaGood,
      ...(partial ? { prevLabel: 'весь прошлый месяц' } : {}),
    };
  }

  // ── Деньги ──
  const rev = moneyOrNull(cur, cur.revenueKop);
  const revPrev = moneyOrNull(prev, prev.revenueKop);
  add('revenue', {
    label: 'Выручка',
    value: formatRub(rev),
    prevValue: formatRub(revPrev),
    sub:
      rev === null
        ? `цены не указаны ни у одного из ${cur.ordersCompleted} ${plural(cur.ordersCompleted, ORDER_FORMS)}`
        : `регулярная ${formatRub(cur.recurringRevenueKop)} · разовая ${formatRub(cur.oneTimeRevenueKop)}`,
    incomplete: rev === null ? undefined : incompleteNote,
    hint: 'Сумма цен услуг выполненных нарядов (по дате выполнения, МСК)',
    cur: rev,
    prev: revPrev,
    kind: 'money',
    dir: 'up',
    isCumulative: true,
    tone: judgeTrend(rev, revPrev, 'up', false),
  });

  add('avgTicket', {
    label: 'Средний чек',
    value: formatRub(cur.avgTicketKop),
    prevValue: formatRub(prev.avgTicketKop),
    sub: cur.ordersPriced > 0 ? `по ${cur.ordersPriced} ${plural(cur.ordersPriced, ORDER_FORMS)} с ценой` : undefined,
    hint: 'Выручка / число выполненных нарядов с ценой',
    cur: cur.avgTicketKop,
    prev: prev.avgTicketKop,
    kind: 'money',
    dir: 'up',
    tone: judgeTrend(cur.avgTicketKop, prev.avgTicketKop, 'up', false),
  });

  add('masterPay', {
    label: 'Выплаты мастерам',
    value: formatRub(cur.masterPayKop),
    prevValue: formatRub(prev.masterPayKop),
    sub: ctx.inProgress
      ? `за наряды ${formatRub(cur.masterEarnedKop)} · доплата до минималки (прогноз, не входит) ${formatRub(cur.projectedTopUpKop)}`
      : `за наряды ${formatRub(cur.masterEarnedKop)} · доплата до минималки ${formatRub(cur.masterTopUpKop)}`,
    incomplete: incompleteNote,
    hint: ctx.inProgress
      ? 'Месяц идёт: в выплатах только начисленное по ставкам. Доплата до минималки — в конце месяца; прогноз показан справочно и уменьшится по мере работы'
      : 'Начислено по ставкам + доплата организации до минимальной выплаты',
    cur: cur.masterPayKop,
    prev: prev.masterPayKop,
    kind: 'money',
    dir: 'none',
    isCumulative: true,
    // Расход сам по себе не хорош и не плох; жёлтый — если организация доплачивает до минималки
    // (в незаконченном месяце доплата ещё не окончательная — справочно).
    tone: cur.masterTopUpKop > 0 && !ctx.inProgress ? 'warn' : 'neutral',
  });

  const gm = moneyOrNull(cur, cur.grossMarginKop);
  const gmPrev = moneyOrNull(prev, prev.grossMarginKop);
  add('grossMargin', {
    label: 'Валовая маржа',
    value: formatRub(gm),
    prevValue: formatRub(gmPrev),
    sub: 'выручка − выплаты мастерам',
    incomplete: gm === null ? undefined : incompleteNote,
    cur: gm,
    prev: gmPrev,
    kind: 'money',
    dir: 'up',
    isCumulative: true,
    tone: gm !== null && gm < 0 ? 'bad' : judgeTrend(gm, gmPrev, 'up', false),
  });
  // В незаконченном месяце доплата до минималки уже учтена целиком (как будто месяц кончился),
  // поэтому минус там — не провал, а «ещё не наработали». Красная — только в закрытом месяце.
  if (gm !== null && gm < 0 && !ctx.inProgress) out.grossMargin.tone = 'bad';

  add('marginPct', {
    label: 'Маржа, %',
    value: fmtPct(cur.marginPct),
    prevValue: fmtPct(prev.marginPct),
    sub: 'доля выручки, остающаяся после выплат мастерам',
    incomplete: cur.marginPct === null ? undefined : incompleteNote,
    cur: cur.marginPct,
    prev: prev.marginPct,
    kind: 'pct',
    dir: 'up',
    // Маржа зависит от доплаты до минималки, а она в незаконченном месяце не окончательная.
    isCumulative: true,
    tone:
      cur.marginPct !== null && cur.marginPct < 0 ? 'bad' : judgeTrend(cur.marginPct, prev.marginPct, 'up', true),
  });

  add('marginExDoc', {
    label: 'Маржа без документальных',
    value: fmtPct(cur.marginExDocPct),
    prevValue: fmtPct(prev.marginExDocPct),
    sub: 'без нарядов «документальный» (мастеру не платится)',
    incomplete: cur.marginExDocPct === null ? undefined : incompleteNote,
    cur: cur.marginExDocPct,
    prev: prev.marginExDocPct,
    kind: 'pct',
    dir: 'up',
    isCumulative: true,
    tone:
      cur.marginExDocPct !== null && cur.marginExDocPct < 0
        ? 'bad'
        : judgeTrend(cur.marginExDocPct, prev.marginExDocPct, 'up', true),
  });

  add('documentary', {
    label: 'Документальные',
    value: `${cur.documentaryCount} шт`,
    prevValue: `${prev.documentaryCount} шт`,
    sub: `на сумму ${formatRub(moneyOrNull(cur, cur.documentaryRevenueKop))}`,
    hint: 'Наряды с пометкой «мастеру не платится»',
    cur: cur.documentaryCount,
    prev: prev.documentaryCount,
    kind: 'count',
    dir: 'none',
    isCumulative: true,
    tone: 'neutral',
  });

  const rpm = moneyOrNull(cur, cur.revenuePerMasterKop);
  const rpmPrev = moneyOrNull(prev, prev.revenuePerMasterKop);
  add('revenuePerMaster', {
    label: 'Выручка на мастера',
    value: formatRub(rpm),
    prevValue: formatRub(rpmPrev),
    sub: `мастеров с нарядами: ${cur.activeMasters}`,
    incomplete: rpm === null ? undefined : incompleteNote,
    cur: rpm,
    prev: rpmPrev,
    kind: 'money',
    dir: 'up',
    isCumulative: true,
    tone: judgeTrend(rpm, rpmPrev, 'up', false),
  });

  // ── Работа ──
  add('orders', {
    label: 'Нарядов выполнено',
    value: String(cur.ordersCompleted),
    prevValue: String(prev.ordersCompleted),
    sub: `без цены ${cur.ordersUnpriced} · не выполнено (план/в работе) ${cur.ordersOpen}`,
    cur: cur.ordersCompleted,
    prev: prev.ordersCompleted,
    kind: 'count',
    dir: 'up',
    isCumulative: true,
    tone: judgeTrend(cur.ordersCompleted, prev.ordersCompleted, 'up', false),
  });

  // Δ — по ДОЛЕ нарядов без цены (п.п.), а не по штукам: меньше нарядов без цены только потому,
  // что нарядов вообще меньше, — не улучшение.
  const unpricedShare = (k: MonthKpis) => (k.ordersCompleted > 0 ? round1((k.ordersUnpriced / k.ordersCompleted) * 100) : null);
  add('unpriced', {
    label: 'Без цены',
    value: `${cur.ordersUnpriced} из ${cur.ordersCompleted}`,
    prevValue: `${prev.ordersUnpriced} из ${prev.ordersCompleted}`,
    sub:
      cur.ordersUnpriced > 0
        ? `${fmtPct(unpricedShare(cur))} выполненных — укажите цену кнопкой «Цена» у наряда`
        : cur.ordersCompleted > 0
          ? 'у всех выполненных нарядов есть цена'
          : undefined,
    hint: 'Выполненные наряды, где ни у одной услуги нет цены — их сумма не входит в выручку. Δ — по доле, в п.п.',
    cur: unpricedShare(cur),
    prev: unpricedShare(prev),
    kind: 'pct',
    dir: 'down',
    // Абсолютное правило: любой наряд без цены — дыра в отчёте.
    tone: cur.ordersUnpriced === 0 ? (cur.ordersCompleted > 0 ? 'good' : 'neutral') : 'bad',
  });

  add('reschedule', {
    label: 'Доля переносов',
    value: fmtPct(cur.rescheduleRatePct),
    prevValue: fmtPct(prev.rescheduleRatePct),
    sub: `запросов ${cur.rescheduleRequests} · одобрено ${cur.rescheduleApproved}`,
    hint: 'Запросы мастеров на перенос / все наряды месяца',
    cur: cur.rescheduleRatePct,
    prev: prev.rescheduleRatePct,
    kind: 'pct',
    dir: 'down',
    tone: cur.rescheduleRatePct === 0 ? 'good' : judgeTrend(cur.rescheduleRatePct, prev.rescheduleRatePct, 'down', true),
  });

  // Для дашборда: число запросов (не доля).
  add('rescheduleCount', {
    label: 'Запросы на перенос',
    value: String(cur.rescheduleRequests),
    prevValue: String(prev.rescheduleRequests),
    sub: `одобрено ${cur.rescheduleApproved}`,
    cur: cur.rescheduleRequests,
    prev: prev.rescheduleRequests,
    kind: 'count',
    dir: 'down',
    isCumulative: true,
    tone:
      cur.rescheduleRequests === 0
        ? 'good'
        : judgeTrend(cur.rescheduleRequests, prev.rescheduleRequests, 'down', false),
  });

  add('onTime', {
    label: 'В назначенный день',
    value: fmtPct(cur.onTimePct),
    prevValue: fmtPct(prev.onTimePct),
    sub: cur.onTimeBase > 0 ? `${cur.onTimeCount} из ${cur.onTimeBase} начаты в день плана` : 'нет нарядов с планом и стартом',
    hint: 'Наряд начат в тот же день (МСК), на который был запланирован',
    cur: cur.onTimePct,
    prev: prev.onTimePct,
    kind: 'pct',
    dir: 'up',
    // Абсолютные пороги: ≥80% — норма, 60–80% — внимание, ниже — плохо.
    tone: cur.onTimePct === null ? 'na' : cur.onTimePct >= 80 ? 'good' : cur.onTimePct >= 60 ? 'warn' : 'bad',
  });

  // ── Клиенты ──
  add('clientsServed', {
    label: 'Клиентов обслужено',
    value: String(cur.clientsServed),
    prevValue: String(prev.clientsServed),
    sub: `новых ${cur.newClients} · отказались ${cur.refusedInMonth}`,
    cur: cur.clientsServed,
    prev: prev.clientsServed,
    kind: 'count',
    dir: 'up',
    isCumulative: true,
    tone: judgeTrend(cur.clientsServed, prev.clientsServed, 'up', false),
  });

  add('churn', {
    label: 'Отток',
    value: fmtPct(cur.churnPct),
    prevValue: fmtPct(prev.churnPct),
    sub: `отказались в месяце: ${cur.refusedInMonth}`,
    hint: 'Отказались в месяце / (активные + отказались в месяце)',
    cur: cur.churnPct,
    prev: prev.churnPct,
    kind: 'pct',
    dir: 'down',
    tone: cur.churnPct === 0 ? 'good' : judgeTrend(cur.churnPct, prev.churnPct, 'down', true),
  });

  add('top5', {
    label: 'Концентрация топ-5',
    value: fmtPct(cur.top5SharePct),
    prevValue: fmtPct(prev.top5SharePct),
    sub: 'доля выручки пяти крупнейших клиентов',
    incomplete: cur.top5SharePct === null ? undefined : incompleteNote,
    hint: 'Чем выше, тем сильнее зависимость от нескольких клиентов',
    cur: cur.top5SharePct,
    prev: prev.top5SharePct,
    kind: 'pct',
    dir: 'down',
    // Абсолютные пороги риска зависимости: ≤50% — ок, 50–70% — внимание, выше — риск.
    tone:
      cur.top5SharePct === null ? 'na' : cur.top5SharePct <= 50 ? 'good' : cur.top5SharePct <= 70 ? 'warn' : 'bad',
  });

  add('leads', {
    label: 'Заявки → клиенты',
    value: fmtPct(cur.leadConversionPct),
    prevValue: fmtPct(prev.leadConversionPct),
    sub: `${cur.leadsConverted} из ${cur.leads} ${plural(cur.leads, ['заявки', 'заявок', 'заявок'])} стали клиентами`,
    hint: 'Заявки месяца, по которым уже создан клиент',
    cur: cur.leadConversionPct,
    prev: prev.leadConversionPct,
    kind: 'pct',
    dir: 'up',
    isCumulative: true,
    tone: judgeTrend(cur.leadConversionPct, prev.leadConversionPct, 'up', true),
  });

  return out;
}

export const METRIC_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Деньги',
    keys: ['revenue', 'avgTicket', 'masterPay', 'grossMargin', 'marginPct', 'marginExDoc', 'documentary', 'revenuePerMaster'],
  },
  { title: 'Работа', keys: ['orders', 'unpriced', 'reschedule', 'onTime'] },
  { title: 'Клиенты', keys: ['clientsServed', 'churn', 'top5', 'leads'] },
];

/** Компактная сводка на дашборде. */
export const PULSE_KEYS = ['revenue', 'masterPay', 'grossMargin', 'orders', 'rescheduleCount'];

// ─── Вердикт ──────────────────────────────────────────────────────

export type Verdict = { badge: string; tone: Tone; text: string };

/**
 * Вердикт месяца одной-двумя фразами из цифр. Пример:
 * «Выручка 245 000 ₽ (+12% к сентябрю), маржа 61%. Выполнено 50 нарядов (+8%).
 *  8 нарядов без цены — итог неполный.»
 */
export function buildVerdict(
  cur: MonthKpis,
  prev: MonthKpis,
  ctx: MetricsContext & { todayLabel?: string },
): Verdict {
  const parts: string[] = [];
  const toPrev = `к ${monthDat(prev.month)}`;
  const n = cur.ordersCompleted;

  if (ctx.inProgress) parts.push(`Месяц ещё идёт${ctx.todayLabel ? ` (данные на ${ctx.todayLabel})` : ''}.`);

  if (n === 0) {
    parts.push(
      `В ${monthLoc(cur.month)} выполненных нарядов нет` +
        (cur.ordersOpen > 0 ? `, запланировано ${cur.ordersOpen} ${plural(cur.ordersOpen, ORDER_FORMS)}.` : '.'),
    );
  } else if (!revenueKnown(cur)) {
    parts.push(
      `Выполнено ${n} ${plural(n, ORDER_FORMS)}, но ни у одного не указана цена — выручка и маржа н/д.`,
    );
  } else {
    const revPrev = moneyOrNull(prev, prev.revenueKop);
    const dRev = revPrev !== null ? deltaPct(cur.revenueKop, revPrev) : null;
    const dOrders = deltaPct(n, prev.ordersCompleted);
    parts.push(
      `Выручка ${formatRub(cur.revenueKop)}${dRev !== null ? ` (${signed(dRev, '%')} ${toPrev})` : ''}, ` +
        `маржа ${fmtPct(cur.marginPct)}. ` +
        `Выполнено ${n} ${plural(n, ORDER_FORMS)}${dOrders !== null ? ` (${signed(dOrders, '%')})` : ''}.`,
    );
    if (cur.ordersUnpriced > 0) {
      parts.push(`${cur.ordersUnpriced} ${plural(cur.ordersUnpriced, ORDER_FORMS)} без цены — итог неполный.`);
    }
  }

  const clientBits: string[] = [];
  if (cur.newClients > 0) clientBits.push(`новых ${cur.newClients}`);
  if (cur.refusedInMonth > 0) clientBits.push(`отказались ${cur.refusedInMonth}`);
  if (clientBits.length) parts.push(`Клиенты: ${clientBits.join(', ')}.`);

  // Бейдж: неполнота данных важнее динамики — на неполных цифрах «рост/спад» не утверждаем.
  let badge: string;
  let tone: Tone;
  if (n === 0) {
    badge = 'Нет выполненных работ';
    tone = 'neutral';
  } else if (!revenueKnown(cur)) {
    badge = 'Нет цен — итог н/д';
    tone = 'bad';
  } else if (cur.ordersUnpriced > 0) {
    badge = 'Данные неполные';
    tone = 'warn';
  } else if (cur.grossMarginKop < 0 && !ctx.inProgress) {
    badge = 'Маржа отрицательная';
    tone = 'bad';
  } else if (ctx.inProgress) {
    badge = 'Месяц идёт';
    tone = 'neutral';
  } else {
    const t = judgeTrend(cur.revenueKop, moneyOrNull(prev, prev.revenueKop), 'up', false);
    tone = t === 'na' ? 'neutral' : t;
    badge = t === 'good' ? 'Рост' : t === 'bad' ? 'Спад' : 'Стабильно';
    if (t === 'warn') tone = 'neutral';
  }

  return { badge, tone, text: parts.join(' ') };
}
