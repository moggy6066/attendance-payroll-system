import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

export function errorMessage(err, fallback = 'حدث خطأ غير متوقع') {
  const data = err?.response?.data;
  if (data?.errors?.fieldErrors) {
    const first = Object.entries(data.errors.fieldErrors).find(([, v]) => v?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  return data?.message || err?.message || fallback;
}

// Loads a GET endpoint and exposes { data, loading, error, reload }.
export function useApi(url, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = JSON.stringify(params || {});

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(url, { params });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export async function downloadFile(url, params, filename) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

export const currentRole = () => localStorage.getItem('role') || 'EMPLOYEE';
export const isAdmin = () => ['ADMIN', 'SUPER_ADMIN'].includes(currentRole());

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-700 dark:bg-slate-800 ${className}`}>{children}</div>;
}

export function Alert({ type = 'error', children, onClose }) {
  if (!children) return null;
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700'
  };
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${tones[type]}`}>
      <div>{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-lg leading-none opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}

const BADGE_TONES = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  slate: 'bg-slate-100 text-slate-700'
};

export function Badge({ tone = 'slate', children }) {
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${BADGE_TONES[tone]}`}>{children}</span>;
}

export const ATTENDANCE_STATUS = {
  PRESENT: ['حاضر', 'green'],
  LATE: ['متأخر', 'amber'],
  ABSENT: ['غائب', 'red'],
  ON_LEAVE: ['إجازة', 'blue']
};
export const LEAVE_TYPES = { ANNUAL: 'سنوية', SICK: 'مرضية', EMERGENCY: 'طارئة', UNPAID: 'بدون راتب' };
export const LEAVE_STATUS = { PENDING: ['قيد المراجعة', 'amber'], APPROVED: ['موافق عليها', 'green'], REJECTED: ['مرفوضة', 'red'] };
export const EMPLOYEE_STATUS = { ACTIVE: ['نشط', 'green'], INACTIVE: ['غير نشط', 'slate'], ON_LEAVE: ['في إجازة', 'blue'], TERMINATED: ['منتهي الخدمة', 'red'] };
export const USER_STATUS = { ACTIVE: ['نشط', 'green'], INACTIVE: ['معطل', 'slate'], LOCKED: ['مقفل', 'red'], PENDING: ['معلق', 'amber'] };
export const ROLES = { SUPER_ADMIN: 'مدير عام', ADMIN: 'مسؤول', EMPLOYEE: 'موظف' };

export function StatusBadge({ map, value }) {
  const [label, tone] = map[value] || [value, 'slate'];
  return <Badge tone={tone}>{label}</Badge>;
}

export function DataTable({ columns, rows, loading, empty = 'لا توجد بيانات', rowKey = 'id' }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
      <table className="min-w-full text-right">
        <thead className="bg-slate-50 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.label} className="whitespace-nowrap px-4 py-3">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                جارٍ التحميل...
              </td>
            </tr>
          )}
          {!loading && (!rows || rows.length === 0) && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
          {!loading &&
            rows?.map((row, i) => (
              <tr key={row[rowKey] ?? i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                {columns.map((c) => (
                  <td key={c.key || c.label} className="whitespace-nowrap px-4 py-3">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900';
export const btnPrimary = 'rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
export const btnSecondary =
  'rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
export const btnDanger = 'rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50';

export function todayISO() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // YYYY-MM-DD
}

export const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
export const fmtTime = (v) =>
  v ? new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—';
export const fmtMoney = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 2 }));

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function MonthYearPicker({ month, year, onChange }) {
  const thisYear = new Date().getFullYear();
  return (
    <div className="flex gap-2">
      <select className={inputClass} value={month} onChange={(e) => onChange({ month: Number(e.target.value), year })}>
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select className={inputClass} value={year} onChange={(e) => onChange({ month, year: Number(e.target.value) })}>
        {[thisYear - 2, thisYear - 1, thisYear, thisYear + 1].map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
