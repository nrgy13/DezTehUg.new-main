-- Sprint 8: добавляем тип документа UPD (Универсальный передаточный документ).
-- Используется вместе с типом 'invoice' — оба отправляются на email бухгалтера
-- из app_settings.accountant_email.

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'upd';
