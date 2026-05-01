import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients, clientSourceEnum } from './clients';
import { users } from './users';

// Статусы воронки заявки
export const leadStatusEnum = pgEnum('lead_status', [
  'new',           // только что пришла
  'contacted',     // менеджер связался
  'qualified',     // подтверждена потребность
  'proposal_sent', // отправлено КП
  'won',           // конвертирована в сделку
  'lost',          // отвалилась
]);

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  // Если уже привязана к существующему клиенту
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),

  // Из какого канала пришла
  source: clientSourceEnum('source').notNull(),
  channel: varchar('channel', { length: 64 }), // "booking_form", "calculator", "phone_call"

  // Контактные данные (могут быть до создания клиента)
  contactName: varchar('contact_name', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 32 }),
  contactEmail: varchar('contact_email', { length: 255 }),

  // Что хочет
  serviceTypes: jsonb('service_types'), // ["disinsection", "deratization"]
  requestedAddress: text('requested_address'),
  areaM2Estimate: integer('area_m2_estimate'),
  message: text('message'),

  // Статус и назначение
  status: leadStatusEnum('status').notNull().default('new'),
  assignedManagerId: uuid('assigned_manager_id').references(() => users.id, {
    onDelete: 'set null',
  }),

  // Сырые данные с n8n / формы (на случай если нужно отладить)
  rawPayload: jsonb('raw_payload'),

  // Когда конвертирован в сделку
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  lostReason: text('lost_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
