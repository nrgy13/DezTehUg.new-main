'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Loader2 } from 'lucide-react';

import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { clientObjectSchema } from './schemas';
import { addObject, updateObject } from './actions';
import type { ClientObject } from '@/lib/db/schema/objects';

type FormValues = z.infer<typeof clientObjectSchema>;

type Props =
  | { mode: 'create'; clientId: string; initial?: undefined }
  | { mode: 'edit'; clientId: string; initial: ClientObject };

export function ObjectForm({ mode, clientId, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(clientObjectSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          address: initial.address,
          areaM2: initial.areaM2 ?? undefined,
          objectType: initial.objectType ?? undefined,
          contactPerson: initial.contactPerson ?? undefined,
          contactPhone: initial.contactPhone ?? undefined,
          notes: initial.notes ?? undefined,
        }
      : {},
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await addObject(clientId, values)
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
      router.push(`/manager/clients/${clientId}?tab=objects`);
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
          <Field label="Площадь, м²" error={errors.areaM2?.message} hint="число">
            <NeonInput
              {...register('areaM2', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
              type="number"
              inputMode="numeric"
              placeholder="120"
            />
          </Field>
          <div />
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
        <CyberpunkButton
          href={`/manager/clients/${clientId}?tab=objects`}
          variant="ghost"
        >
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
