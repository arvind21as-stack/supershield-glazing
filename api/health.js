export const config = { runtime: 'nodejs' };
export default function handler(req, res){
  const vars = ['TO_EMAIL','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','ADMIN_USER','ADMIN_PASS'];
  const present = vars.filter(k => process.env[k]);
  const missing = vars.filter(k => !process.env[k]);
  res.status(200).json({ ok: missing.length===0, present, missing });
}
