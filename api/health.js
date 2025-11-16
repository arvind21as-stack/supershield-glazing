export const config = { runtime: 'nodejs' };

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const {
    TO_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  } = process.env;

  const present = [];
  const missing = [];
  for (const k of ['TO_EMAIL','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS']) {
    (process.env[k] ? present : missing).push(k);
  }

  // If you call /api/health?verify=1 we will actually connect to SMTP
  const url = new URL(req.url, 'http://x');
  const doVerify = url.searchParams.get('verify') === '1';

  if (!doVerify) {
    return res.status(200).json({ ok: missing.length === 0, present, missing });
  }

  // live verify
  if (missing.length) {
    return res.status(200).json({ ok: false, present, missing, smtp: { ok:false, reason:'missing env' } });
  }

  const configs = [
    { host: SMTP_HOST, port: Number(SMTP_PORT) || 465, secure: Number(SMTP_PORT) === 465 || !SMTP_PORT },
    // Fallback to STARTTLS on 587 if needed
    { host: SMTP_HOST, port: 587, secure: false }
  ];

  let lastErr = null;
  for (const c of configs) {
    try {
      const transporter = nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.secure, // 465 SSL, 587 STARTTLS
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      await transporter.verify();
      return res.status(200).json({
        ok: true,
        present, missing: [],
        smtp: { ok: true, using: { host:c.host, port:c.port, secure:c.secure } }
      });
    } catch (e) {
      lastErr = { code: e.code, responseCode: e.responseCode, message: String(e.message||e) };
      // try next config
    }
  }

  return res.status(200).json({
    ok: false,
    present, missing: [],
    smtp: { ok:false, tried: configs, error: lastErr }
  });
}
