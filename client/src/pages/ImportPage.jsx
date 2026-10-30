import { useState } from 'react';
import api from '../api/axios';
import { Alert, MONTHS, MonthYearPicker, PageHeader, btnPrimary, errorMessage, fmtMoney } from '../components/ui';

const octet = { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 120000 };

export default function ImportPage() {
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: 'success', text: '' });

  const reset = () => {
    setPreview(null);
    setNotice({ type: 'success', text: '' });
  };

  const run = async (action) => {
    if (!file) return setNotice({ type: 'error', text: 'اختر ملف إكسل أولًا' });
    setBusy(true);
    try {
      const res = await api.post(`/import/${action}?month=${period.month}&year=${period.year}`, file, octet);
      if (action === 'preview') {
        setPreview(res.data);
        setNotice({ type: 'success', text: '' });
      } else {
        setPreview(null);
        const d = res.data;
        setNotice({
          type: 'success',
          text: `تم الاستيراد: ${d.created} موظف جديد، ${d.updated} محدّث، ${d.attendance} سجل حضور، ${d.advances} سلفة/خصم`
        });
      }
    } catch (error) {
      const errors = error?.response?.data?.errors;
      if (action === 'commit' && Array.isArray(errors)) setPreview((p) => ({ ...(p || {}), errors }));
      setNotice({ type: 'error', text: errorMessage(error, 'فشل الاستيراد') });
    } finally {
      setBusy(false);
    }
  };

  const hasErrors = preview && preview.errors && preview.errors.length > 0;

  return (
    <div>
      <PageHeader title="استيراد من إكسل" subtitle="الموظفون والحضور والسلف من ملف جاهز (لا يتم تشغيل أي ماكرو)" />
      {notice.text && <Alert type={notice.type}>{notice.text}</Alert>}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <MonthYearPicker
          month={period.month}
          year={period.year}
          onChange={(p) => {
            setPeriod(p);
            reset();
          }}
        />
        <input
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => {
            setFile(e.target.files[0] || null);
            reset();
          }}
        />
        <button className={btnPrimary} disabled={busy || !file} onClick={() => run('preview')}>
          معاينة
        </button>
      </div>

      {preview && preview.summary && (
        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <h3 className="mb-2 font-bold">
            معاينة {MONTHS[period.month - 1]} {period.year}
          </h3>
          <ul className="mb-3 list-disc pr-5 text-sm">
            <li>الموظفون: {preview.summary.employees}</li>
            <li>سجلات الحضور: {preview.summary.attendanceRecords}</li>
            <li>
              السلف: {preview.summary.advanceRecords} (إجمالي {fmtMoney(preview.summary.advancesTotal)}) والخصومات{' '}
              {fmtMoney(preview.summary.deductionsTotal)}
            </li>
          </ul>
          {hasErrors && (
            <div className="mb-3">
              <p className="font-medium text-red-600">أخطاء يجب إصلاحها في الملف ({preview.errors.length}):</p>
              <ul className="list-disc pr-5 text-sm">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    {e.sheet} - صف {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="mb-3">
              <p className="font-medium text-amber-600">تنبيهات ({preview.warnings.length}):</p>
              <ul className="list-disc pr-5 text-sm">
                {preview.warnings.map((w, i) => (
                  <li key={i}>
                    {w.sheet}
                    {w.row ? ` - صف ${w.row}` : ''}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            className={btnPrimary}
            disabled={busy || hasErrors}
            onClick={() => window.confirm('حفظ البيانات في النظام؟') && run('commit')}
          >
            تأكيد الحفظ
          </button>
        </div>
      )}
    </div>
  );
}
