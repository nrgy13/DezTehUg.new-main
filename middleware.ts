import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/config';

// Используем lite-конфиг без БД-импортов в middleware (Edge runtime)
// Драйвер pg не работает в Edge, поэтому в middleware только authorize-callback
const { auth } = NextAuth({
  ...authConfig,
  providers: [], // в middleware не нужны провайдеры — только проверка токена
});

export default auth;

export const config = {
  // Защищаем CRM-роуты, оставляем публичный сайт нетронутым
  matcher: [
    '/admin/:path*',
    '/manager/:path*',
    '/master/:path*',
    '/api/crm/:path*',
  ],
};
