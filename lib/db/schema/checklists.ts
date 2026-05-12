import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { services } from './services';
import { users } from './users';
import { dealWorkLogs } from './deals';

// Откуда взялся пункт: из шаблона услуги / добавил менеджер вручную / добавил мастер на месте.
export const checklistItemSourceEnum = pgEnum('checklist_item_source', [
  'template',
  'manager',
  'master',
]);

// Состояние пункта чеклиста для конкретного выезда.
export const checklistItemStatusEnum = pgEnum('checklist_item_status', [
  'pending',
  'done',
  'na',
]);

/**
 * Шаблоны чеклистов, привязанные к услуге.
 * Заполняет admin (Регина) в /admin/services. При создании выезда копируются
 * в deal_checklist_items со source='template'.
 */
export const serviceChecklists = pgTable(
  'service_checklists',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    title: text('title').notNull(),
    description: text('description'), // подсказка для мастера
    required: boolean('required').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    serviceIdx: index('service_checklists_service_idx').on(t.serviceId, t.position),
  }),
);

/**
 * Структура одного фото в jsonb-массиве `photos`. Хранится как [{...}, {...}].
 */
export type ChecklistPhoto = {
  path: string; // относительный путь в storage: checklist/{workLogId}/{itemId}/{uuid}.{ext}
  size: number; // байт
  mime: string; // image/jpeg | image/png | image/webp
  uploadedAt: string; // ISO timestamp
  uploadedByUserId: string;
};

/**
 * Снимок чеклиста для конкретного выезда (work_log).
 * Все правки идут через server actions; после finalizeVisit — read-only.
 */
export const dealChecklistItems = pgTable(
  'deal_checklist_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workLogId: uuid('work_log_id')
      .notNull()
      .references(() => dealWorkLogs.id, { onDelete: 'cascade' }),
    source: checklistItemSourceEnum('source').notNull(),
    // FK на шаблон сохраняем для трассировки, но не блокируем удаление шаблона.
    sourceTemplateId: uuid('source_template_id').references(() => serviceChecklists.id, {
      onDelete: 'set null',
    }),
    position: integer('position').notNull().default(0),
    title: text('title').notNull(),
    description: text('description'),
    required: boolean('required').notNull().default(false),
    status: checklistItemStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    // jsonb-массив ChecklistPhoto[]. Default '[]'::jsonb на уровне БД.
    photos: jsonb('photos').$type<ChecklistPhoto[]>().notNull().default(sql`'[]'::jsonb`),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByUserId: uuid('done_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    worklogIdx: index('deal_checklist_items_worklog_idx').on(t.workLogId, t.position),
  }),
);

export type ServiceChecklist = typeof serviceChecklists.$inferSelect;
export type NewServiceChecklist = typeof serviceChecklists.$inferInsert;
export type DealChecklistItem = typeof dealChecklistItems.$inferSelect;
export type NewDealChecklistItem = typeof dealChecklistItems.$inferInsert;
export type ChecklistItemSource =
  (typeof checklistItemSourceEnum.enumValues)[number];
export type ChecklistItemStatus =
  (typeof checklistItemStatusEnum.enumValues)[number];
