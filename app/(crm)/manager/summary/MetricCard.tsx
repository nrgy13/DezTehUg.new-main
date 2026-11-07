import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { TONE_CLASSES, TONE_LABEL, type Metric, type Tone } from './format';

const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = {
  good: CheckCircle2,
  warn: AlertCircle,
  bad: AlertTriangle,
  na: HelpCircle,
  neutral: Info,
};

const TONE_ICON_COLOR: Record<Tone, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-500',
  bad: 'text-red-500',
  na: 'text-gray-400',
  neutral: 'text-gray-400',
};

/** Δ к прошлому месяцу: зелёный — улучшение, красный — ухудшение, серый — справочно. */
export function DeltaBadge({ delta, good }: { delta: string | null; good: boolean | null }) {
  if (!delta) return <span className="text-content-muted">Δ —</span>;
  const arrow = delta.startsWith('+') ? '▲' : delta.startsWith('−') ? '▼' : '■';
  const color = good === true ? 'text-emerald-700' : good === false ? 'text-red-600' : 'text-content-muted';
  return (
    <span className={`font-medium tabular-nums whitespace-nowrap ${color}`}>
      <span aria-hidden className="text-[9px] mr-0.5">
        {arrow}
      </span>
      {delta}
    </span>
  );
}

/** Светофор: иконка + цвет (не только цвет — для дальтоников и печати), подпись в title/sr-only. */
export function ToneIcon({ tone, className = 'w-4 h-4' }: { tone: Tone; className?: string }) {
  const Icon = TONE_ICON[tone];
  return (
    <span title={TONE_LABEL[tone]} className="inline-flex flex-shrink-0">
      <Icon className={`${className} ${TONE_ICON_COLOR[tone]}`} />
      <span className="sr-only">{TONE_LABEL[tone]}</span>
    </span>
  );
}

/** KPI-карточка: значение, прошлый месяц, Δ, светофор (полоска слева + иконка), пометка о неполноте. */
export function MetricCard({ m }: { m: Metric }) {
  const t = TONE_CLASSES[m.tone];
  const isNa = m.value === 'н/д';
  return (
    <CyberpunkCard
      variant="default"
      hoverEffect={false}
      className={`p-4 h-full border-l-4 ${t.bar}`}
      title={m.hint}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-orbitron tracking-wider text-content-muted uppercase leading-tight">
          {m.label}
        </span>
        <ToneIcon tone={m.tone} />
      </div>
      <div
        className={`text-xl font-orbitron font-bold tabular-nums break-words ${
          isNa ? 'text-content-muted' : 'text-content-primary'
        }`}
      >
        {m.value}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        {m.prevLabel ? null : <DeltaBadge delta={m.delta} good={m.deltaGood} />}
        <span className="text-content-muted">
          {m.prevLabel ?? 'было'} {m.prevValue}
        </span>
      </div>
      {m.sub && <div className="text-[11px] text-content-secondary mt-1.5 leading-snug">{m.sub}</div>}
      {m.incomplete && (
        <div className="mt-2 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {m.incomplete}
        </div>
      )}
    </CyberpunkCard>
  );
}
