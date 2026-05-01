import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, type UserRole } from '@/lib/db/schema/users';

// Расширяем типы Auth.js, чтобы добавить роль и id в session/token
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

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

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
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.isActive || !user.passwordHash) {
          // Не раскрываем какая именно проблема
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Обновим lastLoginAt асинхронно (не блокируя ответ)
        db.update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id))
          .catch(() => {/* swallow */});

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
        };
      },
    }),
  ],
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
