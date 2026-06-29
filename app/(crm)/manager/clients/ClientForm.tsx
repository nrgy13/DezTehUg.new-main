'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Loader2, Building2, User, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { clientFormSchema } from './schemas';
import { createClient, updateClient } from './actions';
import type { Client } from '@/lib/db/schema/clients';

type ClientFormValues = z.infer<typeof clientFormSchema>;

type Props =
  | { mode: 'create'; initial?: undefined }
  | { mode: 'edit'; initial: Client };

export function ClientForm({ mode, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const defaultValues: Partial<ClientFormValues> = initial
    ? {
        type: initial.type,
        shortName: initial.shortName,
        fullName: initial.fullName ?? undefined,
        phone: initial.phone ?? undefined,
        email: initial.email ?? undefined,
        legalAddress: initial.legalAddress ?? undefined,
        postalAddress: initial.postalAddress ?? undefined,
        notes: initial.notes ?? undefined,
        source: initial.source,
        status: initial.status,
        category: initial.category,
        assignedManagerId: initial.assignedManagerId ?? undefined,
        inn: initial.inn ?? undefined,
        ...(initial.type === 'legal'
          ? {
              kpp: initial.kpp ?? '',
              ogrn: initial.ogrn ?? undefined,
              directorName: initial.directorName ?? undefined,
              directorRole: initial.directorRole ?? undefined,
              actingBasis: initial.actingBasis ?? undefined,
              bankName: initial.bankName ?? undefined,
              bankBik: initial.bankBik ?? undefined,
              bankAccount: initial.bankAccount ?? undefined,
              bankCorrAccount: initial.bankCorrAccount ?? undefined,
            }
          : {}),
      }
    : {
        type: 'legal',
        source: 'manager',
        status: 'lead',
        category: 'new',
      };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
    setValue,
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaultValues as ClientFormValues,
    mode: 'onBlur',
  });

  const type = watch('type');

  const onSubmit = (values: ClientFormValues) => {
    startTransition(async () => {
      setDuplicateId(null);

      if (mode === 'create') {
        const result = await createClient(values);
        if (!result.ok) {
          if (result.field) setError(result.field as keyof ClientFormValues, { message: result.error });
          else toast.error(result.error);
          if (result.existingClientId) setDuplicateId(result.existingClientId);
          return;
        }
        toast.success('Клиент создан');
        router.push(`/manager/clients/${result.data.id}`);
        router.refresh();
        return;
      }

      // edit
      const result = await updateClient(initial!.id, values);
      if (!result.ok) {
        if (result.field) setError(result.field as keyof ClientFormValues, { message: result.error });
        else toast.error(result.error);
        if (result.existingClientId) setDuplicateId(result.existingClientId);
        return;
      }
      toast.success('Клиент обновлён');
      router.push(`/manager/clients/${initial!.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Тип клиента */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <SectionTitle>Тип клиента</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <TypeOption
            active={type === 'legal'}
            icon={Building2}
            label="Юрлицо / ИП"
            hint="ООО, ОАО, ИП и т.п."
            onClick={() => setValue('type', 'legal', { shouldValidate: false })}
          />
          <TypeOption
            active={type === 'individual'}
            icon={User}
            label="Физлицо"
            hint="Частный заказчик"
            onClick={() => setValue('type', 'individual', { shouldValidate: false })}
          />
        </div>
      </CyberpunkCard>

      {/* Общие данные */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <SectionTitle>Основное</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={type === 'legal' ? 'Краткое название *' : 'ФИО (кратко) *'}
            error={errors.shortName?.message}
            hint={type === 'legal' ? 'ООО «Аппетит»' : 'Иванов И.И.'}
          >
            <NeonInput
              {...register('shortName')}
              placeholder={type === 'legal' ? 'ООО «Аппетит»' : 'Иванов И.И.'}
            />
          </Field>
          <Field
            label={type === 'legal' ? 'Полное наименование' : 'Полное ФИО'}
            error={errors.fullName?.message}
          >
            <NeonInput
              {...register('fullName')}
              placeholder={type === 'legal' ? 'Общество с ограниченной ответственностью «Аппетит»' : 'Иванов Иван Иванович'}
            />
          </Field>
          <Field label="Телефон" error={errors.phone?.message}>
            <NeonInput {...register('phone')} placeholder="+7 (988) 333-22-11" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <NeonInput {...register('email')} placeholder="info@example.com" />
          </Field>
        </div>
      </CyberpunkCard>

      {/* Реквизиты юрлица */}
      {type === 'legal' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <SectionTitle>Реквизиты юрлица</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="ИНН *"
              error={errors.inn?.message}
              hint="10 цифр, проверка ФНС"
              extra={
                duplicateId && (
                  <Link
                    href={`/manager/clients/${duplicateId}`}
                    className="text-xs text-neon-orange hover:text-poison-green inline-flex items-center gap-1 mt-1"
                  >
                    Открыть существующего клиента
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )
              }
            >
              <NeonInput
                {...register('inn')}
                placeholder="2308175123"
                inputMode="numeric"
                maxLength={10}
              />
            </Field>
            <Field label="КПП *" error={(errors as Record<string, { message?: string }>).kpp?.message} hint="9 символов">
              <NeonInput
                {...register('kpp' as never)}
                placeholder="230801001"
                maxLength={9}
              />
            </Field>
            <Field
              label="ОГРН/ОГРНИП"
              error={(errors as Record<string, { message?: string }>).ogrn?.message}
              hint="13 цифр (юрлицо) / 15 цифр (ИП)"
            >
              <NeonInput
                {...register('ogrn' as never)}
                placeholder="1022300000000"
                inputMode="numeric"
                maxLength={15}
              />
            </Field>
            <div /> {/* отступ */}
            <Field label="Юридический адрес" error={errors.legalAddress?.message} className="md:col-span-2">
              <NeonInput
                {...register('legalAddress')}
                placeholder="350000, Краснодарский край, г. Краснодар, ул. ..."
              />
            </Field>
            <Field label="Почтовый адрес" error={errors.postalAddress?.message} className="md:col-span-2">
              <NeonInput
                {...register('postalAddress')}
                placeholder="Если совпадает с юридическим — оставьте пустым"
              />
            </Field>
          </div>
        </CyberpunkCard>
      )}

      {/* Реквизиты физлица */}
      {type === 'individual' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <SectionTitle>Реквизиты физлица</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="ИНН"
              error={errors.inn?.message}
              hint="12 цифр, опционально"
              extra={
                duplicateId && (
                  <Link
                    href={`/manager/clients/${duplicateId}`}
                    className="text-xs text-neon-orange hover:text-poison-green inline-flex items-center gap-1 mt-1"
                  >
                    Открыть существующего клиента
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )
              }
            >
              <NeonInput
                {...register('inn')}
                placeholder="231507022304"
                inputMode="numeric"
                maxLength={12}
              />
            </Field>
            <div />
            <Field label="Адрес" error={errors.legalAddress?.message} className="md:col-span-2">
              <NeonInput
                {...register('legalAddress')}
                placeholder="г. Новороссийск, ул. ..."
              />
            </Field>
          </div>
        </CyberpunkCard>
      )}

      {/* Подписант (только юрлицо) */}
      {type === 'legal' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <SectionTitle>Подписант (для договоров)</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="ФИО подписанта"
              error={(errors as Record<string, { message?: string }>).directorName?.message}
            >
              <NeonInput
                {...register('directorName' as never)}
                placeholder="Мороз Анна Евгеньевна"
              />
            </Field>
            <Field
              label="Должность"
              error={(errors as Record<string, { message?: string }>).directorRole?.message}
            >
              <NeonInput
                {...register('directorRole' as never)}
                placeholder="Генеральный директор"
              />
            </Field>
            <Field
              label="Действует на основании"
              error={(errors as Record<string, { message?: string }>).actingBasis?.message}
              className="md:col-span-2"
            >
              <NeonInput
                {...register('actingBasis' as never)}
                placeholder="Устава"
              />
            </Field>
          </div>
        </CyberpunkCard>
      )}

      {/* Банковские реквизиты (только юрлицо) */}
      {type === 'legal' && (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
          <SectionTitle>Банковские реквизиты</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Наименование банка"
              error={(errors as Record<string, { message?: string }>).bankName?.message}
              className="md:col-span-2"
            >
              <NeonInput
                {...register('bankName' as never)}
                placeholder="Краснодарское отделение №8619 ПАО Сбербанк"
              />
            </Field>
            <Field
              label="БИК"
              error={(errors as Record<string, { message?: string }>).bankBik?.message}
              hint="9 цифр"
            >
              <NeonInput
                {...register('bankBik' as never)}
                placeholder="040349602"
                inputMode="numeric"
                maxLength={9}
              />
            </Field>
            <Field
              label="Корсчёт"
              error={(errors as Record<string, { message?: string }>).bankCorrAccount?.message}
              hint="20 цифр, начинается на 301"
            >
              <NeonInput
                {...register('bankCorrAccount' as never)}
                placeholder="30101810100000000602"
                inputMode="numeric"
                maxLength={20}
              />
            </Field>
            <Field
              label="Расчётный счёт"
              error={(errors as Record<string, { message?: string }>).bankAccount?.message}
              hint="20 цифр"
              className="md:col-span-2"
            >
              <NeonInput
                {...register('bankAccount' as never)}
                placeholder="40802810330000166200"
                inputMode="numeric"
                maxLength={20}
              />
            </Field>
          </div>
        </CyberpunkCard>
      )}

      {/* Метаданные */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <SectionTitle>CRM-метаданные</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Источник" error={errors.source?.message}>
            <select
              {...register('source')}
              className="h-11 w-full rounded-md bg-bg-primary px-3 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none"
            >
              <option value="manager">Завёл менеджер</option>
              <option value="website">Сайт</option>
              <option value="phone">Звонок</option>
              <option value="recurring">Постоянный клиент</option>
              <option value="referral">Рекомендация</option>
              <option value="other">Другое</option>
            </select>
          </Field>
          <Field label="Статус" error={errors.status?.message}>
            <select
              {...register('status')}
              className="h-11 w-full rounded-md bg-bg-primary px-3 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none"
            >
              <option value="lead">Лид</option>
              <option value="active">Активный</option>
              <option value="inactive">Неактивный</option>
              <option value="blocked">Заблокирован</option>
            </select>
          </Field>
          <Field label="Категория" error={errors.category?.message} className="md:col-span-2">
            <select
              {...register('category')}
              className="h-11 w-full rounded-md bg-bg-primary px-3 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none"
            >
              <option value="new">Новый</option>
              <option value="old">Старый</option>
              <option value="permanent">Постоянный</option>
              <option value="tender">Тендер</option>
            </select>
          </Field>
          <Field label="Заметки менеджера" error={errors.notes?.message} className="md:col-span-2">
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Любая полезная информация"
              className="w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all"
            />
          </Field>
        </div>
      </CyberpunkCard>

      <div className="flex items-center gap-3">
        <CyberpunkButton type="submit" disabled={isPending} variant="primary" size="default">
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохраняю…
            </>
          ) : mode === 'create' ? (
            'Создать клиента'
          ) : (
            'Сохранить изменения'
          )}
        </CyberpunkButton>
        <CyberpunkButton
          href={mode === 'edit' ? `/manager/clients/${initial!.id}` : '/manager/clients'}
          variant="ghost"
          size="default"
        >
          Отмена
        </CyberpunkButton>
      </div>
    </form>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-4 pb-2 border-b border-gray-200">
      {children}
    </h2>
  );
}

function Field({
  label,
  error,
  hint,
  children,
  className = '',
  extra,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      {!error && hint && <p className="text-xs text-content-muted mt-1">{hint}</p>}
      {extra}
    </div>
  );
}

function TypeOption({
  active,
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all duration-200 text-left ${
        active
          ? 'border-neon-orange bg-neon-orange/5'
          : 'border-gray-200 hover:border-poison-green hover:bg-poison-green/5'
      }`}
    >
      <Icon
        className={`w-6 h-6 flex-shrink-0 ${active ? 'text-neon-orange' : 'text-content-muted'}`}
      />
      <div>
        <div
          className={`font-orbitron font-semibold uppercase tracking-wider text-sm ${
            active ? 'text-neon-orange' : 'text-content-primary'
          }`}
        >
          {label}
        </div>
        <div className="text-xs text-content-muted mt-0.5">{hint}</div>
      </div>
    </button>
  );
}
