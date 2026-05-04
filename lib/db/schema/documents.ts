import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  boolean,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { clients } from './clients';
import { deals } from './deals';
import { leads } from './leads';

// Тип документа
export const documentTypeEnum = pgEnum('document_type', [
  'contract',          // договор
  'addendum',          // доп.соглашение
  'act_work',          // акт выполненных работ
  'act_inspection',    // акт обследования
  'invoice',           // счёт
  'commercial_offer',  // КП
  'other',
]);

// Статус документа
export const documentStatusEnum = pgEnum('document_status', [
  'draft',      // черновик (ещё не сгенерирован)
  'generated', // сгенерирован, доступен для скачивания
  'sent',      // отправлен клиенту
  'signed',    // подписан клиентом (загружен скан)
  'archived',
]);

// Шаблоны DOCX (хранятся в S3, с переменными типа {{client.short_name}})
export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  type: documentTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // S3-ключ к файлу шаблона
  s3Key: text('s3_key').notNull(),

  // Какие переменные доступны (для UI заполнения)
  variablesSchema: jsonb('variables_schema'),

  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),

  uploadedById: uuid('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Сгенерированные документы (договоры, акты, счета и т.д.)
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  type: documentTypeEnum('type').notNull(),
  number: varchar('number', { length: 64 }), // "ДТЮ-28/01/26-16"
  date: date('date'),
  title: varchar('title', { length: 512 }),

  // Связи
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  templateId: uuid('template_id').references(() => documentTemplates.id, {
    onDelete: 'set null',
  }),

  // Заполненные переменные (для воспроизводимости)
  variablesJson: jsonb('variables_json'),

  // S3-ключи к файлам
  docxS3Key: text('docx_s3_key'),
  pdfS3Key: text('pdf_s3_key'),

  // Скан подписанного документа
  signedScanS3Key: text('signed_scan_s3_key'),
  signedScanUploadedAt: timestamp('signed_scan_uploaded_at', { withTimezone: true }),

  status: documentStatusEnum('status').notNull().default('draft'),

  // Если отправили клиенту
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentToEmail: varchar('sent_to_email', { length: 255 }),

  notes: text('notes'),

  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Счётчики для сквозной нумерации документов по году+типу
// Используется через INSERT ... ON CONFLICT DO UPDATE RETURNING для атомарности
export const documentNumberCounters = pgTable(
  'document_number_counters',
  {
    year: integer('year').notNull(),
    type: documentTypeEnum('type').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.year, t.type] }),
  }),
);

export type DocumentType = (typeof documentTypeEnum.enumValues)[number];
export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type NewDocumentTemplate = typeof documentTemplates.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentNumberCounter = typeof documentNumberCounters.$inferSelect;
export type NewDocumentNumberCounter = typeof documentNumberCounters.$inferInsert;
