// Middleware работает в Edge runtime — использует только authConfig (без БД/bcrypt).
// Полный auth-импорт (с Credentials provider) — в lib/auth/index.ts, server-only.

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    '/admin/:path*',
    '/manager/:path*',
    '/master/:path*',
    '/api/crm/:path*',
  ],
};
