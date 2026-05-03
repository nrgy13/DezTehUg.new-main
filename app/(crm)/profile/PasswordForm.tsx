'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock, AlertTriangle } from 'lucide-react';

import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { changePassword } from './actions';

const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль'),
    newPassword: z.string().min(8, 'Минимум 8 символов').max(128),
    confirmPassword: z.string().min(1, 'Подтвердите пароль'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'Новый пароль должен отличаться от текущего',
    path: ['newPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

type Props = {
  userRole: 'admin' | 'manager' | 'master';
  mustChange: boolean;
};

const labelClass =
  'block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase';

export function PasswordForm({ userRole, mustChange }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [isPending, startTransition] = useTransition();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await changePassword(values);

      if (!result.ok) {
        if (result.field) {
          setError(result.field, { message: result.error });
        } else {
          toast.error(result.error);
        }
        return;
      }

      toast.success('Пароль изменён');
      await update({ passwordMustChange: false });

      const target =
        userRole === 'admin' ? '/admin' : userRole === 'manager' ? '/manager' : '/master';

      router.push(target);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {mustChange && (
        <div className="flex items-start gap-3 rounded-lg border border-neon-orange/40 bg-neon-orange/5 p-4 text-sm text-content-primary">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-neon-orange" />
          <div>
            <strong className="block mb-1 font-orbitron uppercase tracking-wider text-neon-orange">
              Требуется смена пароля
            </strong>
            <span className="text-content-secondary">
              Вы используете временный пароль. Перед началом работы установите новый — минимум 8
              символов.
            </span>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className={labelClass}>
          Текущий пароль
        </label>
        <div className="relative">
          <NeonInput
            id="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={isPending}
            icon={<Lock className="w-4 h-4" />}
            {...register('currentPassword')}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-poison-green transition-colors"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.currentPassword && (
          <p className="text-xs text-red-600 mt-1.5">{errors.currentPassword.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="newPassword" className={labelClass}>
          Новый пароль
        </label>
        <div className="relative">
          <NeonInput
            id="newPassword"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={isPending}
            icon={<Lock className="w-4 h-4" />}
            {...register('newPassword')}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-poison-green transition-colors"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-xs text-red-600 mt-1.5">{errors.newPassword.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Повторите новый пароль
        </label>
        <NeonInput
          id="confirmPassword"
          type={showNew ? 'text' : 'password'}
          autoComplete="new-password"
          disabled={isPending}
          icon={<Lock className="w-4 h-4" />}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-600 mt-1.5">{errors.confirmPassword.message}</p>
        )}
      </div>

      <CyberpunkButton type="submit" disabled={isPending} variant="primary" size="default" className="w-full">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Сохраняю…
          </>
        ) : (
          'Сменить пароль'
        )}
      </CyberpunkButton>
    </form>
  );
}
