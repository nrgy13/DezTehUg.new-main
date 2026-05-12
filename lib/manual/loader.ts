import 'server-only';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Server-only: загрузка markdown-методичек из docs/manual/.
// Файлы лежат в docs/manual/ репозитория, копируются в Docker-образ через Dockerfile.

export const MANUAL_PAGES = [
  { slug: 'general', title: 'Общая методичка', file: '00-general.md', forRoles: ['admin', 'manager', 'master'] as const },
  { slug: 'admin', title: 'Для администратора', file: '01-admin.md', forRoles: ['admin'] as const },
  { slug: 'manager', title: 'Для менеджера', file: '02-manager.md', forRoles: ['admin', 'manager'] as const },
  { slug: 'master', title: 'Для мастера', file: '03-master.md', forRoles: ['admin', 'master'] as const },
] as const;

export type ManualSlug = (typeof MANUAL_PAGES)[number]['slug'];

export function getManualPagesForRole(role: 'admin' | 'manager' | 'master') {
  return MANUAL_PAGES.filter((p) => (p.forRoles as readonly string[]).includes(role));
}

/**
 * Читает markdown-файл методички и нормализует пути к картинкам.
 * Картинки в .md ссылаются как `../screenshots/X.png` (относительно `docs/manual/`),
 * для CRM их нужно перебить на `/manual/screenshots/X.png` (URL в браузере,
 * картинки лежат в `public/manual/screenshots/`).
 */
export async function loadManualPage(slug: ManualSlug): Promise<string | null> {
  const meta = MANUAL_PAGES.find((p) => p.slug === slug);
  if (!meta) return null;

  const path = resolve(process.cwd(), 'docs/manual', meta.file);
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch (err) {
    console.error(`[manual] cannot read ${path}:`, err);
    return null;
  }

  // Перепишем пути к скриншотам на public-URL
  content = content.replace(
    /\(\.\.\/screenshots\/([^)]+)\)/g,
    '(/manual/screenshots/$1)',
  );
  // Уберём ссылки между ролевыми методичками — навигация в CRM через sidebar
  content = content.replace(/\[([^\]]+)\]\(\.\/[0-9]+-[a-z]+\.md\)/g, '$1');

  return content;
}
