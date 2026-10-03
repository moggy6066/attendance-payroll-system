export default function LeavePage() {
  const rows = [
    { name: 'سارة سالم', type: 'سنوية', start: '2026-10-10', end: '2026-10-12', status: 'قيد المراجعة' },
    { name: 'عمر فارس', type: 'مرضية', start: '2026-10-08', end: '2026-10-09', status: 'موافق' },
    { name: 'ليلى ناصر', type: 'طارئة', start: '2026-10-15', end: '2026-10-15', status: 'مرفوض' }
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">إدارة الإجازات</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-right">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">الموظف</th>
              <th className="px-4 py-3">نوع الإجازة</th>
              <th className="px-4 py-3">تاريخ البداية</th>
              <th className="px-4 py-3">تاريخ النهاية</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.type}</td>
                <td className="px-4 py-3">{row.start}</td>
                <td className="px-4 py-3">{row.end}</td>
                <td className="px-4 py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
