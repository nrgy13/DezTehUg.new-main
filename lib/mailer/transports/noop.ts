import type { Mailer, SendMailOptions } from '../index';

/**
 * Заглушка-транспорт. Не отправляет, только логирует.
 *
 * Используется на prod пока не получили SMTP-доступ от Beget.
 * При активации SMTP — переключаем env MAILER_TRANSPORT=smtp без передеплоя кода.
 */
export class NoopMailer implements Mailer {
  async send(options: SendMailOptions): Promise<{ messageId: string; transport: string }> {
    const messageId = `noop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.info('[mailer:noop] would send email', {
      messageId,
      to: options.to,
      subject: options.subject,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        size: a.content.length,
      })),
    });
    return { messageId, transport: 'noop' };
  }
}
