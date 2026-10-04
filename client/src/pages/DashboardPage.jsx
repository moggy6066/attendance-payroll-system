import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import ChartPanel from '../components/ChartPanel';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

export default function DashboardPage() {
  const [summary, setSummary] = useState({
    totalEmployees: '—',
    presentToday: '—',
    absentToday: '—',
    lateEmployees: '—',
    pendingLeave: '—',
    totalPayroll: 0,
    last7Days: []
  });

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await api.get('/dashboard/summary');
        setSummary(response.data);
      } catch (error) {
        console.error('Failed to load summary', error);
      }
    };
    loadSummary();
  }, []);

  const days = summary.last7Days || [];
  const attendanceData = {
    labels: days.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: 'الحضور (آخر 7 أيام)',
        data: days.map((d) => d.present),
        backgroundColor: '#2563eb',
        borderRadius: 8
      }
    ]
  };

  const n = (v) => (typeof v === 'number' ? v : 0);
  const leaveData = {
    labels: ['حاضر', 'متأخر', 'غائب', 'إجازة'],
    datasets: [{
      data: [
        Math.max(0, n(summary.presentToday) - n(summary.lateEmployees)),
        n(summary.lateEmployees),
        n(summary.absentToday),
        n(summary.onLeaveToday)
      ],
      backgroundColor: ['#2563eb', '#f59e0b', '#ef4444', '#10b981']
    }]
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-slate-500">ملخص التشغيل اليومي {summary.date || ''}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="إجمالي الموظفين" value={summary.totalEmployees} tone="blue" />
        <StatCard title="الحاضرون اليوم" value={summary.presentToday} tone="green" />
        <StatCard title="الغائبون" value={summary.absentToday} tone="red" />
        <StatCard title="المتأخرون" value={summary.lateEmployees} tone="amber" />
        <StatCard title="طلبات الإجازة" value={summary.pendingLeave} tone="slate" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="مؤشرات الحضور">
          <Bar data={attendanceData} />
        </ChartPanel>

        <ChartPanel title="حالة اليوم">
          <Doughnut data={leaveData} />
        </ChartPanel>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <StatCard title="نسبة الحضور اليوم" value={`${summary.attendanceRate ?? 0}%`} tone="green" />
        <StatCard title={`إجمالي آخر رواتب${summary.payrollPeriod ? ` (${summary.payrollPeriod})` : ''}`} value={Number(summary.totalPayroll || 0).toLocaleString('ar-EG')} tone="blue" />
        <StatCard title="عدد الأقسام" value={summary.departments ?? '—'} tone="slate" />
      </div>
    </div>
  );
}
