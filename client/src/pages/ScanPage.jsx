import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';

export default function ScanPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('جاري التسجيل...');
  const sent = useRef(false); // prevents a double request in React StrictMode (dev)

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const qrCode = params.get('t');

    (async () => {
      try {
        const { data } = await api.get('/attendance/today');
        const record = data.attendance;
        if (record?.checkIn && record?.checkOut) {
          setMessage('سجّلت الحضور والانصراف اليوم بالفعل');
          return;
        }
        const checkingOut = Boolean(record?.checkIn);
        await api.post(`/attendance/${checkingOut ? 'check-out' : 'check-in'}`, { qrCode });
        setMessage(checkingOut ? 'تم تسجيل انصرافك ✓' : 'تم تسجيل حضورك ✓');
      } catch (e) {
        setMessage(e.response?.data?.message || 'تعذر تسجيل الحضور');
      }
    })();
  }, [params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-2xl font-semibold">{message}</p>
      <Link to="/dashboard" className="text-blue-600 underline">
        الذهاب للوحة التحكم
      </Link>
    </div>
  );
}
