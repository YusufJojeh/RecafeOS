# RestoCafe OS

## نظرة عامة على المشروع

**RestoCafe OS** هي منصة SaaS متعددة المستأجرين متقدمة لأنظمة نقاط البيع (POS) في المطاعم والمقاهي. تم بناء المشروع كمونومريبو (monorepo) باستخدام pnpm مع واجهة خلفية NestJS وواجهة أمامية React وحزم مشتركة للأنواع والأدوات.

### الميزات الرئيسية
- ✅ **نظام نقاط بيع متكامل** - إدارة الطلبات والفواتير والمخزون
- ✅ **دعم متعدد المستأجرين** - عزل البيانات على مستوى التطبيق
- ✅ **تحديثات فورية** - WebSocket للتحديثات في الوقت الفعلي
- ✅ **تطبيق ويب تقدمي (PWA)** - يعمل بدون اتصال بالإنترنت
- ✅ **معايرة الأداء** - متقدمة مع k6 و Prometheus
- ✅ **سجلات التدقيق** - تسجيل شامل لجميع التغييرات

---

## المتطلبات الأساسية

قبل البدء، تأكد من تثبيت:
- **Node.js** 18.x أو أحدث
- **pnpm** 8.x أو أحدث (`npm install -g pnpm`)
- **Docker** و **Docker Compose** (محلياً)
- **PostgreSQL** 16 (أو عبر Docker)
- **Redis** 7 (اختياري محلياً، مطلوب للإنتاج)

---

## هيكل المشروع

```
RecafeOS/
├── apps/
│   ├── api/                          # واجهة NestJS الخلفية
│   │   ├── src/modules/              # 18 وحدة ميزة
│   │   ├── prisma/                   # تعريفات ORM
│   │   ├── test/                     # اختبارات متكاملة
│   │   └── scripts/                  # سكريبتات مساعدة
│   └── ops-web/                      # واجهة React الأمامية
│       ├── src/                      # مكونات React
│       ├── e2e/                      # اختبارات E2E (Playwright)
│       └── public/                   # الموارد الثابتة
├── packages/
│   ├── types/                        # بيانات مشتركة
│   ├── config/                       # إعدادات TypeScript
│   └── utils/                        # أدوات مشتركة
├── deploy/                           # ملفات النشر والإنتاج
├── docs/                             # التوثيق الشاملة
└── ops/                              # سكريبتات الحمل والعمليات
```

---

## التثبيت والإعداد المحلي

### 1. استنساخ المستودع
```bash
git clone <repository-url>
cd RecafeOS
```

### 2. تثبيت البيئة المحلية (Docker)
```bash
docker compose up -d
```
هذا ينشئ:
- **PostgreSQL 16** على localhost:5432
- **Redis 7** على localhost:6379
- **MinIO** (تخزين S3) على localhost:9000

### 3. تثبيت المتعلقات
```bash
pnpm install
```

### 4. إنشاء ملف البيئة
```bash
# انسخ ملف المثال
cp .env.example .env

# التحقق من المتغيرات الأساسية:
# DATABASE_URL=postgresql://user:password@localhost:5432/recafe
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-secret-key
```

### 5. إنشاء قاعدة البيانات والبيانات الأولية
```bash
# إنشاء Prisma Client
npm run db:generate

# تشغيل الترحيلات
npm run db:migrate

# إدراج البيانات الأولية (اختياري)
npm run db:seed
```

---

## بدء التطوير

### تشغيل الخادم الخلفي
```bash
npm run dev:api
```
- يعمل على `http://localhost:3000`
- مراقبة الملفات مُفعلة (تحديث تلقائي)
- WebSocket على `http://localhost:3000/socket.io`

### تشغيل الواجهة الأمامية
```bash
npm run dev:web
```
- يعمل على `http://localhost:5173`
- يوكل تلقائياً `/api` و `/socket.io` إلى الخادم الخلفي

### تشغيل كل شيء معاً
```bash
npm run dev
```

---

## الأوامر المهمة

### بناء المشروع
```bash
# بناء كامل
npm run build

# النتيجة:
# - packages/types/ → البيانات
# - apps/api/ → الخادم الخلفي
# - apps/ops-web/ → الواجهة الأمامية

# بناء وحدة محددة
npm run build -w api
npm run build -w ops-web
```

