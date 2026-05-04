// Mailer abstraction. В Sprint 3 — два транспорта:
// - smtp: реальная отправка через nodemailer (dev MailHog, prod Beget)
// - noop: только лог (используется на prod пока не получили SMTP Beget)

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendMailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
};

export interface Mailer {
  send(options: SendMailOptions): Promise<{ messageId: string; transport: string }>;
}

let _instance: Mailer | null = null;

export async function getMailer(): Promise<Mailer> {
  if (_instance) return _instance;
  const transport = process.env.MAILER_TRANSPORT ?? 'smtp';
  if (transport === 'noop') {
    const { NoopMailer } = await import('./transports/noop');
    _instance = new NoopMailer();
  } else if (transport === 'smtp') {
    const { SmtpMailer } = await import('./transports/smtp');
    _instance = new SmtpMailer();
  } else {
    throw new Error(`Unknown MAILER_TRANSPORT: ${transport}`);
  }
  return _instance;
}

export function resetMailer(): void {
  _instance = null;
}
