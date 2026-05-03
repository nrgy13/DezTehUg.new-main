// Middleware работает в Edge runtime — использует только authConfig (без БД/bcrypt).
// Полный auth-импорт (с Credentials provider) — в lib/auth/index.ts, server-only.

import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/config';

const { auth } = NextAuth(authConfig);

// Хосты CRM-поддомена (Punycode + Unicode).
// Если запрос пришёл на эти хосты — корень / редиректит в /login или панель роли.
const CRM_HOSTS = new Set([
  'crm.xn--c1abdaj0ewa6e.xn--p1ai', // Punycode
  'crm.дезтехюг.рф',                // Unicode (для всех браузеров)
]);

function isCrmHost(host: string | null): boolean {
  if (!host) return false;
  // Убираем порт если есть
  const hostNoPort = host.split(':')[0].toLowerCase();
  return CRM_HOSTS.has(hostNoPort);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host');
  const onCrmHost = isCrmHost(host);

  // На crm-поддомене корень / должен редиректить в CRM (login или панель роли).
  if (onCrmHost && pathname === '/') {
    const user = req.auth?.user;
    if (user) {
      const target =
        user.role === 'admin' ? '/admin' :
        user.role === 'manager' ? '/manager' :
        '/master';
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/',                        // для проверки crm-поддомена
    '/admin/:path*',
    '/manager/:path*',
    '/master/:path*',
    '/profile/:path*',
    '/profile',
    '/api/crm/:path*',
  ],
};
