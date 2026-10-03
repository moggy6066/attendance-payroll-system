# Frontend Installation Guide

## Prerequisites
- Node.js v16+
- npm or yarn

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

## Project Structure

```
src/
├── main.jsx           # React entry point
├── App.jsx            # Main app component
├── index.css          # Global styles
├── api/
│   └── axios.js       # Axios instance
├── components/
│   ├── Layout.jsx     # Main layout
│   ├── StatCard.jsx   # Stat card component
│   └── ChartPanel.jsx # Chart container
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── EmployeesPage.jsx
    ├── AttendancePage.jsx
    ├── LeavePage.jsx
    ├── PayrollPage.jsx
    ├── UsersPage.jsx
    ├── ReportsPage.jsx
    ├── SettingsPage.jsx
    ├── ProfilePage.jsx
    └── NotFoundPage.jsx
```

## Default Accounts

- **Super Admin**: superadmin@company.com / SuperAdmin@123
- **Admin**: admin@company.com / Admin@123
- **Employee**: employee@company.com / Employee@123

## Features

✅ Arabic (RTL) Support
✅ Responsive Design
✅ Dark Mode
✅ Role-Based Access Control
✅ Modern UI with Tailwind CSS
✅ Charts and Analytics
✅ React Router Navigation
✅ Axios API Integration

## Troubleshooting

### Port 5173 already in use
```bash
npm run dev -- --port 5174
```

### Build errors
```bash
rm -rf node_modules
npm install
npm run build
```

### API connection errors
Make sure backend is running on `http://localhost:5000`
