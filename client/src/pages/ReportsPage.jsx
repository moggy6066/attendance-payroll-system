export default function ReportsPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">التقارير</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-soft">تقرير الحضور اليومي</div>
        <div className="rounded-2xl bg-white p-5 shadow-soft">تقرير الحضور الأسبوعي</div>
        <div className="rounded-2xl bg-white p-5 shadow-soft">تقرير الرواتب</div>
      </div>
    </div>
  );
}
