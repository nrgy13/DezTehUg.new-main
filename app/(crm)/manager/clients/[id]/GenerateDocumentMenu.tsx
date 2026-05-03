'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { FileDown, FileText, Loader2, X } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatDateRu(d: Date): string {
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]} ${d.getFullYear()} г.`;
}

function suggestContractNumber(): string {
  // Формат: ДТЮ-DD/MM/YY-NN. Двух последних цифр (порядковый номер) пока нет
  // в БД-логике — оставляем 01 как stub. В Спринте 3 будет автоинкремент по году.
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `ДТЮ-${dd}/${mm}/${yy}-01`;
}

export function GenerateDocumentMenu({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [showContract, setShowContract] = useState(false);

  return (
    <>
      <div className="relative">
        <CyberpunkButton onClick={() => setOpen((v) => !v)} variant="primary" size="default">
          <FileDown className="w-4 h-4 mr-2" />
          Сформировать документ
        </CyberpunkButton>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-gray-200 bg-bg-primary shadow-xl z-40 py-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setShowContract(true);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-poison-green/10 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-content-muted" />
                <span>Договор</span>
              </button>
              {[
                { label: 'Доп. соглашение' },
                { label: 'Коммерческое предложение' },
                { label: 'Счёт' },
                { label: 'Акт обследования' },
                { label: 'Акт работ' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-3 py-2 text-sm text-content-muted/60 flex items-center gap-2 cursor-not-allowed"
                  title="Доступно после реализации модуля сделок (Спринт 3)"
                >
                  <FileText className="w-4 h-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-[9px] font-orbitron uppercase tracking-wider">скоро</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {showContract && (
        <ContractGenerationModal clientId={clientId} onClose={() => setShowContract(false)} />
      )}
    </>
  );
}

function ContractGenerationModal({
  clientId,
  onClose,
}: {
  clientId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const [number, setNumber] = useState(suggestContractNumber);
  const [date, setDate] = useState(formatDateRu(today));
  const [place, setPlace] = useState('г. Новороссийск');
  const [endDate, setEndDate] = useState(formatDateRu(yearEnd));

  const submit = () => {
    if (!number.trim() || !date.trim() || !place.trim() || !endDate.trim()) {
      toast.error('Заполни все поля');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'contract',
            clientId,
            contract: { number, date, place, endDate },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          toast.error(err.error ?? 'Ошибка генерации');
          return;
        }
        // Имя файла из Content-Disposition
        const cd = res.headers.get('Content-Disposition') ?? '';
        const m = cd.match(/filename\*=UTF-8''([^;]+)/);
        const filename = m ? decodeURIComponent(m[1]) : 'contract.docx';
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Договор сгенерирован, скачивание началось');
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка сети';
        toast.error(msg);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-bg-primary rounded-xl border border-gray-200 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-orbitron font-semibold tracking-wider text-content-primary uppercase">
              Договор на оказание услуг
            </h2>
            <p className="text-xs text-content-muted mt-1">
              Реквизиты заказчика тянутся из карточки клиента. Приложение № 2 (прайс) пока пустое — заполни в Word.
            </p>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <Field label="Номер договора" value={number} onChange={setNumber} disabled={isPending} />
          <Field label="Дата заключения" value={date} onChange={setDate} disabled={isPending} hint="Например: «28 января 2026 г.»" />
          <Field label="Место заключения" value={place} onChange={setPlace} disabled={isPending} />
          <Field label="Действует до" value={endDate} onChange={setEndDate} disabled={isPending} hint="Например: «31 декабря 2026 г.»" />
        </div>

        <div className="flex items-center justify-end gap-3 p-6 pt-3 border-t border-gray-100">
          <CyberpunkButton onClick={onClose} variant="ghost" size="default" disabled={isPending}>
            Отмена
          </CyberpunkButton>
          <CyberpunkButton onClick={submit} disabled={isPending} variant="primary" size="default">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Генерирую…
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Скачать DOCX
              </>
            )}
          </CyberpunkButton>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-orbitron tracking-wider text-content-secondary mb-1 uppercase">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all disabled:opacity-50"
      />
      {hint && <div className="text-[10px] text-content-muted mt-0.5">{hint}</div>}
    </div>
  );
}
