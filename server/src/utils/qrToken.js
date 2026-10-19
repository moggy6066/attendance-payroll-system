const crypto = require('crypto');

const WINDOW_MS = 30_000;
const secret = () => process.env.QR_SECRET || process.env.JWT_SECRET;
const sign = (w) => crypto.createHmac('sha256', secret()).update(`qr:${w}`).digest('base64url').slice(0, 22);

function currentQrToken(now = Date.now()) {
  const w = Math.floor(now / WINDOW_MS);
  return { token: `${w}.${sign(w)}`, expiresInMs: (w + 1) * WINDOW_MS - now };
}

// graceWindows=1: الكود يفضل صالح لحد 60 ثانية. خليه 0 لو عايزه 30 ثانية بالظبط.
function verifyQrToken(token, now = Date.now(), graceWindows = 1) {
  if (typeof token !== 'string') return false;
  const [ws, sig] = token.split('.');
  const w = Number(ws);
  if (!Number.isInteger(w) || !sig) return false;
  const cur = Math.floor(now / WINDOW_MS);
  if (w > cur || cur - w > graceWindows) return false;
  const a = Buffer.from(sign(w));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { currentQrToken, verifyQrToken, WINDOW_MS };
