'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, Phone, User, MapPin, Mail } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { createLeadManually } from '../actions';

const SERVICES: { code: string; label: string }[] = [
  { code: 'disinsection', label: 'Дезинсекция' },
  { code: 'deratization', label: 'Дератизация' },
  { code: 'disinfection', label: 'Дезинфекция' },
  { code: 'fumigation', label: 'Фумигация' },
  { code: 'deodorization', label: 'Дезодорация' },
  { code: 'deserpentation', label: 'Десерпентация' },
  { code: 'herbicide-treatment', label: 'Гербицидная обработка' },
  { code: 'water-analysis', label: 'Анализ воды' },
];

const SOURCE_LABELS: Record<string, string> = {
  phone: 'Звонок',
  manager: 'Менеджер сам',
  referral: 'Рекомендация',
};

export function NewLeadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [requestedAddress, setRequestedAddress] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<'phone' | 'manager' | 'referral'>('phone');
  const [services, setServices] = useState<string[]>([]);
  const [takeImmediately, setTakeImmediately] = useState(true);

  const toggleService = (code: string) => {
    setServices((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]
    );
  };

  const submit = () => {
    if (!contactPhone.trim()) {
      toast.error('Телефон обязателен');
      return;
    }
    const areaNum = areaM2.trim() ? Number(areaM2.trim()) : undefined;
    if (areaM2.trim() && (isNaN(areaNum!) || areaNum! <= 0)) {
      toast.error('Площадь должна быть положительным числом');
      return;
    }

    startTransition(async () => {
      const res = await createLeadManually({
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim() || undefined,
        requestedAddress: requestedAddress.trim() || undefined,
        areaM2Estimate: areaNum,
        message: message.trim() || undefined,
        source,
        serviceTypes: services.length > 0 ? services : undefined,
        takeImmediately,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(takeImmediately ? 'Заявка создана и взята в работу' : 'Заявка создана');
      onClose();
      router.refresh();
      // Если хотим сразу перейти на карточку — раскомментировать:
      // router.push(`/manager/leads/${res.data.leadId}`);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-orbitron font-semibold tracking-wider text-content-primary uppercase">
              Новая заявка
            </h2>
            <p className="text-xs text-content-muted mt-1">
              Занеси клиента в воронку. Минимум — телефон. Реквизиты и адреса можно дозаполнить потом в карточке.
            </p>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Имя + Телефон */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label icon={<User className="w-3 h-3" />}>Имя / Название</Label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Иванов И.И. или ООО «...»"
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <Label icon={<Phone className="w-3 h-3" />} required>
                Телефон
              </Label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
                disabled={isPending}
                autoFocus
                required
                className={inputCls}
              />
            </div>
          </div>

          {/* Email + Адрес */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label icon={<Mail className="w-3 h-3" />}>Email</Label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="ivan@example.ru"
                disabled={isPending}
                className={inputCls}
              />
            </div>
            <div>
              <Label icon={<MapPin className="w-3 h-3" />}>Адрес объекта</Label>
              <input
                type="text"
                value={requestedAddress}
                onChange={(e) => setRequestedAddress(e.target.value)}
                placeholder="г. Краснодар, ул. ..."
                disabled={isPending}
                className={inputCls}
              />
            </div>
          </div>

          {/* Услуги */}
          <div>
            <Label>Услуги</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {SERVICES.map((s) => {
                const checked = services.includes(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => toggleService(s.code)}
                    disabled={isPending}
                    className={`text-[11px] px-2 py-1.5 rounded-md border-2 transition-all text-left ${
                      checked
                        ? 'border-poison-green bg-poison-green/10 text-poison-green'
                        : 'border-gray-200 text-content-secondary hover:border-poison-green/50'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Площадь + Источник */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Площадь, м²</Label>
              <input
                type="number"
                inputMode="numeric"
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                placeholder="например, 120"
                disabled={isPending}
                min={1}
                className={inputCls}
              />
            </div>
            <div>
              <Label>Источник</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['phone', 'manager', 'referral'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    disabled={isPending}
                    className={`text-[11px] py-1.5 rounded-md border-2 transition-all ${
                      source === s
                        ? 'border-neon-orange bg-neon-orange/10 text-neon-orange'
                        : 'border-gray-200 text-content-secondary hover:border-neon-orange/40'
                    }`}
                  >
                    {SOURCE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Заметка */}
          <div>
            <Label>Заметка / о чём говорили</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Что хочет клиент, особые условия, на что обратить внимание…"
              rows={3}
              disabled={isPending}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Take immediately checkbox */}
          <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={takeImmediately}
              onChange={(e) => setTakeImmediately(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 rounded border-gray-300 text-poison-green focus:ring-poison-green/40"
            />
            <span>
              Сразу взять себе в работу
              <span className="text-xs text-content-muted ml-1">
                (статус «Связались», менеджер — я)
              </span>
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-3 border-t border-gray-100">
          <CyberpunkButton onClick={onClose} variant="ghost" size="default" disabled={isPending}>
            Отмена
          </CyberpunkButton>
          <CyberpunkButton
            onClick={submit}
            disabled={isPending || !contactPhone.trim()}
            variant="primary"
            size="default"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Создаю…
              </>
            ) : (
              'Создать заявку'
            )}
          </CyberpunkButton>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'h-10 w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all disabled:opacity-50';

function Label({
  children,
  icon,
  required,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] font-orbitron tracking-wider text-content-secondary mb-1 uppercase">
      {icon}
      {children}
      {required && <span className="text-neon-orange">*</span>}
    </label>
  );
}
