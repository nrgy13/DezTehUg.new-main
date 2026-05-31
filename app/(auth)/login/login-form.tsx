'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { Loader2, AlertCircle, Mail, Lock } from 'lucide-react';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';

const ERRORS: Record<string, string> = {
  CredentialsSignin: 'Неверный email или пароль',
  forbidden: 'Доступ запрещён для вашей роли',
  default: 'Не удалось войти. Попробуй ещё раз.',
};

export function LoginForm({
  initialError,
  callbackUrl,
}: {
  initialError?: string;
  callbackUrl?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    initialError ? ERRORS[initialError] ?? ERRORS.default : null
  );
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(ERRORS[result?.error ?? 'default'] ?? ERRORS.default);
        return;
      }

      // Без явного callbackUrl — редирект по роли (manager → /manager,
      // master → /master, admin → /admin). Раньше всех слало на /admin,
      // из-за чего manager/master ловили forbidden при входе с корня.
      let target = callbackUrl;
      if (!target) {
        const session = await getSession();
        const role = session?.user?.role;
        target = role === 'manager' ? '/manager' : role === 'master' ? '/master' : '/admin';
      }
      router.push(target);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase"
        >
          Email
        </label>
        <NeonInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          placeholder="ivanov@example.com"
          icon={<Mail className="w-4 h-4" />}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-orbitron tracking-wider text-content-secondary mb-1.5 uppercase"
        >
          Пароль
        </label>
        <NeonInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          placeholder="••••••••"
          icon={<Lock className="w-4 h-4" />}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <CyberpunkButton
        type="submit"
        disabled={pending}
        variant="primary"
        size="default"
        className="w-full"
      >
        {pending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Входим...
          </>
        ) : (
          'Войти'
        )}
      </CyberpunkButton>
    </form>
  );
}
