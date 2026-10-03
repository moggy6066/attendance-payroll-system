#!/bin/bash

# نظام الحضور والانصراف - سكريبت التثبيت

echo "🚀 بدء عملية التثبيت..."

# الخطوة 1: تثبيت المكتبات الأساسية
echo "\n📦 تثبيت المكتبات الأساسية..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ فشل تثبيت المكتبات الأساسية"
    exit 1
fi

# الخطوة 2: تثبيت مكتبات Frontend
echo "\n📦 تثبيت مكتبات Frontend..."
npm install --workspace client

if [ $? -ne 0 ]; then
    echo "❌ فشل تثبيت مكتبات Frontend"
    exit 1
fi

# الخطوة 3: تثبيت مكتبات Backend
echo "\n📦 تثبيت مكتبات Backend..."
npm install --workspace server

if [ $? -ne 0 ]; then
    echo "❌ فشل تثبيت مكتبات Backend"
    exit 1
fi

# الخطوة 4: إعداد Prisma
echo "\n🔧 إعداد Prisma..."
cd server
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ فشل إعداد Prisma"
    exit 1
fi

echo "\n✅ اكتمل التثبيت بنجاح!"
echo "\n📝 الخطوات التالية:"
echo "1. تأكد من تشغيل PostgreSQL"
echo "2. أنشئ قاعدة البيانات: CREATE DATABASE hr_attendance_db;"
echo "3. شغل: npx prisma db push"
echo "4. شغل: node src/seed.js"
echo "5. من المجلد الجذر، شغل: npm run dev"
