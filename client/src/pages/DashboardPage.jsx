import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import ChartPanel from '../components/ChartPanel';
import {
  Bar,
  Line,
  Doughnut
} from 'react-chartjs-2';
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
    totalEmployees: 25,
    presentToday: 18,
    absentToday: 3,
    lateEmployees: 4,
    pendingLeave: 6,
    totalPayroll: 55000
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

  const attendanceData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'الحضور',
        data: [20, 22, 21, 24, 17, 19],
        backgroundColor: '#2563eb',
        borderRadius: 8
      }
    ]
  };

  const salaryData = {
    labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو'],
    datasets: [{
      label: 'الرواتب',
      data: [42000, 47000, 45000, 50000, 54000],
      borderColor: '#10b981',
      tension: 0.4,
      fill: false
    }]
  };

  const leaveData = {
    labels: ['حاضر', 'متأخر', 'غائب', 'إجازة'],
    datasets: [{
      data: [18, 4, 3, 2],
      backgroundColor: ['#2563eb', '#f59e0b', '#ef4444', '#10b981']
    }]
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-slate-500">ملخص التشغيل اليومي</p>
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

        <ChartPanel title="الرواتب الشهرية">
          <Line data={salaryData} />
        </ChartPanel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="حالة الموظفين">
          <Doughnut data={leaveData} />
        </ChartPanel>

        <ChartPanel title="النشاط الأخير">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="rounded-xl bg-slate-50 p-3">تحديث رواتب شهر مايو</li>
            <li className="rounded-xl bg-slate-50 p-3">تمت الموافقة على 4 طلبات إجازة</li>
            <li className="rounded-xl bg-slate-50 p-3">تم تسجيل حضور 18 موظفًا اليوم</li>
            <li className="rounded-xl bg-slate-50 p-3">مراجعة تقييمات الأداء</li>
          </ul>
        </ChartPanel>
      </div>
    </div>
  );
}
