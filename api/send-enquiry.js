export const config = { runtime: 'nodejs' };

import nodemailer from 'nodemailer';

// Inline SVG logo (email-safe, no external requests)
const LOGO_SVG = `
<svg width="120" height="28" viewBox="0 0 420 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Supershield Glazing">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
  <rect x="10" y="10" width="60" height="60" rx="12" fill="url(#g)"/>
  <path d="M30 50 l10 -20 l10 20" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="90" y="55" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="26" fill="#0f172a">Supershield Glazing</text>
</svg>`.trim();

// Small, robust HTML email wrapper
function wrapHtml(title, bodyHtml) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc">
  <div style="max-width:660px;margin:0 auto;padding:16px;font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px">
      ${bodyHtml}
      <hr style="margin:18px 0;border:none;border-top:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:inline-block;vertical-align:middle">${LOGO_SVG}</div>
      </div>
      <div style="margin-top:8px;color:#64748b;font-size:12px;line-height:1.5">
        4 Fairfield Road, Southall, UB1 2DQ
      </div>
    </div>
    <div style="color:#94a3b8;font-size:11px;text-align:center;margin-top:10px">
      This message was sent by Supershield Glazing in response to your enquiry.
    </div>
  </div>
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST' });
  }

  const { firstName = '', lastName = '', email = '', phone = '', message = '' } = req.body || {};
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ ok: false, error: 'Missing firstName/lastName/email' });
  }

  const {
    TO_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
    FROM_NAME = 'Supershield Website', // admin notification display name
    REPLY_TO  = ''                     // optional override for admin reply-to
  } = process.env;

  if (!TO_EMAIL || !SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({ ok: false, error: 'SMTP is not configured on the server' });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  // --- 1) Admin notification (unchanged) ---
  const adminSubject = `Enquiry from ${firstName} ${lastName}`.slice(0, 140);
  const adminText = [
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone: ${phone || '-'}`,
    '',
    'Message:',
    (message || '-')
  ].join('\n');

  const adminHtml = wrapHtml(
    adminSubject,
    `<h2 style="margin:0 0 8px">${adminSubject}</h2>
     <p><strong>Email:</strong> ${email.replace(/</g,'&lt;')}</p>
     <p><strong>Phone:</strong> ${phone ? String(phone).replace(/</g,'&lt;') : '-'}</p>
     <div style="margin-top:10px">
       <div style="color:#64748b;font-size:12px;margin-bottom:4px">Message</div>
       <pre style="white-space:pre-wrap;margin:0">${(message || '-').replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</pre>
     </div>`
  );

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${SMTP_USER}>`,
      to: TO_EMAIL,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      replyTo: REPLY_TO || email
    });
  } catch (err) {
    console.error('Admin mail error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send admin email' });
  }

  // --- 2) Client auto-reply with logo + address ---
  let clientSent = false;
  try {
    const clientSubject = `Thanks, we received your enquiry`.slice(0, 140);
    const clientHtml = wrapHtml(
      'Thanks for your enquiry',
      `<h2 style="margin:0 0 8px">Thanks, ${firstName} — we’ve received your enquiry</h2>
       <p>We’ll call you back within 1 business day. Below is a copy of what you sent us:</p>
       <div style="margin-top:10px">
         <div style="color:#64748b;font-size:12px;margin-bottom:4px">Your message</div>
         <pre style="white-space:pre-wrap;margin:0">${(message || '-').replace(/[<>&]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</pre>
       </div>`
    );

    await transporter.sendMail({
      // Force the display name to "Supershield Glazing" for the client reply
      from: `"Supershield Glazing" <${SMTP_USER}>`,
      to: email,
      subject: clientSubject,
      text:
`Hi ${firstName},

Thanks for contacting Supershield Glazing. We’ve received your enquiry and will call you back within 1 business day.

Copy of your message:
${message || '-'}

— Supershield Glazing
4 Fairfield Road, Southall, UB1 2DQ`,
      html: clientHtml
    });

    clientSent = true;
  } catch (err) {
    // Best-effort: do not fail the whole request if the client auto-reply fails
    console.warn('Client auto-reply failed:', err?.message || err);
  }

  return res.status(200).json({ ok: true, clientAutoReply: clientSent });
}
