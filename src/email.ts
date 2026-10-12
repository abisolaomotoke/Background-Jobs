import nodemailer, { type Transporter } from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EMAIL_FROM } =
  process.env;

function createTransporter(): Transporter {
  if (!SMTP_HOST) {
    // No SMTP configured: use nodemailer's JSON transport so the worker can
    // run locally without actually sending mail.
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: SMTP_SECURE === 'true',
    auth:
      SMTP_USER && SMTP_PASS
        ? { user: SMTP_USER, pass: SMTP_PASS }
        : undefined,
  });
}

const transporter = createTransporter();

export const emailFrom = EMAIL_FROM || 'Background Jobs <no-reply@localhost>';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await transporter.sendMail({
    from: emailFrom,
    to: message.to,
    subject: message.subject,
    text: message.body,
  });
}