### التحقق من الجودة
```bash
# التدقيق ESLint
npm run lint

# إصلاح مشاكل ESLint تلقائياً
npm run lint -- --fix
```

### إدارة قاعدة البيانات
```bash
# إنشاء ترحيل جديد
npm run db:create -- --name migration_name

# تطبيق الترحيلات
npm run db:migrate

# إرجاع آخر ترحيل
npm run db:migrate -- --skip

# عرض واجهة Prisma Studio
npm run db:studio
```

---

## الاختبارات

### اختبارات الوحدة (Unit Tests)
```bash
# اختبار الخادم الخلفي
npm run test -w api

# اختبارات الواجهة الأمامية
npm run test -w ops-web

# مع تغطية الكود (coverage)
npm run test -w api -- --coverage
```

### اختبارات التكامل (Integration Tests)
```bash
# تشغيل جميع اختبارات التكامل
npm run test:integration -w api

# اختبار ملف واحد
npx jest --config test/jest-integration.json test/integration/my-test.integration-spec.ts
```

**ملاحظات:**
- تستخدم قاعدة بيانات منفصلة `recafe_test` على localhost:5432
- تعمل على التسلسل (--runInBand)
- مهلة زمنية: 120 ثانية لكل اختبار

### اختبارات نهاية المستخدم (E2E Tests)
```bash
# اختبارات الدخان (Smoke)
npm run test:e2e:smoke -w ops-web

# اختبارات المسار الحرج (Critical Path)
npm run test:e2e:critical -w ops-web

# تشغيل جميع الاختبارات
npm run test:e2e -w ops-web
```

### مجموعة الاختبارات الشاملة
```bash
npm run test:regression
# يشغل:
# - اختبارات وحدة الخادم
# - اختبارات وحدة الواجهة الأمامية
# - اختبارات دخان E2E
```

---

## معايرة الأداء

### سكريبتات الحمل
```bash
# دخان بسيط (5 مستخدمين افتراضيين، ~2 دقيقة)
npm run load:staging-smoke

# اختبار تجريبي (25 مستخدم، 8 دقائق)
npm run load:staging-pilot

# اختبار التزامن (20 مستخدم، تنافسية)
npm run load:concurrency

# اختبار الاستقرار (15 مستخدم، 35 دقيقة)
npm run load:soak

# اختبار النمو (45 مستخدم، 12 دقيقة)
npm run load:growth

# مجموعة كاملة
npm run load:suite
```

