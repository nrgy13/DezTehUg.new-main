import { desc, eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';
import { db } from '@/lib/db';
import { documentTemplates } from '@/lib/db/schema/documents';
import { users } from '@/lib/db/schema/users';
import { TemplatesClient } from './TemplatesClient';

export const metadata = { title: 'DOCX-шаблоны — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function TemplatesAdminPage() {
  await requireRole('admin', 'manager');

  const list = await db
    .select({
      id: documentTemplates.id,
      type: documentTemplates.type,
      name: documentTemplates.name,
      description: documentTemplates.description,
      s3Key: documentTemplates.s3Key,
      version: documentTemplates.version,
      isActive: documentTemplates.isActive,
      uploadedAt: documentTemplates.uploadedAt,
      uploaderName: users.fullName,
    })
    .from(documentTemplates)
    .leftJoin(users, eq(documentTemplates.uploadedById, users.id))
    .orderBy(desc(documentTemplates.uploadedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
          DOCX-шаблоны
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          Шаблоны для генерации документов. Базовые версии входят в комплект, кастомные можно
          загружать поверх. При генерации используется активная версия каждого типа.
        </p>
      </div>

      <TemplatesClient
        templates={list.map((t) => ({
          ...t,
          uploadedAt: t.uploadedAt.toISOString(),
        }))}
      />
    </div>
  );
}
