import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';

export default function QrDisplayPage() {
  const [qr, setQr] = useState(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState('');

  // Fetch a fresh token right when the current one expires (server time drives the timing).
  useEffect(() => {
    let timer;
    let stopped = false;

    const load = async () => {
      try {
        const { data } = await api.get('/attendance/qr');
        if (stopped) return;
        setError('');
        setQr(data);
        setLeft(Math.ceil(data.expiresInMs / 1000));
        timer = setTimeout(load, data.expiresInMs + 200);
      } catch {
        if (stopped) return;
        setError('تعذر تحديث الكود، جاري إعادة المحاولة...');
        timer = setTimeout(load, 5000);
      }
    };

    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-6 text-center">
      <h1 className="text-3xl font-bold">امسح الكود لتسجيل الحضور أو الانصراف</h1>
      {qr ? (
        <div className="rounded-2xl border p-4">
          <QRCodeSVG value={`${window.location.origin}/scan?t=${qr.token}`} size={320} />
        </div>
      ) : (
        <p className="text-xl">جاري التحميل...</p>
      )}
      <p className="text-xl">يتجدد الكود خلال {left} ثانية</p>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
