import { sql } from 'drizzle-orm';
import { db } from './db';
import type { DocumentType } from './db/schema';

/**
 * Префикс номера документа по типу.
 * - ДГ — договор (contract)
 * - ДС — доп. соглашение (addendum)
 * - АР — акт работ (act_work)
 * - АО — акт обследования (act_inspection)
 * - СЧ — счёт (invoice)
 * - КП — коммерческое предложение (commercial_offer)
 * - ДОК — fallback для type='other'
 */
export const DOCUMENT_PREFIX: Record<DocumentType, string> = {
  contract: 'ДГ',
  addendum: 'ДС',
  act_work: 'АР',
  act_inspection: 'АО',
  invoice: 'СЧ',
  commercial_offer: 'КП',
  upd: 'УПД',
  other: 'ДОК',
};

/**
 * Зарезервировать следующий номер документа для типа в указанном году.
 *
 * Атомарно через INSERT ... ON CONFLICT DO UPDATE RETURNING — параллельные
 * вызовы получат разные номера без явных блокировок.
 *
 * Формат результата: "ДГ-2026-001" (3 цифры, padding нулями).
 *
 * @example
 *   const num = await nextDocumentNumber('contract', new Date()); // "ДГ-2026-001"
 */
export async function nextDocumentNumber(
  type: DocumentType,
  date: Date = new Date(),
): Promise<string> {
  const year = date.getFullYear();

  const result = await db.execute<{ last_number: number }>(sql`
    INSERT INTO document_number_counters (year, type, last_number, updated_at)
    VALUES (${year}, ${type}::document_type, 1, now())
    ON CONFLICT (year, type) DO UPDATE
      SET last_number = document_number_counters.last_number + 1,
          updated_at  = now()
    RETURNING last_number
  `);

  const row = result.rows[0];
  if (!row) {
    throw new Error('Document number counter returned no row — this should be impossible');
  }

  const padded = String(row.last_number).padStart(3, '0');
  return `${DOCUMENT_PREFIX[type]}-${year}-${padded}`;
}

/**
 * Подсмотреть последний выданный номер без инкремента.
 * Возвращает null если для пары (year, type) ещё не было документов.
 * Используется в admin-UI для информации.
 */
export async function peekDocumentNumber(
  type: DocumentType,
  year: number = new Date().getFullYear(),
): Promise<string | null> {
  const result = await db.execute<{ last_number: number }>(sql`
    SELECT last_number FROM document_number_counters
    WHERE year = ${year} AND type = ${type}::document_type
  `);
  const row = result.rows[0];
  if (!row) return null;
  const padded = String(row.last_number).padStart(3, '0');
  return `${DOCUMENT_PREFIX[type]}-${year}-${padded}`;
}
