import 'server-only';

/**
 * Excel-выгрузка ежемесячной управленческой сводки (11.2026, запрос Сани).
 *
 * Формат «как board pack»: сначала одна страница-сводка (вердикт + KPI со светофором),
 * потом детали, в конце «Определения» — как считается каждая цифра и что в неё НЕ входит.
 *
 * Данные — ТОЛЬКО из getMonthlyReport (lib/finance/monthly.ts), здесь ничего не досчитывается
 * из БД: цифры в Excel обязаны совпадать со страницей «Сводка месяца» до копейки.
 *
 * Правила оформления:
 *  - деньги пишем РУБЛЯМИ ЧИСЛОМ (kopToRub) с денежным форматом — чтобы в Excel суммировалось;
 *  - доли — числом 0..1 с форматом 0.0%; Δ у долей — в процентных пунктах (п.п.);
 *  - неизвестное — текст «н/д» серым, НЕ ноль (наряд без цены ≠ бесплатный наряд);
 *  - даты — настоящие даты Excel (стена часов МСК), время суток — текстом HH:MM.
 */

import * as ExcelJS from 'exceljs';
import type {
  MonthlyReport,
  MonthData,
  MonthKpis,
  MonthMasterRow,
  MonthOrder,
  MonthOrderService,
  MonthReschedule,
} from './monthly';
import { kopToRub, deltaPct, formatRub, type Kopecks } from './compute';
import { unitLabel, formatQuantity } from '@/lib/constants/units';

// ─── Оформление ─────────────────────────────────────────────────────

const C = {
  navy: 'FF1F3864',
  navyLight: 'FF44546A',
  white: 'FFFFFFFF',
  section: 'FFD9E1F2',
  title: 'FF1F3864',
  gray: 'FF7F7F7F',
  grayFill: 'FFE7E6E6',
  goodFill: 'FFC6EFCE',
  goodFont: 'FF006100',
  flatFill: 'FFFFEB9C',
  flatFont: 'FF7F6000',
  badFill: 'FFFFC7CE',
  badFont: 'FF9C0006',
  weekend: 'FFF2F2F2',
  border: 'FFBFBFBF',
  // Тепловая карта графика: 1, 2, 3, 4+ нарядов в день.
  heat: ['FFE2EFDA', 'FFC6E0B4', 'FFA9D08E', 'FF70AD47'],
};

const FMT_RUB = '#,##0 "₽"';
const FMT_RUB2 = '#,##0.00 "₽"';
const FMT_INT = '#,##0';
const FMT_PCT = '0.0%';
const FMT_DELTA_PCT = '+0.0%;-0.0%;0.0%';
const FMT_DELTA_PP = '+0.0" п.п.";-0.0" п.п.";0.0" п.п."';
const FMT_DATE = 'dd.mm.yyyy';
const FMT_DATETIME = 'dd.mm.yyyy hh:mm';

const NA = 'н/д';

const THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: C.border } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
const MONTHS_DAT = [
  'январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню',
  'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю',
];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

type St = {
  numFmt?: string;
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  h?: 'left' | 'center' | 'right';
  v?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  border?: boolean;
};

function put(ws: ExcelJS.Worksheet, r: number, c: number, value: ExcelJS.CellValue, st: St = {}): ExcelJS.Cell {
  const cell = ws.getCell(r, c);
  cell.value = value;
  const font: Partial<ExcelJS.Font> = { name: 'Calibri', size: st.size ?? 10 };
  if (st.bold) font.bold = true;
  if (st.italic) font.italic = true;
  if (st.color) font.color = { argb: st.color };
  cell.font = font;
  if (st.numFmt) cell.numFmt = st.numFmt;
  if (st.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } };
  const al: Partial<ExcelJS.Alignment> = { vertical: st.v ?? 'top', wrapText: !!st.wrap };
  if (st.h) al.horizontal = st.h;
  cell.alignment = al;
  if (st.border) cell.border = BORDER;
  return cell;
}

/** «н/д» — серым курсивом, вправо (там, где обычно стоит число). */
function putNA(ws: ExcelJS.Worksheet, r: number, c: number, st: St = {}): ExcelJS.Cell {
  return put(ws, r, c, NA, { ...st, color: C.gray, italic: true, h: 'right' });
}

function putRub(ws: ExcelJS.Worksheet, r: number, c: number, kop: Kopecks | null, st: St = {}, fmt = FMT_RUB) {
  if (kop === null) return putNA(ws, r, c, st);
  return put(ws, r, c, kopToRub(kop), { ...st, numFmt: fmt, h: 'right' });
}

function headerRow(ws: ExcelJS.Worksheet, r: number, headers: string[], height = 32) {
  headers.forEach((h, i) =>
    put(ws, r, i + 1, h, { bold: true, color: C.white, fill: C.navy, h: 'center', v: 'middle', wrap: true, border: true }),
  );
  ws.getRow(r).height = height;
}

function setWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/** Заголовок листа: строка 1 — крупно, строка 2 — пояснение мелким курсивом (слиты до lastCol). */
function sheetTitle(ws: ExcelJS.Worksheet, title: string, note: string | null, lastCol: number) {
  put(ws, 1, 1, title, { bold: true, size: 14, color: C.title });
  ws.getRow(1).height = 22;
  if (note) {
    put(ws, 2, 1, note, { italic: true, size: 9, color: C.gray, wrap: true });
    ws.mergeCells(2, 1, 2, Math.max(1, lastCol));
    ws.getRow(2).height = Math.min(90, 13 * estLines(note, totalWidth(ws, lastCol)) + 4);
  }
}

function totalWidth(ws: ExcelJS.Worksheet, lastCol: number): number {
  let w = 0;
  for (let i = 1; i <= lastCol; i++) w += ws.getColumn(i).width ?? 9;
  return w;
}

/** Примерное число строк текста в ячейке шириной width (для высоты строки — Excel сам не подгоняет). */
function estLines(text: string, width: number, charsPerUnit = 1.05): number {
  const per = Math.max(4, Math.floor(width * charsPerUnit));
  return String(text)
    .split('\n')
    .reduce((s, line) => s + Math.max(1, Math.ceil(line.length / per)), 0);
}

function fitHeight(ws: ExcelJS.Worksheet, r: number, cells: { text: string; width: number }[], lineH = 13) {
  const lines = cells.reduce((m, c) => Math.max(m, estLines(c.text, c.width)), 1);
  ws.getRow(r).height = Math.min(409, Math.max(15, lines * lineH + 3));
}

function newSheet(
  wb: ExcelJS.Workbook,
  name: string,
  o: { tab: string; landscape?: boolean; freeze?: { x: number; y: number }; grid?: boolean },
): ExcelJS.Worksheet {
  const view: Partial<ExcelJS.WorksheetView> = o.freeze
    ? { state: 'frozen', xSplit: o.freeze.x, ySplit: o.freeze.y, showGridLines: o.grid ?? true }
    : { showGridLines: o.grid ?? true };
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: o.tab } },
    pageSetup: {
      paperSize: 9, // A4
      orientation: o.landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    views: [view],
  });
  ws.headerFooter.oddFooter = `&L&8ДезТехЮг · ${name}&R&8Стр. &P из &N`;
  return ws;
}

// ─── Текст / даты ───────────────────────────────────────────────────

