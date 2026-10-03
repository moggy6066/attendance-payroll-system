# نظام الحضور والانصراف - دليل النشر الإنتاجي

## متطلبات الإنتاج

- Node.js v18+
- PostgreSQL 14+
- Nginx أو Apache (للعكس البروكسي)
- SSL Certificate (HTTPS)
- PM2 أو Similar (لإدارة العمليات)

## خطوات النشر

### 1. إعداد الخادم

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# تثبيت PM2
sudo npm install -g pm2
```

### 2. إعداد قاعدة البيانات

```bash
sudo -u postgres psql

CREATE DATABASE hr_attendance_db;
CREATE USER hr_user WITH PASSWORD 'secure_password_here';
ALTER ROLE hr_user SET client_encoding TO 'utf8';
ALTER ROLE hr_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE hr_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE hr_attendance_db TO hr_user;
\q
```

### 3. نسخ المشروع

```bash
cd /var/www
sudo git clone https://github.com/moggy6066/attendance-payroll-system.git
cd attendance-payroll-system
sudo chown -R $USER:$USER .
```

### 4. تثبيت المكتبات

```bash
npm install
npm install --workspace client
npm install --workspace server

cd client
npm run build
cd ..
```

### 5. إعداد متغيرات البيئة

```bash
cd server
cp .env.example .env

# تحرير ملف .env
nano .env
```

تأكد من القيم التالية:
```env
DATABASE_URL="postgresql://hr_user:secure_password_here@localhost:5432/hr_attendance_db?schema=public"
JWT_SECRET="long-secure-random-key-here"
JWT_EXPIRES_IN="7d"
PORT=5000
CLIENT_URL="https://yourdomain.com"
NODE_ENV="production"
```

### 6. إعداد Prisma وقاعدة البيانات

```bash
npx prisma generate
npx prisma db push
node src/seed.js
```

### 7. تشغيل التطبيق مع PM2

```bash
cd /var/www/attendance-payroll-system

# إنشاء ملف ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'attendance-api',
      cwd: './server',
      script: 'src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/attendance-api-error.log',
      out_file: '/var/log/pm2/attendance-api-out.log'
    }
  ]
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. إعداد Nginx

```bash
sudo nano /etc/nginx/sites-available/attendance-system
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    root /var/www/attendance-payroll-system/client/dist;
    
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/attendance-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. إعداد SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 10. النسخ الاحتياطية

```bash
# نسخة احتياطية لقاعدة البيانات
mkdir -p /var/backups/db

# إنشاء سكريبت نسخ احتياطي
cat > /usr/local/bin/backup-hr-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/db"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
DATABASE="hr_attendance_db"
USER="hr_user"

pg_dump -U $USER $DATABASE | gzip > "$BACKUP_DIR/backup_$BACKUP_DATE.sql.gz"

# حذف النسخ الاحتياطية القديمة (أكثر من 30 يوم)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/backup-hr-db.sh

# إضافة إلى cron (يومياً في الساعة 2 صباحاً)
crontab -e
# أضف السطر:
# 0 2 * * * /usr/local/bin/backup-hr-db.sh
```

### 11. المراقبة والسجلات

```bash
# عرض حالة التطبيق
pm2 status

# عرض السجلات
pm2 logs attendance-api

# المراقبة المباشرة
pm2 monit
```

## أفضل الممارسات الأمنية

✅ استخدم JWT_SECRET قوي جداً
✅ فعّل HTTPS في كل مكان
✅ استخدم متغيرات البيئة للمعلومات الحساسة
✅ قم بنسخ احتياطية دورية
✅ قم بتحديث التبعيات بانتظام
✅ استخدم WAF (Web Application Firewall)
✅ قم بتفعيل CORS بشكل صحيح
✅ استخدم rate limiting
✅ راقب السجلات والأخطاء
✅ قم بعمل اختبارات أمان دورية

## استكشاف الأخطاء

### التطبيق يتوقف بعد التشغيل
```bash
pm2 logs attendance-api --err
```

### مشاكل قاعدة البيانات
```bash
sudo -u postgres psql -c "SELECT version();"
pg_isready
```

### مشاكل الاتصال
```bash
netstat -tulpn | grep LISTEN
curl http://localhost:5000/api/health
```

## التحديث

```bash
cd /var/www/attendance-payroll-system
git pull origin main
npm install
npm install --workspace client
npm install --workspace server
cd client && npm run build && cd ..
cd server && npx prisma db push && cd ..
pm2 restart all
```
