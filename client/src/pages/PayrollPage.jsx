export default function PayrollPage() {
  const rows = [
    { name: 'محمد الحربي', salary: '7500', bonus: '500', net: '8000' },
    { name: 'فاطمة الزهراني', salary: '6200', bonus: '300', net: '6700' },
    { name: 'علي أحمد', salary: '6900', bonus: '400', net: '7300' }
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">الرواتب</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-right">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">الموظف</th>
              <th className="px-4 py-3">الراتب الأساسي</th>
              <th className="px-4 py-3">العلاوة</th>
              <th className="px-4 py-3">الصافي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.salary}</td>
                <td className="px-4 py-3">{row.bonus}</td>
                <td className="px-4 py-3">{row.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
