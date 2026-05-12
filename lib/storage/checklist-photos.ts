/**
 * Хранение фото пунктов чеклиста.
 *
 * Sprint 6: используем local storage (named volume на проде).
 * Sprint 7+: миграция на S3 без изменения вызовов (storage abstraction уже готова).
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getStorage } from './index';

export const PHOTO_MAX_SIZE = 5 * 1024 * 1024; // 5 МБ
export const PHOTO_MAX_PER_ITEM = 5;

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export type StoredPhoto = {
  path: string; // relative key в storage
  size: number;
  mime: string;
  uploadedAt: string;
  uploadedByUserId: string;
};

/**
 * Сохраняет файл и возвращает мета-объект для записи в jsonb.
 *
 * Бросает при невалидном mime / слишком большом размере. Не выполняет
 * проверку лимита `<=5 на пункт` — это делает caller (atomicno с update DB).
 */
export async function saveChecklistPhoto(params: {
  workLogId: string;
  itemId: string;
  file: { arrayBuffer(): Promise<ArrayBuffer>; size: number; type: string };
  uploadedByUserId: string;
}): Promise<StoredPhoto> {
  const { workLogId, itemId, file, uploadedByUserId } = params;

  if (file.size > PHOTO_MAX_SIZE) {
    throw new Error(
      `Файл больше ${Math.round(PHOTO_MAX_SIZE / 1024 / 1024)} МБ — слишком большой`,
    );
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    throw new Error(`Неподдерживаемый формат: ${file.type}. Только JPEG/PNG/WebP.`);
  }

  const ext = EXT_BY_MIME[file.type] ?? 'bin';
  const filename = `${randomUUID()}.${ext}`;
  const key = `checklist/${workLogId}/${itemId}/${filename}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const storage = await getStorage();
  await storage.put(key, buf, file.type);

  return {
    path: key,
    size: file.size,
    mime: file.type,
    uploadedAt: new Date().toISOString(),
    uploadedByUserId,
  };
}

export async function deleteChecklistPhoto(key: string): Promise<void> {
  const storage = await getStorage();
  await storage.delete(key);
}
