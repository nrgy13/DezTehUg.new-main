import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { LogoText } from '@/components/layout/LogoText';

export const metadata: Metadata = {
  title: 'Вход в CRM — ДезТехЮг',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === 'admin') redirect('/admin');
    if (user.role === 'manager') redirect('/manager');
    if (user.role === 'master') redirect('/master');
  }

  const params = await searchParams;
  const errorParam = params.error;
  const callbackUrl = params.callbackUrl;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary px-4 relative overflow-hidden">
      {/* Лёгкая декоративная подложка — статичная, без анимаций */}
      <div className="absolute inset-0 bg-gradient-to-br from-poison-green/5 via-transparent to-neon-orange/5 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-poison-green/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-block">
            <LogoText />
          </div>
          <p className="text-content-muted mt-3 text-sm font-orbitron tracking-widest uppercase">
            CRM · Личный кабинет
          </p>
        </div>

        <div className="bg-bg-primary border border-gray-200 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          <LoginForm initialError={errorParam} callbackUrl={callbackUrl} />
        </div>

        <p className="text-center text-xs text-content-muted mt-6">
          Доступ выдаётся только администратором.
          <br />
          Если вы клиент — заявку оставляйте через{' '}
          <a href="/" className="text-neon-orange hover:text-poison-green transition-colors">
            главный сайт
          </a>
          .
        </p>
      </div>
    </div>
  );
}
