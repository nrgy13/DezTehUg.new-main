import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';

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
    // Уже авторизован — редирект по роли
    if (user.role === 'admin') redirect('/admin');
    if (user.role === 'manager') redirect('/manager');
    if (user.role === 'master') redirect('/master');
  }

  const params = await searchParams;
  const errorParam = params.error;
  const callbackUrl = params.callbackUrl;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">ДезТехЮг CRM</h1>
          <p className="text-slate-400 mt-2 text-sm">Личный кабинет менеджера и мастеров</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <LoginForm initialError={errorParam} callbackUrl={callbackUrl} />
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Доступ выдаётся только администратором.<br />
          Если вы клиент — заявку оставляйте через <a href="/" className="text-orange-400 hover:underline">главный сайт</a>.
        </p>
      </div>
    </div>
  );
}
