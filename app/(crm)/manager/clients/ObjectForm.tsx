'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Loader2, Plus, X } from 'lucide-react';

import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { TREATMENT_METHODS, TREATMENT_FREQUENCIES } from '@/lib/constants/treatment';
import { UNIT_OPTIONS } from '@/lib/constants/units';
import { clientObjectSchema } from './schemas';
import { addObject, updateObject, createObjectForDeal } from './actions';
import type { ClientObject } from '@/lib/db/schema/objects';

type FormValues = z.infer<typeof clientObjectSchema>;

type ServiceOption = { id: string; name: string };
type InitialService = {
  serviceId: string | null;
  customName: string | null;
  method: string | null;
  unit: string | null;
  quantity: string | null;
  frequency: string | null;
};

// dealId — если задан в режиме create, объект создаётся привязанным к договору
// (createObjectForDeal). redirectTo — куда вернуться после сохранения.
type Props =
  | {
      mode: 'create';
      clientId: string;
      services: ServiceOption[];
      dealId?: string;
      redirectTo?: string;
      initial?: undefined;
      initialServices?: undefined;
    }
  | {
      mode: 'edit';
      clientId: string;
      services: ServiceOption[];
      dealId?: string;
      redirectTo?: string;
      initial: ClientObject;
      initialServices: InitialService[];
    };

const selectClass =
  'w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all';

export function ObjectForm({
  mode,
  clientId,
  services,
  dealId,
  redirectTo,
  initial,
  initialServices,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const backHref = redirectTo ?? `/manager/clients/${clientId}?tab=objects`;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(clientObjectSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          address: initial.address,
          areaM2: initial.areaM2 != null ? Number(initial.areaM2) : undefined,
          objectType: initial.objectType ?? undefined,
          contactPerson: initial.contactPerson ?? undefined,
          contactPhone: initial.contactPhone ?? undefined,
          plannedTreatmentDate: initial.plannedTreatmentDate ?? undefined,
          notes: initial.notes ?? undefined,
          services: (initialServices ?? []).map((s) => ({
            serviceId: s.serviceId ?? undefined,
            customName: s.customName ?? undefined,
            method: s.method ?? undefined,
            unit: (s.unit as 'm2' | 'pcs' | 'm3') ?? 'm2',
            quantity: s.quantity != null ? Number(s.quantity) : undefined,
            frequency: s.frequency ?? undefined,
          })),
        }
      : { services: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'services' });
  const watchedServices = watch('services');

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? dealId
            ? await createObjectForDeal(dealId, values)
            : await addObject(clientId, values)
          : await updateObject(initial!.id, values);
      if (!result.ok) {
        if (result.field) {
          setError(result.field as keyof FormValues, { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(mode === 'create' ? 'Объект добавлен' : 'Объект обновлён');
      router.push(backHref);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <h2 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase mb-4 pb-2 border-b border-gray-200">
          Данные объекта
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Название объекта *" error={errors.name?.message} hint="Столовая «Эллада»">
            <NeonInput {...register('name')} placeholder="Столовая «Эллада»" />
          </Field>
          <Field label="Тип" error={errors.objectType?.message} hint="столовая, склад, офис...">
            <NeonInput {...register('objectType')} placeholder="столовая" />
          </Field>
          <Field label="Адрес *" error={errors.address?.message} className="md:col-span-2">
            <NeonInput {...register('address')} placeholder="г. Анапа, ул. Гребенская, 5" />
          </Field>
          <Field label="Площадь, м²" error={errors.areaM2?.message} hint="напр. 7,7">
            <NeonInput
              {...register('areaM2', {
                setValueAs: (v) =>
                  v === '' || v == null ? undefined : Number(String(v).replace(',', '.')),
              })}
              type="text"
              inputMode="decimal"
              placeholder="120"
            />
          </Field>
          <Field
            label="Плановая дата обработки"
            error={errors.plannedTreatmentDate?.message}
            hint="на её основе формируются заявки мастерам"
          >
            <NeonInput {...register('plannedTreatmentDate')} type="date" />
          </Field>
          <Field label="Контактное лицо" error={errors.contactPerson?.message}>
            <NeonInput {...register('contactPerson')} placeholder="Сидорова О.А., администратор" />
          </Field>
          <Field label="Контактный телефон" error={errors.contactPhone?.message}>
            <NeonInput {...register('contactPhone')} placeholder="+7 (988) ...-..-.." />
          </Field>
          <Field label="Заметки" error={errors.notes?.message} className="md:col-span-2">
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Особенности доступа, расписание и пр."
              className="w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-poison-green focus:ring-2 focus:ring-poison-green/20 focus:outline-none transition-all"
            />
          </Field>
        </div>
      </CyberpunkCard>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
          <h2 className="text-sm font-orbitron font-semibold tracking-wider text-content-primary uppercase">
            Услуги объекта
          </h2>
          <button
            type="button"
            onClick={() =>
              append({
                serviceId: undefined,
                customName: undefined,
                method: undefined,
                unit: 'm2',
                quantity: undefined,
                frequency: undefined,
              })
            }
            className="inline-flex items-center gap-1 text-xs font-orbitron uppercase tracking-wider text-poison-green hover:text-neon-orange transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-content-muted">
            Услуги не заданы. Можно добавить несколько услуг — у каждой свой способ обработки.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((f, i) => {
              const isCustom = !watchedServices?.[i]?.serviceId;
              return (
                <div
                  key={f.id}
                  className="grid grid-cols-1 sm:grid-cols-[1.3fr_1.1fr_1.1fr_0.7fr_0.7fr_auto] gap-2 items-start"
                >
                  <div className="space-y-2">
                    <select {...register(`services.${i}.serviceId` as const)} className={selectClass}>
                      <option value="">— произвольная услуга —</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {isCustom && (
                      <NeonInput
                        {...register(`services.${i}.customName` as const)}
                        placeholder="Название услуги"
                      />
                    )}
                  </div>
                  <select {...register(`services.${i}.method` as const)} className={selectClass}>
                    <option value="">— способ обработки —</option>
                    {TREATMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    {...register(`services.${i}.frequency` as const)}
                    className={selectClass}
                    aria-label="Периодичность"
                  >
                    <option value="">— периодичность —</option>
                    {TREATMENT_FREQUENCIES.map((fq) => (
                      <option key={fq} value={fq}>
                        {fq}
                      </option>
                    ))}
                  </select>
                  <NeonInput
                    {...register(`services.${i}.quantity` as const, {
                      setValueAs: (v) =>
                        v === '' || v == null ? undefined : Number(String(v).replace(',', '.')),
                    })}
                    type="text"
                    inputMode="decimal"
                    placeholder="Кол-во"
                    aria-label="Количество"
                  />
                  <select
                    {...register(`services.${i}.unit` as const)}
                    className={selectClass}
                    aria-label="Единица измерения"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="p-2 text-content-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Убрать услугу"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CyberpunkCard>

      <div className="flex items-center gap-3">
        <CyberpunkButton type="submit" disabled={isPending} variant="primary">
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Сохраняю…
            </>
          ) : mode === 'create' ? (
            'Добавить объект'
          ) : (
            'Сохранить'
          )}
        </CyberpunkButton>
        <CyberpunkButton href={backHref} variant="ghost">
          Отмена
        </CyberpunkButton>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
  className = '',
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      {!error && hint && <p className="text-xs text-content-muted mt-1">{hint}</p>}
    </div>
  );
}
