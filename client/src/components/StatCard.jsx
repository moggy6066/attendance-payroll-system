export default function StatCard({ title, value, trend, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${tones[tone]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <div className="mt-4 flex items-end justify-between">
        <h3 className="text-3xl font-bold">{value}</h3>
        {trend && <span className="text-xs font-medium">{trend}</span>}
      </div>
    </div>
  );
}
