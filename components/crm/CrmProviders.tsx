'use client';

import { SessionProvider } from 'next-auth/react';

export function CrmProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
