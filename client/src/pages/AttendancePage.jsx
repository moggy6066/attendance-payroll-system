export default function AttendancePage() {
  const rows = [
    { name: 'محمد الحربي', date: '2026-10-03', checkIn: '08:10', checkOut: '17:00', status: 'حاضر' },
    { name: 'فاطمة الزهراني', date: '2026-10-03', checkIn: '08:40', checkOut: '17:10', status: 'متأخرة' },
    { name: 'علي أحمد', date: '2026-10-03', checkIn: '—', checkOut: '—', status: 'غائب' }
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">الحضور والانصراف</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-right">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">الموظف</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">وقت الدخول</th>
              <th className="px-4 py-3">وقت الخروج</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">{row.checkIn}</td>
                <td className="px-4 py-3">{row.checkOut}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
