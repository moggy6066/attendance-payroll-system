import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'لوحة التحكم', path: '/dashboard', roles: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'] },
  { label: 'الموظفين', path: '/employees', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'الحضور', path: '/attendance', roles: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'] },
  { label: 'الإجازات', path: '/leave', roles: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'] },
  { label: 'الرواتب', path: '/payroll', roles: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'] },
  { label: 'المستخدمون', path: '/users', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'التقارير', path: '/reports', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'الإعدادات', path: '/settings', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'الملف الشخصي', path: '/profile', roles: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE'] }
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const role = localStorage.getItem('role') || 'EMPLOYEE';

  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <aside className="fixed right-0 top-0 h-full w-72 bg-slate-900 text-white shadow-xl">
          <div className="p-6 border-b border-slate-700">
            <h1 className="text-2xl font-bold">نظام HR</h1>
            <p className="mt-2 text-sm text-slate-300">إدارة الموظفين والرواتب</p>
          </div>

          <nav className="p-4 space-y-2"> 
            {filteredNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `block rounded-lg px-4 py-3 text-sm font-medium transition ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="mr-72 min-h-screen">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-300">مرحبًا</p>
                <h2 className="text-xl font-bold">لوحة التحكم</h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDark(!dark)}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white"
                >
                  تسجيل الخروج
                </button>
              </div>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
