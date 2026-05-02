import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@/lib/db/schema/users';

// EDGE-SAFE конфиг для middleware.
// НЕ импортирует БД или bcrypt — только базовые callbacks и settings.
// Полный конфиг с Credentials provider — в lib/auth/index.ts.

// Расширяем типы Auth.js
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    };
  }

  interface User {
    id?: string;
    role?: UserRole;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

export const authConfig = {
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30, // 30 дней
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  // Провайдеры добавляются в lib/auth/index.ts (т.к. требуют БД)
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    authorized: async ({ auth, request }) => {
      const { pathname } = request.nextUrl;

      // Публичные роуты
      const publicPaths = ['/login', '/api/auth', '/api/leads/inbound'];
      const isPublic = publicPaths.some((p) => pathname.startsWith(p));

      // Корневые публичные страницы сайта (не CRM)
      const isCrmRoute =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/manager') ||
        pathname.startsWith('/master') ||
        pathname.startsWith('/api/crm');

      if (!isCrmRoute || isPublic) return true;

      if (!auth?.user) return false;

      const role = auth.user.role;

      // Проверка ролевого доступа
      if (pathname.startsWith('/admin') && role !== 'admin') return false;
      if (pathname.startsWith('/manager') && role !== 'admin' && role !== 'manager') return false;
      if (pathname.startsWith('/master') && role !== 'admin' && role !== 'master') return false;

      return true;
    },
  },
} satisfies NextAuthConfig;
