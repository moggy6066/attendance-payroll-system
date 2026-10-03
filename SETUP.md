# نظام الحضور والانصراف - دليل الإعداد

## المتطلبات
- Node.js (v16 أو أعلى)
- npm أو yarn
- PostgreSQL (v12 أو أعلى)

## خطوات الإعداد

### 1. استنساخ المشروع
```bash
git clone https://github.com/moggy6066/attendance-payroll-system.git
cd attendance-payroll-system
```

### 2. تثبيت المكتبات

#### الخطوة الأولى: تثبيت المكتبات الأساسية
```bash
npm install
```

#### الخطوة الثانية: تثبيت مكتبات Frontend
```bash
npm install --workspace client
```

#### الخطوة الثالثة: تثبيت مكتبات Backend
```bash
npm install --workspace server
```

### 3. إعداد قاعدة البيانات

#### تأكد من تشغيل PostgreSQL
```bash
# على Windows
net start postgresql-x64-15

# على macOS
brew services start postgresql

# على Linux
sudo systemctl start postgresql
```

#### إنشاء قاعدة البيانات
```bash
# الاتصال بـ PostgreSQL
psql -U postgres

# داخل psql
CREATE DATABASE hr_attendance_db;
\q
```

### 4. إعداد متغيرات البيئة

```bash
cd server
cp .env.example .env
```

تأكد من أن ملف `.env` يحتوي على:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hr_attendance_db?schema=public"
JWT_SECRET="QwErTy123!@#HRAttendanceSystemSecureKey"
JWT_EXPIRES_IN="7d"
PORT=5000
CLIENT_URL="http://localhost:5173"
```

### 5. إعداد Prisma

```bash
# ما زلت في مجلد server
npx prisma generate
npx prisma db push
```

### 6. زرع البيانات

```bash
node src/seed.js
```

ستظهر لك هذه الرسالة عند النجاح:
```
Database seed completed successfully.
```

### 7. تشغيل التطبيق

```bash
# من المجلد الجذر
cd ..
npm run dev
```

سيبدأ التطبيق على:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

## حسابات الاختبار الافتراضية

### Super Admin
- البريد: `superadmin@company.com`
- كلمة المرور: `SuperAdmin@123`

### Admin
- البريد: `admin@company.com`
- كلمة المرور: `Admin@123`

### Employee
- البريد: `employee@company.com`
- كلمة المرور: `Employee@123`

## استكشاف الأخطاء

### خطأ: "ECONNREFUSED" أو PostgreSQL غير متصل
```bash
# تحقق من تشغيل PostgreSQL
psql -U postgres -c "SELECT 1"
```

### خطأ: "Cannot find module"
```bash
# أعد تثبيت المكتبات
rm -rf node_modules client/node_modules server/node_modules
npm install
npm install --workspace client
npm install --workspace server
```

### خطأ: DATABASE_URL غير صحيح
```bash
# تحقق من بيانات الاتصال في server/.env
psql $DATABASE_URL -c "SELECT 1"
```

### خطأ: Prisma Migration
```bash
cd server
npx prisma migrate reset
node src/seed.js
```

## إيقاف التطبيق
```bash
Ctrl + C
```

## الميزات المتاحة

✅ نظام تسجيل الدخول الآمن (JWT)
✅ إدارة الموظفين
✅ تتبع الحضور والانصراف
✅ طلبات الإجازات
✅ إدارة الرواتب
✅ التقارير والإحصائيات
✅ إدارة المستخدمين والأدوار
✅ دعم اللغة العربية (RTL)
✅ واجهة استجابية
✅ وضع مظلم

## معلومات إضافية

- **مجلد Backend**: `server/` (Express.js + Prisma)
- **مجلد Frontend**: `client/` (React + Vite + Tailwind)
- **قاعدة البيانات**: PostgreSQL
- **المصادقة**: JWT Tokens
- **التحكم في الأدوار**: RBAC (Role-Based Access Control)

## الدعم

إذا واجهت أي مشاكل، تحقق من:
1. نسخة Node.js (`node --version`)
2. تشغيل PostgreSQL (`pg_isready`)
3. ملف `.env` في مجلد `server`
4. سجلات الأخطاء في Terminal
