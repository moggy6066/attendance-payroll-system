export default function ProfilePage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">الملف الشخصي</h1>
      <div className="rounded-2xl bg-white p-6 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">م</div>
          <div>
            <h2 className="text-xl font-bold">محمد الحربي</h2>
            <p className="text-slate-500">مهندس برمجيات</p>
          </div>
        </div>
      </div>
    </div>
  );
}
