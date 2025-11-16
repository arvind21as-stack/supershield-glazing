export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const realm = 'Supershield Admin';
  const USER = process.env.ADMIN_USER || 'supershield';
  const PASS = process.env.ADMIN_PASS || 'ChangeMeNow';

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
    return res.status(401).send('Authentication required.');
  }
  const b64 = auth.split(' ')[1] || '';
  let decoded = '';
  try { decoded = Buffer.from(b64, 'base64').toString('utf8'); } catch {}
  const [u = '', p = ''] = decoded.split(':');

  if (u === USER && p === PASS) {
    res.setHeader('Location', '/admin-plain.html');
    return res.status(302).end();
  }
  res.setHeader('WWW-Authenticate', `Basic realm="${realm}"`);
  return res.status(401).send('Unauthorized');
}
