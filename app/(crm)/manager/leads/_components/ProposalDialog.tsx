'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, X, Building2, User, FileDown } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

export type ProposalItem = {
  customName: string;
  areaM2: string;
  priceNoVat: string;
  vatRate: string;
  method: string;
  frequency: string;
};

export type ProposalSubmitInput = {
  type: 'legal' | 'individual';
  shortName: string;
  email: string;
  subject: string;
  validUntil: string;
  items: ProposalItem[];
};

export function ProposalDialog({
  open,
  defaultName,
  defaultEmail,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  defaultName: string;
  defaultEmail: string;
  onClose: () => void;
  onSubmit: (input: ProposalSubmitInput) => void;
  isPending: boolean;
}) {
  const [type, setType] = useState<'legal' | 'individual'>('legal');
  const [shortName, setShortName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<ProposalItem[]>([
    { customName: '', areaM2: '0', priceNoVat: '0', vatRate: '5', method: '', frequency: 'Разово' },
  ]);

  if (!open) return null;

  function updateItem(idx: number, patch: Partial<ProposalItem>) {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((cur) => [
      ...cur,
      { customName: '', areaM2: '0', priceNoVat: '0', vatRate: '5', method: '', frequency: 'Разово' },
    ]);
  }
  function removeItem(idx: number) {
    setItems((cur) => (cur.length <= 1 ? cur : cur.filter((_, i) => i !== idx)));
  }

  const totalNet = items.reduce((s, it) => s + (Number(it.priceNoVat) || 0), 0);
  const totalGross = items.reduce(
    (s, it) =>
      s + (Number(it.priceNoVat) || 0) * (1 + (Number(it.vatRate) || 0) / 100),
    0,
  );

  function handleSubmit() {
    if (!shortName.trim()) return;
    if (!email.trim()) return;
    if (items.length === 0) return;
    if (items.some((it) => !it.customName.trim())) return;
    onSubmit({ type, shortName: shortName.trim(), email: email.trim(), subject, validUntil, items });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-xl border border-gray-200 shadow-2xl w-full max-w-3xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-orbitron font-semibold tracking-wider text-content-primary uppercase">
              Сформировать и отправить КП
            </h2>
            <p className="text-xs text-content-muted mt-1">
              Создаст клиента-черновик, draft-сделку с прайсом, сгенерирует DOCX и отправит на email.
              Реквизиты ИНН/КПП можно дозаполнить когда подпишут договор.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-content-muted hover:text-content-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Тип клиента */}
          <div>
            <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
              Тип клиента
            </label>
            <div className="grid grid-cols-2 gap-2">
              <TypeButton
                active={type === 'legal'}
                onClick={() => setType('legal')}
                disabled={isPending}
                icon={<Building2 className="w-4 h-4" />}
                label="Юрлицо/ИП"
              />
              <TypeButton
                active={type === 'individual'}
                onClick={() => setType('individual')}
                disabled={isPending}
                icon={<User className="w-4 h-4" />}
                label="Физлицо"
              />
            </div>
          </div>

          {/* Имя и email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
                Название
              </label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder={type === 'legal' ? 'ООО «...»' : 'Иванов И.И.'}
                disabled={isPending}
                autoFocus
                className="h-10 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
                Email клиента
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                disabled={isPending}
                required
                className="h-10 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
              />
            </div>
          </div>

          {/* Тема и срок */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
                Тема письма (опц.)
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Auto: «Коммерческое предложение ... от ДезТехЮг»"
                disabled={isPending}
                className="h-10 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
                КП действует до
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={isPending}
                className="h-10 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
              />
            </div>
          </div>

          {/* Прайс-позиции */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-orbitron tracking-wider text-content-secondary uppercase">
                Прайс-позиции ({items.length})
              </label>
              <button
                type="button"
                onClick={addItem}
                disabled={isPending}
                className="text-xs text-poison-green hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Добавить
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-end p-2 border border-gray-200 rounded-lg"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <label className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
                      Услуга
                    </label>
                    <input
                      type="text"
                      value={it.customName}
                      onChange={(e) => updateItem(idx, { customName: e.target.value })}
                      placeholder="Дезинсекция кухни"
                      disabled={isPending}
                      className="h-8 w-full mt-0.5 rounded bg-bg-primary px-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
                      м²
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={it.areaM2}
                      onChange={(e) => updateItem(idx, { areaM2: e.target.value })}
                      disabled={isPending}
                      className="h-8 w-full mt-0.5 rounded bg-bg-primary px-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
                      Способ
                    </label>
                    <input
                      type="text"
                      value={it.method}
                      onChange={(e) => updateItem(idx, { method: e.target.value })}
                      placeholder="Туман"
                      disabled={isPending}
                      className="h-8 w-full mt-0.5 rounded bg-bg-primary px-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
                      Цена без НДС, ₽
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.priceNoVat}
                      onChange={(e) => updateItem(idx, { priceNoVat: e.target.value })}
                      disabled={isPending}
                      className="h-8 w-full mt-0.5 rounded bg-bg-primary px-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase font-orbitron tracking-wider text-content-muted">
                      НДС%
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={it.vatRate}
                      onChange={(e) => updateItem(idx, { vatRate: e.target.value })}
                      disabled={isPending}
                      className="h-8 w-full mt-0.5 rounded bg-bg-primary px-2 text-sm border border-gray-200 focus:border-poison-green focus:outline-none"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={isPending || items.length <= 1}
                      className="p-1.5 text-red-400 hover:text-red-600 disabled:opacity-30"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="mt-3 flex justify-end gap-6 text-sm border-t border-gray-100 pt-2">
                <div>
                  <span className="text-xs text-content-muted">Без НДС: </span>
                  <span className="font-mono text-content-secondary">{fmt(totalNet)} ₽</span>
                </div>
                <div>
                  <span className="text-xs text-content-muted">С НДС: </span>
                  <span className="font-mono font-bold text-content-primary">{fmt(totalGross)} ₽</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-6 pt-3 border-t border-gray-100">
          <p className="text-[10px] text-content-muted flex-1">
            Email уйдёт через текущий MAILER_TRANSPORT (dev: MailHog · prod: noop пока нет SMTP).
          </p>
          <div className="flex gap-2">
            <CyberpunkButton onClick={onClose} variant="ghost" size="default" disabled={isPending}>
              Отмена
            </CyberpunkButton>
            <CyberpunkButton onClick={handleSubmit} variant="primary" size="default" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Отправляю…
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 mr-2" />
                  Сгенерировать и отправить
                </>
              )}
            </CyberpunkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeButton({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm ${
        active
          ? 'border-neon-orange bg-neon-orange/5 text-neon-orange'
          : 'border-gray-200 text-content-secondary hover:border-poison-green'
      } disabled:opacity-50`}
    >
      {icon}
      <span className="font-orbitron uppercase tracking-wider text-xs">{label}</span>
    </button>
  );
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(n);
}