function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function plural(n: number, one: string, few: string, many: string): string {
  const n10 = Math.abs(n) % 10;
  const n100 = Math.abs(n) % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

function fmtNum(n: number, digits = 1): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}
function fmtPctText(p: number | null): string {
  return p === null ? NA : `${fmtNum(p)}%`;
}
function fmtSigned(n: number, suffix: string): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n))}${suffix}`;
}

/** 'YYYY-MM-DD' → дата Excel (полночь UTC = ровно этот день, без сдвига на пояс). */
function dayDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const MSK_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO-момент → «стена часов» МСК как дата Excel (Excel не знает поясов). */
function mskWall(iso: string): Date {
  const parts = MSK_PARTS.formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute')));
}

function mskStamp(now: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
}

function putDateTime(ws: ExcelJS.Worksheet, r: number, c: number, iso: string | null, st: St = {}) {
  if (!iso) return put(ws, r, c, '—', { ...st, color: C.gray, h: 'center' });
  return put(ws, r, c, mskWall(iso), { ...st, numFmt: FMT_DATETIME, h: 'left' });
}

// ─── KPI: определения, «н/д», светофор ──────────────────────────────

type Kind = 'rub' | 'int' | 'pct';
type Dir = 'up' | 'down' | 'neutral';
type StatusKey = 'good' | 'flat' | 'bad' | 'na' | 'nobase' | 'info';

/** Контекст месяца для KPI. masters/activeClients есть только у отчётного месяца. */
type KCtx = { k: MonthKpis; masters?: MonthMasterRow[]; activeClients?: number };

/**
 * Деньги месяца известны, если есть хоть один наряд с ценой (или нарядов не было вовсе —
 * тогда 0 ₽ честный ноль). Все наряды без цены → выручка «н/д», а не 0.
 */
function revKnown(k: MonthKpis): boolean {
  return k.ordersCompleted === 0 || k.ordersPriced > 0;
}

/**
 * Выплаты мастерам известны, если задана хоть одна ставка. У отчётного месяца это видно по
 * мастерам (hasRate); у прошлых месяцев — флаг kpis.anyRate (ставка хоть у одного мастера на конец месяца).
 */
function payKnown(c: KCtx): boolean {
  if (c.masters) return c.masters.some((m) => m.hasRate);
  return c.k.anyRate;
}

function partialNote(k: MonthKpis): string | null {
  if (k.ordersCompleted === 0) return null;
  if (k.ordersPriced === 0) return `нет цены ни у одного из ${k.ordersCompleted} нарядов`;
  if (k.ordersUnpriced > 0) return `неполные: ${k.ordersUnpriced} из ${k.ordersCompleted} нарядов без цены`;
  return null;
}

type KpiDef = {
  group: string;
  label: string;
  kind: Kind;
  /** up — рост хорошо, down — рост плохо, neutral — справочно (без светофора). */
  dir: Dir;
  /** rub → копейки; pct → проценты (73.1); null → «н/д». */
  get: (c: KCtx) => number | null;
  note?: (c: KCtx) => string | null;
  /** Абсолютное правило, сильнее сравнения с прошлым месяцем (например, «без цены > 0 — всегда плохо»). */
  abs?: (v: number) => StatusKey | null;
};

const G_MONEY = 'Деньги (по выполненным нарядам)';
const G_WORK = 'Работы и мастера';
const G_PAY = 'Зарплата мастеров';
const G_CLIENTS = 'Клиенты и продажи';
const GROUPS = [G_MONEY, G_WORK, G_PAY, G_CLIENTS];

const KPIS: KpiDef[] = [
  {
    group: G_MONEY,
    label: 'Выручка',
    kind: 'rub',
    dir: 'up',
    get: ({ k }) => (revKnown(k) ? k.revenueKop : null),
    note: ({ k }) => partialNote(k),
  },
  {
    group: G_MONEY,
    label: '   в т.ч. регулярная (договоры с периодичностью)',
    kind: 'rub',
    dir: 'up',
    get: ({ k }) => (revKnown(k) ? k.recurringRevenueKop : null),
    note: ({ k }) =>
      revKnown(k) && k.revenueKop > 0
        ? `${fmtPctText(Math.round((k.recurringRevenueKop / k.revenueKop) * 1000) / 10)} выручки`
        : null,
  },
  {
    group: G_MONEY,
    label: '   в т.ч. разовая (по заявке)',
    kind: 'rub',
    dir: 'up',
    get: ({ k }) => (revKnown(k) ? k.oneTimeRevenueKop : null),
  },
  {
    group: G_MONEY,
    label: 'Средний чек',
    kind: 'rub',
    dir: 'up',
    get: ({ k }) => k.avgTicketKop,
    note: ({ k }) => (k.ordersPriced > 0 ? `по ${k.ordersPriced} ${plural(k.ordersPriced, 'наряду', 'нарядам', 'нарядам')} с ценой` : null),
  },
  {
    group: G_MONEY,
    label: 'Валовая маржа, ₽',
    kind: 'rub',
    dir: 'up',
    get: (c) => (revKnown(c.k) && payKnown(c) ? c.k.grossMarginKop : null),
    note: (c) => (!payKnown(c) ? 'ставки мастеров не заданы' : 'выручка − выплаты мастерам'),
  },
  {
    group: G_MONEY,
    label: 'Валовая маржа, %',
    kind: 'pct',
    dir: 'up',
    get: (c) => (revKnown(c.k) && payKnown(c) ? c.k.marginPct : null),
  },
  {
    group: G_MONEY,
    label: 'Маржа без документальных, %',
    kind: 'pct',
    dir: 'up',
    get: (c) => (revKnown(c.k) && payKnown(c) ? c.k.marginExDocPct : null),
    note: () => 'документальные (мастеру 0) завышают общую маржу',
  },
  {
    group: G_MONEY,
    label: 'Документальные наряды, шт',
    kind: 'int',
    dir: 'neutral',
    get: ({ k }) => k.documentaryCount,
    note: () => 'мастеру 0, вся сумма — организации',
  },
  {
    group: G_MONEY,
    label: 'Документальные наряды, ₽',
    kind: 'rub',
    dir: 'neutral',
    get: ({ k }) => (revKnown(k) ? k.documentaryRevenueKop : null),
  },
  {
    group: G_WORK,
    label: 'Нарядов выполнено',
    kind: 'int',
    dir: 'up',
    get: ({ k }) => k.ordersCompleted,
    note: ({ k }) => (k.ordersOpen > 0 ? `ещё ${k.ordersOpen} в плане / в работе` : null),
  },
  {
    group: G_WORK,
    label: 'Нарядов без цены (н/д)',
    kind: 'int',
    dir: 'down',
    get: ({ k }) => k.ordersUnpriced,
    abs: (v) => (v === 0 ? 'good' : 'bad'),
    note: ({ k }) => (k.ordersUnpriced > 0 ? 'стоимость неизвестна — не в выручке и не в % мастерам' : null),
  },
  {
    group: G_WORK,
    label: 'Выручка на мастера',
    kind: 'rub',
    dir: 'up',
    get: ({ k }) => (revKnown(k) ? k.revenuePerMasterKop : null),
    note: ({ k }) => `${k.activeMasters} ${plural(k.activeMasters, 'мастер', 'мастера', 'мастеров')} с нарядами`,
  },
  {
    group: G_WORK,
    label: 'Доля переносов, %',
    kind: 'pct',
    dir: 'down',
    get: ({ k }) => k.rescheduleRatePct,
    abs: (v) => (v === 0 ? 'good' : null),
    note: ({ k }) => {
      const total = k.ordersCompleted + k.ordersOpen;
      return `${k.rescheduleRequests} ${plural(k.rescheduleRequests, 'запрос', 'запроса', 'запросов')} на ${total} ${plural(total, 'наряд', 'наряда', 'нарядов')}`;
    },
  },
  {
    group: G_WORK,
    label: 'Одобрено переносов',
    kind: 'int',
    dir: 'down',
    get: ({ k }) => k.rescheduleApproved,
    abs: (v) => (v === 0 ? 'good' : null),
  },
  {
    group: G_WORK,
    label: '«В назначенный день», %',
    kind: 'pct',
    dir: 'up',
    get: ({ k }) => k.onTimePct,
    note: ({ k }) => `${k.onTimeCount} из ${k.onTimeBase} (наряды с планом и отметкой «Начать»)`,
  },
  {
    group: G_PAY,
    label: 'Выплаты мастерам (к выплате)',
    kind: 'rub',
    dir: 'neutral',
    get: (c) => (payKnown(c) ? c.k.masterPayKop : null),
    note: (c) => {
      if (!payKnown(c)) return 'ставки мастеров не заданы';
      return c.k.ordersUnpriced > 0
        ? `без начислений за ${c.k.ordersUnpriced} ${plural(c.k.ordersUnpriced, 'наряд', 'наряда', 'нарядов')} без цены`
        : 'max(набрал по %, минималка) по каждому';
    },
  },
  {
    group: G_PAY,
    label: '   в т.ч. доплаты до минималки',
    kind: 'rub',
    dir: 'down',
    get: (c) => (payKnown(c) ? c.k.masterTopUpKop : null),
    abs: (v) => (v === 0 ? 'good' : null),
    note: () => 'платит организация, если мастер не набрал минималку',
  },
  {
    group: G_CLIENTS,
    label: 'Клиентов обслужено',
    kind: 'int',
    dir: 'up',
    get: ({ k }) => k.clientsServed,
  },
  {
    group: G_CLIENTS,
    label: 'Доля топ-5 клиентов в выручке, %',
    kind: 'pct',
    dir: 'down',
    get: ({ k }) => (revKnown(k) ? k.top5SharePct : null),
    note: () => 'риск концентрации: рост — плохо',
  },
  {
    group: G_CLIENTS,
    label: 'Новые клиенты',
    kind: 'int',
    dir: 'up',
    get: ({ k }) => k.newClients,
  },
  {
    group: G_CLIENTS,
    label: 'Отказались (в месяце)',
    kind: 'int',
    dir: 'down',
    get: ({ k }) => k.refusedInMonth,
    abs: (v) => (v === 0 ? 'good' : null),
  },
  {
    group: G_CLIENTS,
    label: 'Отток, %',
    kind: 'pct',
    dir: 'down',
    get: ({ k }) => k.churnPct,
    abs: (v) => (v === 0 ? 'good' : null),
    note: ({ k, activeClients }) =>
      activeClients === undefined
        ? null
        : `${k.refusedInMonth} / (${activeClients} активных + ${k.refusedInMonth}); активные — на момент выгрузки`,
  },
  {
    group: G_CLIENTS,
    label: 'Заявки (лиды)',
    kind: 'int',
    dir: 'up',
    get: ({ k }) => k.leads,
  },
  {
    group: G_CLIENTS,
    label: 'Конверсия заявок в клиентов, %',
    kind: 'pct',
    dir: 'up',
    get: ({ k }) => k.leadConversionPct,
    note: ({ k }) => `${k.leadsConverted} из ${k.leads}`,
  },
];

const STATUS: Record<StatusKey, { label: string; fill?: string; font: string }> = {
  good: { label: 'Хорошо', fill: C.goodFill, font: C.goodFont },
  flat: { label: 'Стабильно', fill: C.flatFill, font: C.flatFont },
  bad: { label: 'Плохо', fill: C.badFill, font: C.badFont },
  na: { label: NA, fill: C.grayFill, font: C.gray },
  nobase: { label: 'Нет базы', fill: C.grayFill, font: C.gray },
  info: { label: '—', font: C.gray },
};

/** Порог «стабильно»: ±5% для сумм/штук, ±2 п.п. для долей. */
const BAND_REL = 5;
const BAND_PP = 2;

function statusOf(def: KpiDef, cur: number | null, prev: number | null): StatusKey {
  if (cur === null) return 'na';
  if (def.abs) {
    const s = def.abs(cur);
    if (s) return s;
  }
  if (def.dir === 'neutral') return 'info';
  if (prev === null) return 'nobase';
  let d: number;
  let band: number;
  if (def.kind === 'pct') {
    d = cur - prev;
    band = BAND_PP;
  } else {
    band = BAND_REL;
    if (prev === 0) {
      if (cur === 0) return 'flat';
      d = cur > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else {
      d = deltaPct(cur, prev) ?? 0;
    }
  }
  const up = d > band;
  const down = d < -band;
  if (!up && !down) return 'flat';
  if (def.dir === 'up') return up ? 'good' : 'bad';
  return down ? 'good' : 'bad';
}

function putKpiValue(ws: ExcelJS.Worksheet, r: number, c: number, kind: Kind, v: number | null, st: St = {}) {
  if (v === null) return putNA(ws, r, c, st);
  if (kind === 'rub') return put(ws, r, c, kopToRub(v), { ...st, numFmt: FMT_RUB, h: 'right' });
  // Доля числом 0..1; округление убирает хвосты 0.38799999… (проценты в KPI уже до 0,1).
  if (kind === 'pct') return put(ws, r, c, Math.round(v * 10) / 1000, { ...st, numFmt: FMT_PCT, h: 'right' });
  return put(ws, r, c, v, { ...st, numFmt: FMT_INT, h: 'right' });
}

function putDelta(ws: ExcelJS.Worksheet, r: number, c: number, def: KpiDef, cur: number | null, prev: number | null, st: St = {}) {
  if (cur === null || prev === null) return putNA(ws, r, c, st);
  if (def.kind === 'pct') {
    return put(ws, r, c, Math.round((cur - prev) * 10) / 10, { ...st, numFmt: FMT_DELTA_PP, h: 'right' });
  }
  const d = deltaPct(cur, prev);
  if (d === null) {
    return put(ws, r, c, cur === 0 ? 'без изм.' : 'нет базы', { ...st, color: C.gray, italic: true, h: 'right' });
  }
  return put(ws, r, c, d / 100, { ...st, numFmt: FMT_DELTA_PCT, h: 'right' });
}

// ─── Лист «Сводка» ──────────────────────────────────────────────────

function verdictLines(d: MonthData, prev: MonthKpis): string[] {
  const k = d.kpis;
  const vs = `к ${MONTHS_DAT[Number(prev.month.slice(5, 7)) - 1]}`;
  const dOrders = deltaPct(k.ordersCompleted, prev.ordersCompleted);
  const ordersPart =
    `выполнено ${k.ordersCompleted} ${plural(k.ordersCompleted, 'наряд', 'наряда', 'нарядов')}` +
    (dOrders !== null ? ` (${fmtSigned(dOrders, '%')} ${vs})` : '');

  let line1: string;
  if (k.ordersCompleted === 0) {
    line1 = 'Выполненных нарядов в месяце нет — денег за месяц нет.';
  } else if (!revKnown(k)) {
    line1 =
      `${ordersPart[0].toUpperCase()}${ordersPart.slice(1)}. Выручку и маржу посчитать нельзя: ` +
      `у ${k.ordersUnpriced} из ${k.ordersCompleted} нарядов нет цены (учёт цен нарядов — с ноября 2026), поэтому деньги — «н/д».`;
  } else {
    const dRev = revKnown(prev) && prev.ordersCompleted > 0 ? deltaPct(k.revenueKop, prev.revenueKop) : null;
    const margin = payKnown({ k, masters: d.masters }) ? fmtPctText(k.marginPct) : NA;
    line1 =
      `Выручка ${formatRub(k.revenueKop)}${dRev !== null ? ` (${fmtSigned(dRev, '%')} ${vs})` : ''}, ` +
      `валовая маржа ${margin}; ${ordersPart}, средний чек ${formatRub(k.avgTicketKop)}.` +
      (k.ordersUnpriced > 0 ? ` Данные неполные: ${k.ordersUnpriced} ${plural(k.ordersUnpriced, 'наряд', 'наряда', 'нарядов')} без цены.` : '');
  }

  const line2 =
    `Переносов ${k.rescheduleRequests}` +
    (k.rescheduleRatePct !== null ? ` (${fmtPctText(k.rescheduleRatePct)} нарядов)` : '') +
    `, одобрено ${k.rescheduleApproved}; ` +
    (k.onTimeBase > 0
      ? `в назначенный день ${fmtPctText(k.onTimePct)} (${k.onTimeCount} из ${k.onTimeBase}). `
      : '«в назначенный день» — нет нарядов с планом и отметкой «Начать». ') +
    `Клиентов обслужено ${k.clientsServed}, новых ${k.newClients}, отказались ${k.refusedInMonth}` +
    (k.churnPct !== null ? ` (отток ${fmtPctText(k.churnPct)})` : '') +
    `; заявок ${k.leads}, конверсия ${fmtPctText(k.leadConversionPct)}.`;
  return [line1, line2];
}

function buildSummary(wb: ExcelJS.Workbook, report: MonthlyReport, now: Date) {
  const d = report.current;
  const k = d.kpis;
  const prev = report.previous;
  const ws = newSheet(wb, 'Сводка', { tab: C.navy, grid: false });
  setWidths(ws, [46, 16, 16, 13, 13, 52]);
  const LAST = 6;

  put(ws, 1, 1, 'ИП Белавина О.В. · ДезТехЮг', { bold: true, size: 11, color: C.gray });
  put(ws, 2, 1, `Управленческая сводка за ${monthTitle(d.month)}`, { bold: true, size: 16, color: C.title });
  ws.mergeCells(2, 1, 2, LAST);
  ws.getRow(2).height = 24;
  put(
    ws,
    3,
    1,
    `Выгружено ${mskStamp(now)} (МСК). Сравнение — с прошлым месяцем (${monthTitle(prev.month)}). ` +
      'Деньги — только по выполненным нарядам, по дате выполнения.',
    { italic: true, size: 9, color: C.gray },
  );
  ws.mergeCells(3, 1, 3, LAST);

  let r = 5;
  put(ws, r, 1, 'Вердикт', { bold: true, size: 12, color: C.title });
  r++;
  for (const line of verdictLines(d, prev)) {
    put(ws, r, 1, line, { size: 11, wrap: true, v: 'top' });
    ws.mergeCells(r, 1, r, LAST);
    ws.getRow(r).height = Math.max(16, 15 * estLines(line, totalWidth(ws, LAST), 0.95) + 3);
    r++;
  }

  // Предупреждения — красной/жёлтой строкой ДО таблицы, чтобы их нельзя было не заметить.
  if (k.ordersUnpriced > 0) {
    const text =
      `⚠ ${k.ordersUnpriced} из ${k.ordersCompleted} выполненных нарядов без цены — выручка, маржа и % мастерам ` +
      'по ним не посчитаны (н/д, не ноль). Проставьте цены в нарядах — список на листе «Выполненные работы» (колонка «Цена»).';
    put(ws, r, 1, text, { bold: true, color: C.badFont, fill: C.badFill, wrap: true, v: 'middle' });
    ws.mergeCells(r, 1, r, LAST);
    ws.getRow(r).height = Math.max(18, 14 * estLines(text, totalWidth(ws, LAST), 0.95) + 4);
    r++;
  }
  const noRate = d.masters.filter((m) => m.ordersCompleted > 0 && !m.hasRate).map((m) => m.name);
  if (noRate.length > 0) {
    const text = `Ставка не задана: ${noRate.join(', ')} — % за наряды не начислен, выплаты и маржа неполные.`;
    put(ws, r, 1, text, { bold: true, color: C.flatFont, fill: C.flatFill, wrap: true, v: 'middle' });
    ws.mergeCells(r, 1, r, LAST);
    ws.getRow(r).height = Math.max(18, 14 * estLines(text, totalWidth(ws, LAST), 0.95) + 4);
    r++;
  }

  r++;
  headerRow(ws, r, ['Показатель', monthTitle(d.month), monthTitle(prev.month), 'Δ', 'Статус', 'Примечание']);
  r++;

  const curCtx: KCtx = { k, masters: d.masters, activeClients: d.clients.byStatus.active ?? 0 };
  const prevCtx: KCtx = { k: prev };
  for (const group of GROUPS) {
    put(ws, r, 1, group, { bold: true, fill: C.section, border: true });
    for (let c = 2; c <= LAST; c++) put(ws, r, c, null, { fill: C.section, border: true });
    r++;
    for (const def of KPIS.filter((x) => x.group === group)) {
      const cur = def.get(curCtx);
      const pv = def.get(prevCtx);
      const st = statusOf(def, cur, pv);
      const sub = def.label.startsWith(' ');
      put(ws, r, 1, def.label, { border: true, bold: !sub, wrap: true, color: sub ? C.navyLight : undefined });
      putKpiValue(ws, r, 2, def.kind, cur, { border: true, bold: !sub });
      putKpiValue(ws, r, 3, def.kind, pv, { border: true });
      putDelta(ws, r, 4, def, cur, pv, { border: true });
      const s = STATUS[st];
      put(ws, r, 5, s.label, { border: true, bold: true, h: 'center', color: s.font, fill: s.fill });
      const note = def.note ? def.note(curCtx) : null;
      put(ws, r, 6, note ?? '', { border: true, wrap: true, size: 9, color: C.gray });
      fitHeight(ws, r, [
        { text: def.label, width: 46 },
        { text: note ?? '', width: 56 },
      ]);
      r++;
    }
  }

  r++;
  const legend = [
    'Статус: «Хорошо» (зелёный) — изменение в нужную сторону; «Стабильно» (жёлтый) — в пределах ±5% для сумм и штук или ±2 п.п. для долей; ' +
      '«Плохо» (красный) — в ненужную сторону; «н/д» / «Нет базы» (серый) — данных нет или не с чем сравнить; «—» — справочный показатель без оценки.',
    'Рост выручки, маржи, нарядов, клиентов — хорошо; рост переносов, оттока, отказов, доплат до минималки, нарядов без цены и доли топ-5 — плохо.',
    'Δ: для сумм и штук — относительное изменение в %, для долей — разница в процентных пунктах (п.п.).',
    'Детали — листы «Тренд», «Выполненные работы», «График мастеров», «Переносы», «Зарплата», «Клиенты». Как считается каждая цифра и что в неё НЕ входит — лист «Определения».',
  ];
  for (const line of legend) {
    put(ws, r, 1, line, { italic: true, size: 9, color: C.gray, wrap: true });
    ws.mergeCells(r, 1, r, LAST);
    ws.getRow(r).height = Math.max(14, 12 * estLines(line, totalWidth(ws, LAST), 1.15) + 3);
    r++;
  }
  ws.pageSetup.printArea = `A1:F${r - 1}`;
}

// ─── Лист «Тренд» ───────────────────────────────────────────────────

function buildTrend(wb: ExcelJS.Workbook, report: MonthlyReport) {
  const d = report.current;
  const months = report.trend;
  const HEAD = 4;
  const ws = newSheet(wb, 'Тренд', { tab: 'FF2F5597', landscape: true, freeze: { x: 1, y: HEAD } });
  setWidths(ws, [46, ...months.map(() => 15)]);
  const LAST = months.length + 1;
  sheetTitle(
    ws,
    `Тренд за ${months.length} мес.: ${monthTitle(months[0].month)} — ${monthTitle(months[months.length - 1].month)}`,
    'Те же формулы, что на «Сводке». «н/д» — данных нет (цены нарядов до ноября 2026 не велись, ставки мастеров не заданы). ' +
      'Последний столбец — отчётный месяц.',
    LAST,
  );
  headerRow(ws, HEAD, ['Показатель', ...months.map((m) => monthTitle(m.month))]);
  // Отчётный месяц — выделить шапку.
  put(ws, HEAD, LAST, monthTitle(months[months.length - 1].month), {
    bold: true, color: C.navy, fill: C.flatFill, h: 'center', v: 'middle', wrap: true, border: true,
  });

  let r = HEAD + 1;
  const ctxs: KCtx[] = months.map((k) =>
    k.month === d.month ? { k, masters: d.masters, activeClients: d.clients.byStatus.active ?? 0 } : { k },
  );
  for (const group of GROUPS) {
    put(ws, r, 1, group, { bold: true, fill: C.section, border: true });
    for (let c = 2; c <= LAST; c++) put(ws, r, c, null, { fill: C.section, border: true });
    r++;
    for (const def of KPIS.filter((x) => x.group === group)) {
      const sub = def.label.startsWith(' ');
      put(ws, r, 1, def.label, { border: true, bold: !sub, color: sub ? C.navyLight : undefined });
      ctxs.forEach((ctx, i) => {
        putKpiValue(ws, r, i + 2, def.kind, def.get(ctx), { border: true, bold: i === ctxs.length - 1 });
      });
      r++;
    }
  }
  ws.pageSetup.printTitlesColumn = 'A:A';
}

// ─── Лист «Выполненные работы» ──────────────────────────────────────

const ORDER_STATUS: Record<MonthOrder['status'], string> = {
  completed: 'выполнен',
  planned: 'план',
  in_progress: 'в работе',
};

function serviceLine(s: MonthOrderService, multiObject: boolean): string {
  let t = s.name;
  const q = s.quantity ? formatQuantity(s.quantity) : '';
  if (q) t += ` — ${q} ${unitLabel(s.unit)}`;
  if (multiObject && s.objectName) t += ` [${s.objectName}]`;
  if (s.priceKop !== null) t += ` · ${formatRub(s.priceKop)}`;
  return t;
}

function shareLine(s: MonthOrder['shares'][number]): string {
  switch (s.basis) {
    case 'percent':
      return `${s.name}: ${formatRub(s.amountKop)} (${fmtNum(s.percent ?? 0, 2)}%)`;
    case 'override':
      return `${s.name}: ${formatRub(s.amountKop)} (вручную)`;
    case 'no_master_pay':
      return `${s.name}: 0 ₽ (документальный)`;
    case 'no_price':
      return `${s.name}: н/д — нет цены`;
    case 'no_rate':
      return `${s.name}: н/д — ставка не задана`;
    default:
      return `${s.name}: ${formatRub(s.amountKop)}`;
  }
}

function buildWorks(wb: ExcelJS.Workbook, d: MonthData) {
  const HEAD = 4;
  const ws = newSheet(wb, 'Выполненные работы', { tab: 'FF548235', landscape: true, freeze: { x: 0, y: HEAD } });
  const widths = [11, 7, 10, 28, 14, 30, 34, 56, 28, 22, 14, 16, 13, 34, 13, 12, 11];
  setWidths(ws, widths);
  const headers = [
    'Дата', 'Время', 'Статус', 'Клиент', 'Договор', 'Объект(ы)', 'Адрес(а)', 'Услуги (кол-во, ед., цена)',
    'Препараты', 'Мастер(а)', 'Стоимость, ₽', 'Цена', 'Мастерам, ₽', 'Мастерам — по каждому',
    'Документальный', 'Регулярный / разовый', 'Переносов одобрено',
  ];
  const LAST = headers.length;
  const k = d.kpis;
  sheetTitle(
    ws,
    `Выполненные работы — ${monthTitle(d.month)}`,
    `Строка = наряд. Все наряды месяца (${d.orders.length}): выполненные — по дате выполнения, план / в работе — по плановой дате ` +
      `(в деньги не идут). Выполнено ${k.ordersCompleted}, в плане / работе ${k.ordersOpen}. ` +
      'Пустая «Стоимость» с пометкой «н/д» — у наряда нет цены (это не 0 ₽). Время — начало работы, иначе плановое (МСК).',
    LAST,
  );
  headerRow(ws, HEAD, headers, 34);

  const first = HEAD + 1;
  const last = HEAD + d.orders.length;
  let r = first;
  for (const o of d.orders) {
    const done = o.status === 'completed';
    const base: St = { border: true, wrap: true, italic: !done, color: done ? undefined : C.gray };
    const multi = o.objects.length > 1;
    const objects = o.objects.map((x) => x.name).join('\n');
    const addresses = o.objects.map((x) => x.address).join('\n');
    const services = o.services.map((s) => serviceLine(s, multi)).join('\n');
    const crew = o.crew.map((c) => c.name).join('\n');
    const sharesText = done ? o.shares.map(shareLine).join('\n') : '— (не выполнен)';

    put(ws, r, 1, dayDate(o.day), { ...base, numFmt: FMT_DATE, h: 'center' });
    put(ws, r, 2, o.time ?? '—', { ...base, h: 'center' });
    put(ws, r, 3, ORDER_STATUS[o.status], { ...base, h: 'center', bold: o.status === 'in_progress' });
    put(ws, r, 4, o.clientName, base);
    put(ws, r, 5, o.contractNumber, base);
    put(ws, r, 6, objects || '—', base);
    put(ws, r, 7, addresses || '—', base);
    put(ws, r, 8, services || '—', base);
    put(ws, r, 9, o.preparations ?? '', base);
    put(ws, r, 10, crew, base);

    // Стоимость: число или пусто; пометка — в соседней колонке «Цена».
    if (done && o.costKop !== null) put(ws, r, 11, kopToRub(o.costKop), { ...base, numFmt: FMT_RUB2, h: 'right' });
    else put(ws, r, 11, null, base);
    if (!done) {
      put(ws, r, 12, 'не в деньгах (не выполнен)', { ...base, size: 9 });
    } else if (o.priceStatus === 'full') {
      put(ws, r, 12, 'есть', { ...base, color: C.goodFont });
    } else if (o.priceStatus === 'partial') {
      const priced = o.services.filter((s) => s.priceKop !== null).length;
      put(ws, r, 12, `частично: ${priced} из ${o.services.length} строк`, { ...base, color: C.flatFont, fill: C.flatFill });
    } else {
      put(ws, r, 12, NA, { ...base, bold: true, color: C.badFont, fill: C.grayFill, h: 'center' });
    }

    // Мастерам: сумма известных начислений (percent/override/документальный = 0).
    const known = o.shares.filter((s) => s.basis !== 'no_price' && s.basis !== 'no_rate');
    if (done && known.length > 0) {
      put(ws, r, 13, kopToRub(known.reduce((s, x) => s + x.amountKop, 0)), { ...base, numFmt: FMT_RUB2, h: 'right' });
    } else {
      put(ws, r, 13, null, base);
    }
    put(ws, r, 14, sharesText, { ...base, size: 9 });
    put(ws, r, 15, o.noMasterPay ? 'да' : 'нет', { ...base, h: 'center', bold: o.noMasterPay });
    put(ws, r, 16, o.recurring ? 'регулярный' : 'разовый', { ...base, h: 'center' });
    put(ws, r, 17, o.approvedReschedules, { ...base, numFmt: FMT_INT, h: 'center', bold: o.approvedReschedules > 0 });

    fitHeight(ws, r, [
      { text: o.clientName, width: widths[3] },
      { text: objects, width: widths[5] },
      { text: addresses, width: widths[6] },
      { text: services, width: widths[7] },
      // Препараты — свободный текст (бывает 800+ знаков инструкций): в клетке лежит целиком,
      // но высоту строки задаёт не дальше ~8 строк, иначе каждая строка — на экран.
      { text: (o.preparations ?? '').slice(0, 240), width: widths[8] },
      { text: crew, width: widths[9] },
      { text: sharesText, width: widths[13] * 1.1 },
    ]);
    r++;
  }

  if (d.orders.length === 0) {
    put(ws, first, 1, 'Нарядов в этом месяце нет.', { italic: true, color: C.gray });
    ws.mergeCells(first, 1, first, LAST);
  } else {
    // Итоги над шапкой: SUBTOTAL считает только видимые строки — работает вместе с автофильтром.
    put(ws, 3, 1, 'Итого по видимым строкам:', { bold: true, h: 'right' });
    ws.mergeCells(3, 1, 3, 3);
    put(ws, 3, 4, { formula: `SUBTOTAL(103,D${first}:D${last})`, result: d.orders.length }, { bold: true, numFmt: '0" нарядов"' });
    const costSum = d.orders.reduce((s, o) => s + (o.status === 'completed' && o.costKop !== null ? o.costKop : 0), 0);
    put(ws, 3, 11, { formula: `SUBTOTAL(109,K${first}:K${last})`, result: kopToRub(costSum) }, { bold: true, numFmt: FMT_RUB2, h: 'right' });
    let paySum = 0;
    for (const o of d.orders) {
      if (o.status !== 'completed') continue;
      for (const s of o.shares) if (s.basis !== 'no_price' && s.basis !== 'no_rate') paySum += s.amountKop;
    }
    put(ws, 3, 13, { formula: `SUBTOTAL(109,M${first}:M${last})`, result: kopToRub(paySum) }, { bold: true, numFmt: FMT_RUB2, h: 'right' });
    const reschedSum = d.orders.reduce((s, o) => s + o.approvedReschedules, 0);
    put(ws, 3, 17, { formula: `SUBTOTAL(109,Q${first}:Q${last})`, result: reschedSum }, { bold: true, numFmt: FMT_INT, h: 'center' });
    ws.autoFilter = `A${HEAD}:${colLetter(LAST)}${last}`;
  }
  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
}

function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// ─── Лист «График мастеров» ─────────────────────────────────────────

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Запись наряда в клетке графика — коротко (полные имена/адреса — на «Выполненных работах»). */
function scheduleEntry(o: MonthOrder): string {
  const obj =
    o.objects.length === 0
      ? ''
      : `: ${clip(o.objects[0].name, 26)}${o.objects.length > 1 ? ` +${o.objects.length - 1}` : ''}`;
  return `${o.approvedReschedules > 0 ? '↻ ' : ''}${o.time ? `${o.time} ` : ''}${clip(o.clientName, 24)}${obj}`;
}

function buildSchedule(wb: ExcelJS.Workbook, d: MonthData) {
  const HEAD = 4;
  const lastDay = Number(d.bounds.end.slice(8, 10));
  const [y, m] = d.month.split('-').map(Number);
  const ws = newSheet(wb, 'График мастеров', { tab: 'FFBF8F00', landscape: true, freeze: { x: 1, y: HEAD } });
  const DAY_W = 17;
  setWidths(ws, [26, ...Array.from({ length: lastDay }, () => DAY_W), 10, 11]);
  const COL_TOTAL = lastDay + 2;
  const COL_DONE = lastDay + 3;
  sheetTitle(
    ws,
    `График мастеров — ${monthTitle(d.month)}`,
    'Клетка = наряды мастера в этот день: время, клиент — объект. ↻ — у наряда был одобренный перенос; ' +
      'серый курсив — запланирован / в работе (ещё не выполнен). Наряд бригады стоит у КАЖДОГО мастера бригады. Легенда — внизу.',
    Math.min(COL_DONE, 16),
  );

  // Шапка: число + день недели; выходные — другим цветом.
  put(ws, HEAD, 1, 'Мастер', { bold: true, color: C.white, fill: C.navy, h: 'center', v: 'middle', border: true });
  const isWeekend: boolean[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    const we = wd === 0 || wd === 6;
    isWeekend[day] = we;
    put(ws, HEAD, day + 1, `${day}\n${WEEKDAYS[wd]}`, {
      bold: true, color: C.white, fill: we ? 'FF8497B0' : C.navy, h: 'center', v: 'middle', wrap: true, border: true,
    });
  }
  put(ws, HEAD, COL_TOTAL, 'Нарядов', { bold: true, color: C.white, fill: C.navy, h: 'center', v: 'middle', wrap: true, border: true });
  put(ws, HEAD, COL_DONE, 'из них выполнено', { bold: true, color: C.white, fill: C.navy, h: 'center', v: 'middle', wrap: true, border: true });
  ws.getRow(HEAD).height = 30;

  // Мастера: все из зарплатного списка (вкл. активных без нарядов) + кто встретился в бригадах.
  const ids: string[] = d.masters.map((x) => x.userId);
  const names = new Map<string, string>(d.masters.map((x) => [x.userId, x.name] as [string, string]));
  for (const o of d.orders) {
    for (const c of o.crew) {
      if (!names.has(c.id)) {
        names.set(c.id, c.name);
        ids.push(c.id);
      }
    }
  }

  const byCell = new Map<string, MonthOrder[]>();
  const byDayUnique = new Map<number, number>();
  for (const o of d.orders) {
    const day = Number(o.day.slice(8, 10));
    byDayUnique.set(day, (byDayUnique.get(day) ?? 0) + 1);
    for (const c of o.crew) {
      const key = `${c.id}|${day}`;
      const arr = byCell.get(key) ?? [];
      arr.push(o);
      byCell.set(key, arr);
    }
  }

  let r = HEAD + 1;
  const perDayAll: number[] = [];
  let grandAll = 0;
  for (const id of ids) {
    put(ws, r, 1, names.get(id) ?? '—', { bold: true, border: true, v: 'top', wrap: true });
    let total = 0;
    let done = 0;
    let maxLines = 1;
    for (let day = 1; day <= lastDay; day++) {
      const list = byCell.get(`${id}|${day}`) ?? [];
      const col = day + 1;
      if (list.length === 0) {
        put(ws, r, col, null, { border: true, fill: isWeekend[day] ? C.weekend : undefined });
        continue;
      }
      total += list.length;
      perDayAll[day] = (perDayAll[day] ?? 0) + list.length;
      const rich: ExcelJS.RichText[] = list.map((o, i) => {
        const finished = o.status === 'completed';
        if (finished) done += 1;
        const font: Partial<ExcelJS.Font> = { name: 'Calibri', size: 8 };
        if (!finished) {
          font.italic = true;
          font.color = { argb: C.gray };
        }
        return { text: `${i > 0 ? '\n' : ''}${scheduleEntry(o)}`, font };
      });
      const cell = put(ws, r, col, null, {
        border: true, wrap: true, size: 8, fill: C.heat[Math.min(list.length, 4) - 1],
      });
      cell.value = { richText: rich };
      const lines = list.reduce((s, o) => s + estLines(scheduleEntry(o), DAY_W, 1.45), 0);
      maxLines = Math.max(maxLines, lines);
    }
    grandAll += total;
    put(ws, r, COL_TOTAL, total, { bold: true, border: true, h: 'center', numFmt: FMT_INT });
    put(ws, r, COL_DONE, done, { border: true, h: 'center', numFmt: FMT_INT });
    ws.getRow(r).height = Math.min(409, Math.max(18, maxLines * 11 + 4));
    r++;
  }

  // Итоговые строки: с бригадами (сумма по мастерам) и уникальные наряды.
  put(ws, r, 1, 'Всего по мастерам (бригада — у каждого)', { bold: true, border: true, fill: C.section, wrap: true });
  for (let day = 1; day <= lastDay; day++) {
    put(ws, r, day + 1, perDayAll[day] ?? 0, { border: true, fill: C.section, h: 'center', numFmt: '0;-0;""' });
  }
  put(ws, r, COL_TOTAL, grandAll, { bold: true, border: true, fill: C.section, h: 'center', numFmt: FMT_INT });
  put(ws, r, COL_DONE, null, { border: true, fill: C.section });
  ws.getRow(r).height = 28;
  r++;
  put(ws, r, 1, 'Уникальных нарядов в день', { bold: true, border: true, fill: C.section, wrap: true });
  for (let day = 1; day <= lastDay; day++) {
    put(ws, r, day + 1, byDayUnique.get(day) ?? 0, { border: true, fill: C.section, h: 'center', numFmt: '0;-0;""' });
  }
  put(ws, r, COL_TOTAL, d.orders.length, { bold: true, border: true, fill: C.section, h: 'center', numFmt: FMT_INT });
  put(ws, r, COL_DONE, d.kpis.ordersCompleted, { border: true, fill: C.section, h: 'center', numFmt: FMT_INT });
  ws.getRow(r).height = 28;
  r += 2;

  // Легенда.
  put(ws, r, 1, 'Легенда', { bold: true });
  r++;
  const heatLabels = ['1 наряд в день', '2 наряда', '3 наряда', '4 и больше'];
  heatLabels.forEach((label, i) => {
    put(ws, r, 2, null, { fill: C.heat[i], border: true });
    put(ws, r, 3, label, { size: 9 });
    r++;
  });
  put(ws, r, 2, null, { fill: C.weekend, border: true });
  put(ws, r, 3, 'выходной (сб, вс) без нарядов', { size: 9 });
  r++;
  const notes = [
    '↻ — у наряда был одобренный перенос даты (запрос мастера, одобрен менеджером).',
    'Серый курсив — наряд запланирован или в работе, ещё не выполнен (в деньги не идёт).',
    'Время — начало работы (если мастер нажал «Начать»), иначе плановое; МСК.',
    '«Всего по мастерам» больше числа уникальных нарядов, когда были бригады: наряд бригады засчитан каждому мастеру.',
  ];
  for (const n of notes) {
    put(ws, r, 2, n, { size: 9, color: C.gray });
    r++;
  }
  ws.pageSetup.printTitlesColumn = 'A:A';
  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
}

// ─── Лист «Переносы» ────────────────────────────────────────────────

const RESCHED_STATUS: Record<MonthReschedule['status'], { label: string; fill?: string; font?: string }> = {
  pending: { label: 'Ожидает', fill: C.flatFill, font: C.flatFont },
  approved: { label: 'Одобрен', fill: C.goodFill, font: C.goodFont },
  rejected: { label: 'Отклонён', fill: C.badFill, font: C.badFont },
  cancelled: { label: 'Отменён', fill: C.grayFill, font: C.gray },
};

function buildReschedules(wb: ExcelJS.Workbook, d: MonthData) {
  const list = d.reschedules;
  const k = d.kpis;
  const count = (s: MonthReschedule['status']) => list.filter((x) => x.status === s).length;
  const HEAD = 11;
  const ws = newSheet(wb, 'Переносы', { tab: 'FFC55A11', landscape: true, freeze: { x: 0, y: HEAD } });
  const widths = [16, 24, 26, 26, 16, 16, 40, 12, 22, 16, 36];
  setWidths(ws, widths);
  const LAST = widths.length;
  sheetTitle(
    ws,
    `Переносы нарядов — ${monthTitle(d.month)}`,
    'Запросы мастеров на перенос даты наряда, созданные в этом месяце (МСК). Доля — запросы / все наряды месяца.',
    LAST,
  );

  const totals: [string, number | null, string][] = [
    ['Всего запросов', list.length, FMT_INT],
    ['Одобрено', count('approved'), FMT_INT],
    ['Отклонено', count('rejected'), FMT_INT],
    ['Ожидают решения', count('pending'), FMT_INT],
    ['Отменены мастером', count('cancelled'), FMT_INT],
    ['Доля от нарядов месяца', k.rescheduleRatePct === null ? null : Math.round(k.rescheduleRatePct * 10) / 1000, FMT_PCT],
  ];
  let r = 4;
  for (const [label, val, fmt] of totals) {
    put(ws, r, 1, label, { bold: true, border: true });
    ws.mergeCells(r, 1, r, 2);
    if (val === null) putNA(ws, r, 3, { border: true });
    else put(ws, r, 3, val, { numFmt: fmt, border: true, h: 'right', bold: true });
    r++;
  }

  headerRow(ws, HEAD, [
    'Запрошено', 'Мастер', 'Клиент', 'Объект', 'Было', 'Просил', 'Причина', 'Решение', 'Кто решил', 'Когда решил', 'Комментарий',
  ]);
  r = HEAD + 1;
  for (const x of list) {
    const base: St = { border: true, wrap: true };
    putDateTime(ws, r, 1, x.createdAt, base);
    put(ws, r, 2, x.masterName, base);
    put(ws, r, 3, x.clientName, base);
    put(ws, r, 4, x.objectName ?? '—', base);
    putDateTime(ws, r, 5, x.fromAt, base);
    putDateTime(ws, r, 6, x.toAt, base);
    put(ws, r, 7, x.reason, base);
    const s = RESCHED_STATUS[x.status];
    put(ws, r, 8, s.label, { ...base, bold: true, h: 'center', fill: s.fill, color: s.font });
    put(ws, r, 9, x.decidedByName ?? '—', base);
    putDateTime(ws, r, 10, x.decidedAt, base);
    put(ws, r, 11, x.decisionComment ?? '', base);
    fitHeight(ws, r, [
      { text: x.reason, width: widths[6] },
      { text: x.decisionComment ?? '', width: widths[10] },
      { text: x.clientName, width: widths[2] },
      { text: x.objectName ?? '', width: widths[3] },
    ]);
    r++;
  }
  if (list.length === 0) {
    put(ws, r, 1, 'Запросов на перенос в этом месяце не было.', { italic: true, color: C.gray });
    ws.mergeCells(r, 1, r, LAST);
  } else {
    ws.autoFilter = `A${HEAD}:${colLetter(LAST)}${HEAD + list.length}`;
  }
  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
}

// ─── Лист «Зарплата» ────────────────────────────────────────────────

function buildPayroll(wb: ExcelJS.Workbook, d: MonthData) {
  const k = d.kpis;
  const anyRate = d.masters.some((m) => m.hasRate);
  const warnings: { text: string; fill: string; font: string }[] = [];
  if (!anyRate) {
    warnings.push({
      text: 'Ставки мастеров не заданы — % за наряды и минималки не начислены, выплаты «н/д». Задайте ставки в разделе «Мастера».',
      fill: C.badFill,
      font: C.badFont,
    });
  }
  if (k.ordersUnpriced > 0) {
    warnings.push({
      text: `${k.ordersUnpriced} ${plural(k.ordersUnpriced, 'выполненный наряд', 'выполненных наряда', 'выполненных нарядов')} без цены — % по ним не начислен, «набрал» занижен.`,
      fill: C.flatFill,
      font: C.flatFont,
    });
  }
  const HEAD = 4 + warnings.length;
  const ws = newSheet(wb, 'Зарплата', { tab: 'FF7030A0', landscape: true, freeze: { x: 1, y: HEAD } });
  const widths = [28, 10, 11, 16, 15, 14, 15, 15, 11, 11, 44];
  setWidths(ws, widths);
  const LAST = widths.length;
  sheetTitle(
    ws,
    `Зарплата мастеров — ${monthTitle(d.month)}`,
    'К выплате = max(набрал по %, минималка). % за наряд — по ставке на дату наряда, от ПОЛНОЙ стоимости наряда ' +
      '(в бригаде — каждому свой % от полной). Документальный наряд — мастеру 0. Ставка и минималка в таблице — на последний день месяца. ' +
      'Это начисление, а не факт выплаты.',
    LAST,
  );
  let r = 3;
  for (const w of warnings) {
    put(ws, r, 1, w.text, { bold: true, color: w.font, fill: w.fill, wrap: true, v: 'middle' });
    ws.mergeCells(r, 1, r, LAST);
    ws.getRow(r).height = 20;
    r++;
  }
  headerRow(ws, HEAD, [
    'Мастер', 'Ставка, %', 'Нарядов выполнено', 'Выручка по его нарядам, ₽', 'Набрал по %, ₽', 'Минималка, ₽',
    'К выплате, ₽', 'Доплата организации, ₽', 'Нарядов без цены', 'Запросов переноса', 'Пометка',
  ], 44);

  r = HEAD + 1;
  for (const m of d.masters) {
    const base: St = { border: true, color: m.isActive ? undefined : C.gray };
    const notes: string[] = [];
    if (!m.hasRate) notes.push('ставка не задана');
    if (m.ordersUnpriced > 0) {
      notes.push(`${m.ordersUnpriced} ${plural(m.ordersUnpriced, 'наряд', 'наряда', 'нарядов')} без цены — набрано занижено`);
    }
    if (m.topUpKop > 0) {
      notes.push(
        d.kpis.monthComplete
          ? 'не набрал минималку — доплата организации'
          : 'месяц идёт: доплата до минималки — прогноз, в «К выплате» не входит',
      );
    }
    if (!m.isActive) notes.push('неактивен');

    put(ws, r, 1, m.name, { ...base, bold: true, wrap: true });
    if (m.percent === null) put(ws, r, 2, 'не задана', { ...base, color: C.badFont, italic: true, h: 'center' });
    else put(ws, r, 2, m.percent / 100, { ...base, numFmt: FMT_PCT, h: 'right' });
    put(ws, r, 3, m.ordersCompleted, { ...base, numFmt: FMT_INT, h: 'center' });
    const revUnknown = m.ordersCompleted > 0 && m.ordersUnpriced === m.ordersCompleted;
    putRub(ws, r, 4, revUnknown ? null : m.revenueKop, base, FMT_RUB2);
    if (!m.hasRate) {
      putNA(ws, r, 5, base);
      putNA(ws, r, 6, base);
      putNA(ws, r, 7, base);
      putNA(ws, r, 8, base);
    } else {
      putRub(ws, r, 5, m.earnedKop, base, FMT_RUB2);
      putRub(ws, r, 6, m.minKop, base, FMT_RUB2);
      putRub(ws, r, 7, m.payKop, { ...base, bold: true }, FMT_RUB2);
      putRub(ws, r, 8, m.topUpKop, { ...base, color: m.topUpKop > 0 ? C.badFont : base.color }, FMT_RUB2);
    }
    put(ws, r, 9, m.ordersUnpriced, { ...base, numFmt: FMT_INT, h: 'center', color: m.ordersUnpriced > 0 ? C.badFont : base.color });
    put(ws, r, 10, m.rescheduleRequests, { ...base, numFmt: FMT_INT, h: 'center' });
    const note = notes.join('; ');
    put(ws, r, 11, note, { ...base, wrap: true, size: 9 });
    fitHeight(ws, r, [{ text: note, width: widths[10] * 1.1 }, { text: m.name, width: widths[0] }]);
    r++;
  }
  const lastData = r - 1;

  // Итог. Выручку по мастерам НЕ суммируем: наряд бригады засчитан каждому — сумма > выручки компании.
  const tot: St = { border: true, bold: true, fill: C.section };
  put(ws, r, 1, 'Итого', tot);
  put(ws, r, 2, null, tot);
  put(ws, r, 3, d.masters.reduce((s, m) => s + m.ordersCompleted, 0), { ...tot, numFmt: FMT_INT, h: 'center' });
  put(ws, r, 4, '—', { ...tot, h: 'center', color: C.gray });
  if (anyRate) {
    putRub(ws, r, 5, k.masterEarnedKop, tot, FMT_RUB2);
    putRub(ws, r, 6, d.masters.reduce((s, m) => s + m.minKop, 0), tot, FMT_RUB2);
    putRub(ws, r, 7, k.masterPayKop, tot, FMT_RUB2);
    // Сумма строк (как на странице сводки): в идущем месяце это прогноз доплаты, в закончившемся —
    // доплата, вошедшая в выплаты (k.masterTopUpKop). Иначе «Итого» расходилось со строками над ним.
    putRub(ws, r, 8, d.masters.reduce((s, m) => s + m.topUpKop, 0), tot, FMT_RUB2);
  } else {
    for (let c = 5; c <= 8; c++) putNA(ws, r, c, tot);
  }
  put(ws, r, 9, d.masters.reduce((s, m) => s + m.ordersUnpriced, 0), { ...tot, numFmt: FMT_INT, h: 'center' });
  put(ws, r, 10, d.masters.reduce((s, m) => s + m.rescheduleRequests, 0), { ...tot, numFmt: FMT_INT, h: 'center' });
  const totNote =
    'нарядов — с бригадами (наряд бригады у каждого); выручка по мастерам не суммируется по той же причине' +
    (k.monthComplete ? '' : '; месяц идёт — доплата до минималки прогноз, в «К выплате» не входит');
  put(ws, r, 11, totNote, { ...tot, bold: false, wrap: true, size: 9, color: C.gray });
  fitHeight(ws, r, [{ text: totNote, width: widths[10] * 1.1 }]);
  if (d.masters.length > 0) ws.autoFilter = `A${HEAD}:${colLetter(LAST)}${lastData}`;
  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
}

// ─── Лист «Клиенты» ─────────────────────────────────────────────────

const CLIENT_STATUS_LABEL: Record<string, string> = {
  lead: 'Лид',
  active: 'Активный',
  inactive: 'Неактивный',
  blocked: 'Заблокирован',
  refused: 'Отказался',
};

function blockTitle(ws: ExcelJS.Worksheet, r: number, text: string, lastCol: number) {
  put(ws, r, 1, text, { bold: true, size: 12, color: C.title });
  ws.mergeCells(r, 1, r, lastCol);
  ws.getRow(r).height = 20;
}

function buildClients(wb: ExcelJS.Workbook, d: MonthData) {
  const cl = d.clients;
  const k = d.kpis;
  const ws = newSheet(wb, 'Клиенты', { tab: 'FF00B0F0' });
  const widths = [6, 40, 22, 14, 16, 40];
  setWidths(ws, widths);
  const LAST = widths.length;
  sheetTitle(
    ws,
    `Клиенты — ${monthTitle(d.month)}`,
    'Статусы — на момент выгрузки. Новые — карточки, созданные в месяце; отказы — с датой отказа в месяце; выручка — по выполненным нарядам месяца.',
    LAST,
  );
  let r = 4;

  // 1) По статусам.
  blockTitle(ws, r, 'Клиенты по статусам (на момент выгрузки)', LAST);
  r++;
  headerRow(ws, r, ['', 'Статус', 'Клиентов', 'Доля'], 20);
  r++;
  const statusKeys = Object.keys(cl.byStatus).sort((a, b) => (cl.byStatus[b] ?? 0) - (cl.byStatus[a] ?? 0));
  for (const s of statusKeys) {
    put(ws, r, 1, null, { border: true });
    put(ws, r, 2, CLIENT_STATUS_LABEL[s] ?? s, { border: true });
    put(ws, r, 3, cl.byStatus[s], { border: true, numFmt: FMT_INT, h: 'right' });
    put(ws, r, 4, cl.total > 0 ? cl.byStatus[s] / cl.total : 0, { border: true, numFmt: FMT_PCT, h: 'right' });
    r++;
  }
  put(ws, r, 1, null, { border: true, fill: C.section });
  put(ws, r, 2, 'Всего', { border: true, bold: true, fill: C.section });
  put(ws, r, 3, cl.total, { border: true, bold: true, numFmt: FMT_INT, h: 'right', fill: C.section });
  put(ws, r, 4, null, { border: true, fill: C.section });
  r += 2;

  // 2) Отказы по причинам (все отказавшиеся на сегодня).
  blockTitle(ws, r, 'Отказы по причинам (все клиенты в статусе «Отказался»)', LAST);
  r++;
  headerRow(ws, r, ['', 'Причина', 'Клиентов'], 20);
  r++;
  if (cl.refusedByReason.length === 0) {
    put(ws, r, 2, 'Отказавшихся клиентов нет.', { italic: true, color: C.gray });
    r++;
  }
  for (const x of cl.refusedByReason) {
    put(ws, r, 1, null, { border: true });
    put(ws, r, 2, x.label, { border: true });
    put(ws, r, 3, x.count, { border: true, numFmt: FMT_INT, h: 'right' });
    r++;
  }
  r++;

  // 3) Отказались в месяце.
  blockTitle(ws, r, `Отказались в месяце: ${cl.refusedInMonth.length}`, LAST);
  r++;
  headerRow(ws, r, ['№', 'Клиент', 'Причина', 'Дата отказа', '', 'Комментарий'], 20);
  r++;
  if (cl.refusedInMonth.length === 0) {
    put(ws, r, 2, 'В этом месяце никто не отказался.', { italic: true, color: C.gray });
    r++;
  }
  cl.refusedInMonth.forEach((x, i) => {
    put(ws, r, 1, i + 1, { border: true, h: 'center' });
    put(ws, r, 2, x.name, { border: true, wrap: true });
    put(ws, r, 3, x.reason, { border: true, wrap: true });
    put(ws, r, 4, mskWall(x.at), { border: true, numFmt: FMT_DATE, h: 'center' });
    put(ws, r, 5, null, { border: true });
    put(ws, r, 6, x.comment ?? '', { border: true, wrap: true });
    fitHeight(ws, r, [{ text: x.comment ?? '', width: widths[5] }, { text: x.name, width: widths[1] }]);
    r++;
  });
  r++;

  // 4) Новые в месяце.
  blockTitle(ws, r, `Новые клиенты в месяце: ${cl.newInMonth.length}`, LAST);
  r++;
  headerRow(ws, r, ['№', 'Клиент', 'Заведён в CRM'], 20);
  r++;
  if (cl.newInMonth.length === 0) {
    put(ws, r, 2, 'Новых клиентов в этом месяце нет.', { italic: true, color: C.gray });
    r++;
  }
  cl.newInMonth.forEach((x, i) => {
    put(ws, r, 1, i + 1, { border: true, h: 'center' });
    put(ws, r, 2, x.name, { border: true, wrap: true });
    put(ws, r, 3, mskWall(x.createdAt), { border: true, numFmt: FMT_DATE, h: 'center' });
    r++;
  });
  r++;

  // 5) Клиенты по выручке.
  const known = revKnown(k);
  blockTitle(ws, r, `Клиенты по выручке (обслужено ${cl.topClients.length}; топ-5 выделены)`, LAST);
  r++;
  headerRow(ws, r, ['№', 'Клиент', 'Нарядов выполнено', 'Выручка, ₽', 'Доля выручки', 'Пометка'], 30);
  r++;
  const unpricedBy = new Map<string, number>();
  for (const o of d.orders) {
    if (o.status === 'completed' && o.costKop === null) unpricedBy.set(o.clientId, (unpricedBy.get(o.clientId) ?? 0) + 1);
  }
  if (cl.topClients.length === 0) {
    put(ws, r, 2, 'Выполненных нарядов в месяце нет.', { italic: true, color: C.gray });
    r++;
  }
  cl.topClients.forEach((x, i) => {
    const top = i < 5;
    const base: St = { border: true, bold: top && known };
    const unpriced = unpricedBy.get(x.id) ?? 0;
    const clientKnown = unpriced < x.orders;
    put(ws, r, 1, i + 1, { ...base, h: 'center' });
    put(ws, r, 2, x.name, { ...base, wrap: true });
    put(ws, r, 3, x.orders, { ...base, numFmt: FMT_INT, h: 'right' });
    putRub(ws, r, 4, clientKnown ? x.revenueKop : null, base);
    if (known && clientKnown && k.revenueKop > 0) put(ws, r, 5, x.revenueKop / k.revenueKop, { ...base, numFmt: FMT_PCT, h: 'right' });
    else putNA(ws, r, 5, base);
    const note = unpriced > 0 ? `без цены: ${unpriced} из ${x.orders}` : '';
    put(ws, r, 6, note, { ...base, bold: false, size: 9, color: C.gray });
    r++;
  });
}

// ─── Лист «Определения» ─────────────────────────────────────────────

const GENERAL_NOTES = [
  'Источник — CRM ДезТехЮг на момент выгрузки. Месяц и все даты — по московскому времени (МСК).',
  'Деньги — ТОЛЬКО по выполненным нарядам и по дате выполнения (МСК). Это начисление по факту работ, а не оплаты, счета или суммы договоров. Запланированные и «в работе» в деньги не идут.',
  'Цены нарядов ведутся с запуска учёта (ноябрь 2026). У нарядов до этого цены могут быть пустыми — такие показатели помечены «н/д». «н/д» ≠ 0: наряд без цены не бесплатный, его стоимость просто неизвестна.',
  'MRR (ежемесячная регулярная выручка) и удержание выручки (NRR) НЕ считаются: в прайсах договоров вперемешку цена за м² и за выезд, а для NRR нужно минимум 3 месяца цен нарядов. «Регулярная выручка» здесь — фактическая выручка месяца по регулярным договорам, не контрактная.',
  '«Прошлый месяц» и «Тренд» — те же формулы за другие месяцы. Если ни у одного мастера нет ставки на конец месяца — выплаты и маржа «н/д». Пока месяц не закончился, доплата до минималки — прогноз: в выплаты и маржу не входит (минималка гарантируется за месяц целиком).',
];

const DEFINITIONS: [string, string, string][] = [
  ['Выручка', 'Σ стоимостей выполненных нарядов месяца. Стоимость наряда = Σ цен строк услуг наряда.', 'Входит: наряды со статусом «выполнен», месяц — по дате выполнения (МСК). Не входит: план / в работе; строки услуг без цены; оплаты, счета, суммы договоров. Если цены нет ни у одного наряда — «н/д».'],
  ['   регулярная', 'Выручка нарядов по договорам, где в прайсе есть позиция с периодичностью (ежемесячно, 2 раза в месяц, ежеквартально, сезон и т.п.).', '«По заявке» и пустая периодичность — разовая. Это не MRR (см. общие оговорки).'],
  ['   разовая', 'Выручка − регулярная выручка.', 'Договоры «по заявке» и без периодичности.'],
  ['Нарядов выполнено', 'Число нарядов со статусом «выполнен» с датой выполнения в месяце.', 'Наряд бригады — один наряд. Дата выполнения = отметка выполнения, иначе завершения, иначе плановая.'],
  ['Нарядов без цены', 'Выполненные наряды, у которых нет цены ни в одной строке услуг.', 'Их стоимость неизвестна (н/д), в выручку, средний чек и % мастерам не входят. Наряд с ценой у части строк считается по указанным строкам и помечен «частично».'],
  ['Средний чек', 'Выручка / число выполненных нарядов с ценой.', 'Наряды без цены в знаменатель не входят.'],
  ['Набрал по %', 'Σ по нарядам месяца: ставка мастера (на дату наряда) × ПОЛНАЯ стоимость наряда.', 'Бригада — каждому его % от полной стоимости (не делится). Ручная сумма в наряде перекрывает расчёт. Документальный наряд — 0. Наряд без цены — 0 (н/д).'],
  ['К выплате', 'max(набрал по %, минималка) по каждому мастеру.', 'Минималка — по ставке на последний день месяца; платится и при нуле нарядов (активные мастера со ставкой). Начисление, не факт выплаты.'],
  ['Выплаты мастерам', 'Σ «к выплате» по всем мастерам.', 'Включает доплаты до минималки. Мастера без ставки — 0, при отсутствии ставок у всех — «н/д».'],
  ['Доплаты до минималки', 'Σ max(0, минималка − набрал по %) по мастерам.', 'Это деньги организации сверх процента: мастер не набрал минималку.'],
  ['Валовая маржа, ₽', 'Выручка − выплаты мастерам.', 'НЕ учтены препараты, топливо, аренда, налоги, офис — это не прибыль. «н/д», если неизвестна выручка или ставки.'],
  ['Валовая маржа, %', 'Валовая маржа / выручка.', 'Только при выручке > 0.'],
  ['Маржа без документальных, %', '(Выручка − выручка документальных − выплаты мастерам) / (выручка − выручка документальных).', 'Маржа «рабочих» нарядов: документальные (мастеру 0) завышают общую маржу.'],
  ['Документальный наряд', 'Наряд с отметкой «без оплаты мастеру»: мастеру 0, вся сумма — организации.', 'шт — число выполненных документальных; ₽ — их выручка. Ручная сумма мастеру сильнее отметки.'],
  ['Выручка на мастера', 'Выручка / число мастеров, у которых был хотя бы один выполненный наряд в месяце.', 'Мастера без нарядов в знаменатель не входят.'],
  ['Доля переносов, %', 'Запросы на перенос, созданные в месяце (любой статус) / все наряды месяца (выполненные + план / в работе).', 'Учитываются запросы мастеров через CRM; переносы, сделанные менеджером напрямую, не видны.'],
  ['Одобрено переносов', 'Запросы месяца со статусом «одобрен».', '↻ на «Графике мастеров» и колонка «Переносов одобрено» — одобренные переносы наряда за всё время.'],
  ['«В назначенный день», %', 'Доля выполненных нарядов, начатых в тот же календарный день (МСК), на который были запланированы.', 'База — наряды, у которых есть и плановая дата, и отметка «Начать» (n из m). Точность по часам НЕ меряется: «Начать» мастер жмёт с опозданием (медиана +5,9 ч к плану) — сравнение по часам показывало бы опоздания, которых не было.'],
  ['Клиентов обслужено', 'Число разных клиентов с хотя бы одним выполненным нарядом в месяце.', ''],
  ['Доля топ-5 клиентов, %', 'Выручка пяти крупнейших клиентов месяца / выручка.', 'Риск концентрации: рост — плохо.'],
  ['Новые клиенты', 'Клиенты, заведённые в CRM в этом месяце (МСК).', 'Считается карточка, а не первый наряд: клиент мог быть заведён без работ.'],
  ['Отказались', 'Клиенты в статусе «Отказался» с датой отказа в месяце.', 'Клиенты, вернувшиеся из отказа, в этот список уже не попадут.'],
  ['Отток, %', 'Отказались в месяце / (активные + отказались в месяце).', 'Активные — на момент выгрузки, а не на начало месяца: при выгрузке за прошлый месяц база уже другая. «Неактивные» и «заблокированные» в отток не входят.'],
  ['Заявки', 'Заявки (лиды), созданные в месяце.', ''],
  ['Конверсия заявок, %', 'Заявки месяца, по которым создан клиент / заявки месяца.', 'Считается по месяцу создания заявки: заявки, сконвертированные позже, поднимут цифру задним числом.'],
  ['Статус-светофор', 'Сравнение с прошлым месяцем: ±5% (суммы, штуки) или ±2 п.п. (доли) — «Стабильно».', 'Абсолютные правила сильнее сравнения: нарядов без цены > 0 — всегда «Плохо», 0 — «Хорошо»; ноль отказов, оттока, переносов и доплат до минималки — «Хорошо».'],
];

function buildDefinitions(wb: ExcelJS.Workbook) {
  const ws = newSheet(wb, 'Определения', { tab: 'FF808080' });
  const widths = [30, 60, 70];
  setWidths(ws, widths);
  const LAST = widths.length;
  sheetTitle(ws, 'Определения: как считается каждая цифра', null, LAST);
  let r = 3;
  put(ws, r, 1, 'Общие правила', { bold: true, size: 12, color: C.title });
  r++;
  for (const n of GENERAL_NOTES) {
    put(ws, r, 1, `• ${n}`, { wrap: true });
    ws.mergeCells(r, 1, r, LAST);
    ws.getRow(r).height = Math.max(15, 13 * estLines(n, totalWidth(ws, LAST), 1.0) + 3);
    r++;
  }
  r++;
  headerRow(ws, r, ['Показатель', 'Как считается', 'Что входит / не входит, оговорки'], 22);
  r++;
  for (const [name, formula, scope] of DEFINITIONS) {
    put(ws, r, 1, name.trim(), { bold: true, border: true, wrap: true });
    put(ws, r, 2, formula, { border: true, wrap: true });
    put(ws, r, 3, scope, { border: true, wrap: true, color: C.navyLight });
    fitHeight(ws, r, [
      { text: formula, width: widths[1] },
      { text: scope, width: widths[2] },
    ]);
    r++;
  }
}

// ─── Сборка книги ───────────────────────────────────────────────────

export async function buildMonthlyWorkbook(report: MonthlyReport, opts: { now?: Date } = {}): Promise<Buffer> {
  const now = opts.now ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CRM ДезТехЮг';
  wb.lastModifiedBy = 'CRM ДезТехЮг';
  wb.company = 'ИП Белавина О.В. (ДезТехЮг)';
  wb.title = `Управленческая сводка за ${monthTitle(report.current.month)}`;
  wb.created = now;
  wb.modified = now;
  wb.calcProperties.fullCalcOnLoad = true;

  buildSummary(wb, report, now);
  buildTrend(wb, report);
  buildWorks(wb, report.current);
  buildSchedule(wb, report.current);
  buildReschedules(wb, report.current);
  buildPayroll(wb, report.current);
  buildClients(wb, report.current);
  buildDefinitions(wb);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as unknown as ArrayBuffer);
}
