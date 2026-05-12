import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/helpers';

export const dynamic = 'force-dynamic';

// /manual без slug → редирект на ролевую методичку.
export default async function ManualIndex() {
  const user = await requireAuth();
  // Сначала ролевая, общая = fallback
  const target =
    user.role === 'admin'
      ? '/manual/admin'
      : user.role === 'manager'
        ? '/manual/manager'
        : '/manual/master';
  redirect(target);
}
