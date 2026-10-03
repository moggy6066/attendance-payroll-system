export default function EmployeesPage() {
  const data = [
    { id: 'EMP-0001', name: 'محمد الحربي', email: 'mohammed@company.com', department: 'IT', jobTitle: 'مهندس برمجيات' },
    { id: 'EMP-0002', name: 'فاطمة الزهراني', email: 'fatima@company.com', department: 'HR', jobTitle: 'مسؤولة موارد بشرية' },
    { id: 'EMP-0003', name: 'علي أحمد', email: 'ali@company.com', department: 'Finance', jobTitle: 'محاسب' }
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">إدارة الموظفين</h1>
        <button className="rounded-xl bg-blue-600 px-4 py-2 text-white">إضافة موظف</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full text-right">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3">الموظف</th>
              <th className="px-4 py-3">الرقم</th>
              <th className="px-4 py-3">الإدارة</th>
              <th className="px-4 py-3">المسمى</th>
              <th className="px-4 py-3">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {data.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-slate-500">{row.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3">{row.id}</td>
                <td className="px-4 py-3">{row.department}</td>
                <td className="px-4 py-3">{row.jobTitle}</td>
                <td className="px-4 py-3">
                  <button className="ml-2 text-blue-600">تعديل</button>
                  <button className="text-red-600">حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
