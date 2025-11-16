import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST' });

  const { firstName = '', lastName = '', email = '', phone = '', message = '' } = req.body || {};
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ ok: false, error: 'Missing firstName/lastName/email' });
  }

  const { TO_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!TO_EMAIL || !SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ ok: false, error: 'SMTP is not configured on the server' });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for 587
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  const subject = `Enquiry from ${firstName} ${lastName}`.slice(0, 140);
  const text = [
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone: ${phone || '-'}`,
    '',
    'Message:',
    message || '-'
  ].join('\\n');

  try {
    await transporter.sendMail({
      from: `"Supershield Website" <${SMTP_USER}>`,
      to: TO_EMAIL,
      subject,
      text,
      replyTo: email
    });
    return res.status(200).json({ ok: true, message: 'Email sent' });
  } catch (err) {
    console.error('Mailer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
}
