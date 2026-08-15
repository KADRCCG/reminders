import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendEmail({ to, subject, text }) {
  const mailer = getTransporter();

  if (!mailer) {
    console.log('\n--- EMAIL (console fallback) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('--------------------------------\n');
    return { channel: 'console', messageId: 'console' };
  }

  const info = await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });

  return { channel: 'email', messageId: info.messageId };
}

export const sendReminderEmail = sendEmail;
