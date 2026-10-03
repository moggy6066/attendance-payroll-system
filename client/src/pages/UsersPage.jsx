export default function UsersPage() {
  const rows = [
    { username: 'superadmin', email: 'superadmin@company.com', role: 'Super Admin', status: 'نشط' },
    { username: 'admin', email: 'admin@company.com', role: 'Admin', status: 'نشط' },
    { username: 'employee', email: 'employee@company.com', role: 'Employee', status: 'نشط' }
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">إدارة المستخدمين</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-right">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">اسم المستخدم</th>
              <th className="px-4 py-3">البريد</th>
              <th className="px-4 py-3">الدور</th>
              <th className="px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-3">{row.username}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">{row.role}</td>
                <td className="px-4 py-3">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
