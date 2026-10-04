import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Alert, Card, Field, PageHeader, btnPrimary, errorMessage, inputClass, useApi } from '../components/ui';

const FIELDS = [
  ['company_name', 'اسم الشركة', 'text'],
  ['attendance_radius_meters', 'نصف قطر GPS (متر)', 'number'],
  ['default_shift_start', 'وقت بدء الدوام الافتراضي', 'time'],
  ['default_shift_end', 'وقت نهاية الدوام الافتراضي', 'time'],
  ['timezone', 'المنطقة الزمنية', 'text'],
  ['absence_tracking_start', 'بداية تسجيل الغياب التلقائي', 'date']
];

const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function SettingsPage() {
  const { data, loading, error } = useApi('/settings');
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState({ type: 'success', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const get = (k) => data.find((s) => s.key === k)?.value;
      setForm({
        ...Object.fromEntries(FIELDS.map(([k]) => [k, get(k) ?? ''])),
        weekend_days: get('weekend_days') ?? '5,6',
        holidays: (get('holidays') || '').split(',').filter(Boolean).join('\n')
      });
    }
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, holidays: String(form.holidays || '').split(/[\s,]+/).filter(Boolean).join(',') };
      if (!payload.absence_tracking_start) delete payload.absence_tracking_start;
      await api.put('/settings', payload);
      setMsg({ type: 'success', text: 'تم حفظ الإعدادات' });
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="الإعدادات" />
      <Alert>{error}</Alert>
      <Alert type={msg.type} onClose={() => setMsg({ ...msg, text: '' })}>{msg.text}</Alert>
      <Card>
        {loading ? 'جارٍ التحميل...' : (
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            {FIELDS.map(([key, label, type]) => (
              <Field key={key} label={label}>
                <input type={type} className={inputClass} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </Field>
            ))}
            <Field label="أيام الإجازة الأسبوعية">
              <div className="flex flex-wrap gap-3 pt-1">
                {WEEK_DAYS.map((name, i) => {
                  const days = String(form.weekend_days ?? '').split(',').filter(Boolean);
                  const on = days.includes(String(i));
                  return (
                    <label key={name} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next = on ? days.filter((d) => d !== String(i)) : [...days, String(i)];
                          setForm({ ...form, weekend_days: next.sort().join(',') });
                        }}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="العطلات الرسمية (تاريخ في كل سطر YYYY-MM-DD)">
              <textarea rows={4} dir="ltr" className={inputClass} value={form.holidays ?? ''} onChange={(e) => setForm({ ...form, holidays: e.target.value })} />
            </Field>
            <p className="text-xs text-slate-500 md:col-span-2">
              الغياب يُسجَّل تلقائيًا كل ساعة لأيام العمل الماضية (من غير الإجازات الأسبوعية والعطلات) لكل موظف لم يسجل حضورًا،
              ومن عنده إجازة موافق عليها يُسجَّل "إجازة". لا يتم تسجيل أي يوم قبل "بداية تسجيل الغياب التلقائي".
            </p>
            <p className="text-xs text-slate-500 md:col-span-2">
              مواعيد الدوام هنا تُستخدم لحساب التأخير والوقت الإضافي للموظفين الذين ليس لهم دوام خاص.
              تغيير المنطقة الزمنية هنا للعرض فقط؛ حساب التواريخ في السيرفر يتبع APP_TIMEZONE في ملف .env.
            </p>
            <div className="md:col-span-2">
              <button className={btnPrimary} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
