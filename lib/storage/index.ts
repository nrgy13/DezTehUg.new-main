// Абстракция хранилища файлов для сгенерированных документов и шаблонов.
//
// Sprint 3: единственная реализация — LocalStorage (файлы на диске VPS).
// В будущем добавим S3Storage без изменения вызовов.

export interface FileStorage {
  /**
   * Сохранить буфер по ключу. Перезаписывает существующий файл.
   * Ключ — относительный путь, e.g. "documents/2026/contract/ДГ-2026-001.docx".
   */
  put(key: string, data: Buffer, contentType?: string): Promise<void>;

  /**
   * Прочитать файл целиком в Buffer. Кидает если файла нет.
   */
  get(key: string): Promise<Buffer>;

  /**
   * Проверить существование. Не читает содержимое.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Удалить файл. Идемпотентно (нет файла — не падает).
   */
  delete(key: string): Promise<void>;

  /**
   * Размер файла в байтах. Для `Content-Length` при стриминге.
   */
  size(key: string): Promise<number>;
}

let _instance: FileStorage | null = null;

/**
 * Получить singleton-instance хранилища.
 * Драйвер выбирается по env STORAGE_DRIVER (по умолчанию 'local').
 */
export async function getStorage(): Promise<FileStorage> {
  if (_instance) return _instance;

  const driver = process.env.STORAGE_DRIVER ?? 'local';

  if (driver === 'local') {
    const { LocalStorage } = await import('./local');
    _instance = new LocalStorage();
    return _instance;
  }

  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
}

/**
 * Сбросить singleton — используется в тестах между прогонами.
 */
export function resetStorage(): void {
  _instance = null;
}