**المتطلبات:**
- k6 مثبت ([تحميل](https://k6.io/docs/getting-started/installation/))
- متغيرات البيئة الإنتاجية معدة

---

## البنية المعمارية

### الواجهة الخلفية (NestJS)

#### مسار الطلب
```
Helmet
  ↓
ValidationPipe (whitelist)
  ↓
ThrottlerGuard (120 req/min)
  ↓
JwtAuthGuard
  ↓
BranchGuard (مخزن مؤقتاً)
  ↓
PermissionsGuard
  ↓
Controller
  ↓
SlowRequestInterceptor
  ↓
HttpMetricsInterceptor
  ↓
GlobalExceptionFilter
```

#### الوحدات (18 وحدة)
توجد الوحدات في `apps/api/src/modules/`:
- **branches** - فروع الكيان
- **kitchen** - إدارة المطبخ والطلبات
- **orders** - دورة حياة الطلبات
- **payments** - معالجة الفواتير والدفع
- **inventory** - إدارة المخزون
- **staff** - إدارة الموظفين والصلاحيات
- و... 12 وحدة أخرى

#### أنماط معمارية مهمة

**1. عزل البيانات متعدد المستأجرين**
```typescript
whereUnderBranchTenant(branchId, tenantId);
// الخرج: { branchId, branch: { tenantId } }
```
- لا يوجد RLS على مستوى قاعدة البيانات
- العزل مفروض على مستوى التطبيق

**2. صيغة المعرفات**
- Prisma تستخدم CUIDs (ليس UUIDs)
- استخدم `@IsString()` في DTOs
- لا تستخدم `@IsUUID()`

**3. استجابات POST الافتراضية**
```typescript
@Post('/action')
@HttpCode(200)  // مطلوب بشكل صريح
```

**4. الإقفال المتفائل**
```typescript
updateMany({
  where: { status: expectedStatus },
  data: { status: newStatus }
})
```

**5. الإقفال المتشائم**
```typescript
$transaction(async (tx) => {
  const result = await tx.$queryRaw`
    SELECT ... FOR UPDATE
  `;
})
```

**6. عدم تكرار العمليات (Idempotency)**
- Redis-based مع توكن
- TTL: 90 ثانية للقفل، 10 دقائق للعملية
- انحدار تلقائي: Map في الذاكرة بدون Redis

**7. سجلات التدقيق**
```typescript
await prisma.auditLog.create({
  data: { userId, action, resourceId, changes }
})
```

**8. مكبر القيادة**
```typescript
LeaderLockService.ensureRunOnce(jobName)
```
- يضمن تشغيل الوظيفة على نسخة واحدة فقط

### الواجهة الأمامية (React + Vite)

#### إدارة الحالة
- **Zustand** - حالة العميل المحلية
- **TanStack React Query** - حالة الخادم
  - staleTime: 15 ثانية
  - refetchOnWindowFocus: معطل
  - إعادة محاولة تلقائية

#### التحديثات الفورية
- اتصال **Socket.IO** لكل فرع
- 8 أنواع أحداث محددة
- إبطاء 320 ملي ثانية من جهة العميل
- استطلاع تكيفي:
  - 60 ثانية (متصل)
  - 12 ثانية (غير متصل)
  - موقوف (تبويب في الخلفية)

#### الأداء
- **الافتراضية** عند +28 عنصراً
- `@tanstack/react-virtual` للتمرير
- **PWA** مع تحديث تلقائي
- **Dexie** لقائمة الأوامر دون إنترنت

---

## قاعدة البيانات

### ORM
- **Prisma** مع PostgreSQL 16
- 44 نموذج في `apps/api/prisma/schema.prisma`

### تجميع الاتصالات
```
DATABASE_URL=...?connection_limit=15&pool_timeout=10
```

**الصيغة:**
- الحد الأقصى للاتصالات < 70% من `max_connections` في Postgres
- بحد أقصى خيط واحد لكل نسخة

---

## متغيرات البيئة

### المتغيرات الأساسية

| المتغير | الوصف | افتراضي | الإنتاج |
|---|---|---|---|
| `DATABASE_URL` | سلسلة اتصال PostgreSQL | مطلوب | مطلوب + pool_limit |
| `REDIS_URL` | سلسلة اتصال Redis | اختياري | **مطلوب** |
| `JWT_SECRET` | مفتاح التوقيع | مطلوب | آمن + قوي |
| `METRICS_ENABLED` | تمكين Prometheus | false | **true** |
| `IDEMPOTENCY_REQUIRE_REDIS` | احتياج Redis | false | **true** |
| `SLOW_REQUEST_MS` | عتبة الطلب البطيء | 2000 | 2000 |
| `AUTH_CACHE_TTL_SECONDS` | ذاكرة JWT | 45 | 45 (5-300) |
| `AUDIT_LOG_RETENTION_DAYS` | احتفاظ السجلات | 90 | 90 |

### راجع `.env.example` للقائمة الكاملة

---

## النشر والإنتاج

### متطلبات الإنتاج

1. **PostgreSQL 16** - مع تجميع متقدم
2. **Redis 7** - مطلوب (ليس اختياري)
3. **CDN/S3** - لتخزين الملفات
4. **Prometheus + Grafana** - المراقبة
5. **ELK Stack** - تسجيل الأحداث

### بناء الصور (Docker)

```bash
# بناء الخادم الخلفي
docker build -t recafe-api:latest ./apps/api

# بناء الواجهة الأمامية
docker build -t recafe-web:latest ./apps/ops-web
```

### نشر Kubernetes مثال
انظر `deploy/k8s/` للملفات التفصيلية

### النسخ الاحتياطي والاستعادة
```bash
deploy/scripts/backup-restore-verify.sh
```

---

## الأمان

### أفضل الممارسات المنفذة

✅ **التحقق من المدخلات**
- جميع المدخلات مصادقة مع الأنواع
- قائمة بيضاء للحقول في ValidationPipe

✅ **المصادقة والتفويض**
- JWT مع التوقيع HMAC
- تخزين مؤقت للأذونات (معاد التقييم كل 45 ثانية)
- حراس فرع (BranchGuard) لعزل البيانات

✅ **معدل الحد**
- 120 طلب/دقيقة لكل IP (ThrottlerGuard)
- حد أقصى لحجم الطلب: 1 ميجابايت

✅ **رؤوس الأمان**
- Helmet مفعل
- CORS محدود
- CSP مشدد

✅ **التشفير**
- كلمات المرور مع bcrypt
- البيانات الحساسة مشفرة في الخزن

---

## استكشاف الأخطاء

### المشكلة: "لا يمكن الاتصال بـ PostgreSQL"
```bash
# تحقق من حالة Docker
docker ps | grep postgres

# تحقق من DATABASE_URL
cat .env | grep DATABASE_URL

# تجربة الاتصال
psql postgresql://user:pass@localhost:5432/recafe
```

### المشكلة: "خطأ Prisma Client"
```bash
# إعادة إنشاء Prisma Client
npm run db:generate

# تنظيف المخزن المؤقت
rm -rf node_modules/.prisma
```

### المشكلة: "Port 3000/5173 مستخدم بالفعل"
```bash
# البحث عن العملية
lsof -i :3000
lsof -i :5173

# إيقافها
kill -9 <PID>
```

### المشكلة: "اختبارات التكامل تفشل"
- تأكد من قاعدة البيانات `recafe_test`
- امسح جداول الاختبار السابقة
- اتبع نمط التنظيف في `afterAll`

---

## الموارد والتوثيق

### المستندات المضمنة
- **[docs/database/MIGRATIONS.md](docs/database/MIGRATIONS.md)** - إدارة الترحيلات
- **[docs/operations/OBSERVABILITY.md](docs/operations/OBSERVABILITY.md)** - المراقبة
- **[docs/operations/distributed-idempotency-design.md](docs/operations/distributed-idempotency-design.md)** - عدم التكرار
- **[deploy/README.md](deploy/README.md)** - نشر الإنتاج

### الروابط الخارجية
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Documentation](https://react.dev/)
- [Prisma ORM](https://www.prisma.io/)
- [Socket.IO](https://socket.io/)
- [Playwright E2E](https://playwright.dev/)

---

## المساهمة

### معايير الرمز
1. اتبع نمط الأسلوب ESLint
2. اكتب اختبارات لجميع الميزات الجديدة
3. حافظ على نسخة TypeScript مشددة
4. اتبع معايير الأمان

### عملية الـ PR
1. أنشئ فرع ميزة: `git checkout -b feature/my-feature`
2. قم بالتزام الرسائل الواضحة
3. ادفع إلى الفرع الخاص بك
4. اطلب دمج PR مع الوصف المفصل
5. انتظر الموافقة والاختبارات التلقائية

---

## الترخيص والدعم

**الملكية:** RestoCafe
**الحالة:** في الإنتاج
**الإصدار:** 1.x (عام 2026)

### الدعم
- 📧 البريد: support@restocafe.com
- 🐛 المشاكل: [GitHub Issues](https://github.com/...)
- 📚 البوابة: [https://restocafe.com/docs](https://restocafe.com/docs)

---

## ملاحظات مهمة

⚠️ **الإنتاج:**
- **يجب** تعيين `REDIS_URL` (يُرمي خطأ عند بدء التشغيل)
- **يجب** تعيين `METRICS_ENABLED=true`
- **يجب** تعيين `IDEMPOTENCY_REQUIRE_REDIS=true`

⚠️ **قاعدة البيانات:**
- استخدم Pool Limit = 15 للإنتاج
- مراقبة اتصالات Postgres
- نسخ احتياطي يومي مطلوب

⚠️ **الاختبارات:**
- تجميع اختبارات التكامل (بدون متوازي)
- نظف الموارد المُنشأة في `afterAll`
- لا تعتمد على حالة من اختبارات أخرى

---

**تحديث آخر:** مارس 2026  
**الإصدار:** 1.0.0
