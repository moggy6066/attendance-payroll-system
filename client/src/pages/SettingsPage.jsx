export default function SettingsPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">الإعدادات</h1>
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="mb-2 block text-sm">اسم الشركة</label><input className="w-full rounded-lg border px-3 py-2" value="نظام الحضور والانصراف" /></div>
          <div><label className="mb-2 block text-sm">نصف قطر GPS</label><input className="w-full rounded-lg border px-3 py-2" value="120" /></div>
          <div><label className="mb-2 block text-sm">وقت بدء الدوام</label><input className="w-full rounded-lg border px-3 py-2" value="08:00" /></div>
          <div><label className="mb-2 block text-sm">وقت نهاية الدوام</label><input className="w-full rounded-lg border px-3 py-2" value="17:00" /></div>
        </div>
      </div>
    </div>
  );
}
