import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileStorage } from './index';

/**
 * Файловое хранилище на локальном диске.
 *
 * Корень читается из STORAGE_ROOT (по умолчанию ./storage относительно cwd).
 * На prod это будет /opt/deztech-crm/storage (bind-mount в контейнер app).
 *
 * Защита от path traversal: ключ резолвится в абсолютный путь и проверяется
 * что он лежит внутри корня. Попытка выйти наружу (..\.., начало с /, etc.)
 * отклоняется ошибкой.
 */
export class LocalStorage implements FileStorage {
  private readonly root: string;

  constructor(root?: string) {
    const raw = root ?? process.env.STORAGE_ROOT ?? './storage';
    this.root = path.resolve(raw);
  }

  private resolve(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('Storage key must be a non-empty string');
    }
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const target = path.resolve(this.root, normalized);
    const rel = path.relative(this.root, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return target;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }

  async get(key: string): Promise<Buffer> {
    const target = this.resolve(key);
    return fs.readFile(target);
  }

  async exists(key: string): Promise<boolean> {
    const target = this.resolve(key);
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolve(key);
    try {
      await fs.unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async size(key: string): Promise<number> {
    const target = this.resolve(key);
    const stat = await fs.stat(target);
    return stat.size;
  }
}
