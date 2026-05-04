import nodemailer, { type Transporter } from 'nodemailer';
import type { Mailer, SendMailOptions } from '../index';

/**
 * Реальный SMTP-транспорт через nodemailer.
 *
 * На dev — подключается к MailHog (SMTP_HOST=localhost, SMTP_PORT=1025, без auth).
 * На prod — Beget mail (smtp.beget.com:465, secure=true, с auth).
 */
export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST ?? 'localhost';
    const port = Number(process.env.SMTP_PORT ?? 1025);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.from = process.env.SMTP_FROM ?? 'CRM <noreply@deztechyug.ru>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // implicit TLS на 465; на 25/587/1025 — нет
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(options: SendMailOptions): Promise<{ messageId: string; transport: string }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { messageId: info.messageId, transport: 'smtp' };
  }
}
