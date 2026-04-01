# RestoCafe OS - Frontend Pages & UI Components Documentation

معلومات شاملة عن جميع صفحات الواجهة الأمامية والمكونات(All Frontend Pages & UI Components)

---

## 📑 جدول المحتويات | Table of Contents

1. [Authentication Pages](#authentication-pages)
2. [Main Operation Pages](#main-operation-pages)
3. [Kitchen/Bar Station Pages](#kitchenbar-station-pages)
4. [Reports & Analytics Pages](#reports--analytics-pages)
5. [Management Pages](#management-pages)
6. [Support & Internal Pages](#support--internal-pages)
7. [Public Pages](#public-pages)
8. [Global Components](#global-components)

---

## 🔐 Authentication Pages

### 1. **LoginPage**
**Path:** `/login`  
**Route:** `<Route path="/login" element={<LoginPage />} />`  
**File:** `apps/ops-web/src/pages/LoginPage.tsx`  
**Protected:** ❌ No (Public)  
**Description:** صفحة تسجيل الدخول الرئيسية للموظفين

**Features:**
- إدخال بيانات الدخول (البريد الإلكتروني/كلمة المرور)
- اختيار المستأجر (Tenant Selection)
- معالجة الأخطاء
- إعادة التوجيه إلى صفحة اختيار الفرع بعد النجاح

**Components Used:**
- Form inputs
- Error handling
- Tenant selector

**Data Types:**
```typescript
type TenantInfo = { id: string; name: string; slug: string };
type LoginResponse = { 
  accessToken: string;
  tenantId: string;
  branchId?: string;
}
```

---

### 2. **BranchSelectPage**
**Path:** `/branch`  
**Route:** `<Route path="/branch" element={<BranchSelectPage />} />`  
**File:** `apps/ops-web/src/pages/BranchSelectPage.tsx`  
**Protected:** ⚠️ Auth Required (After Login)  
**Description:** صفحة اختيار الفرع بعد تسجيل الدخول

**Features:**
- عرض قائمة الفروع المتاحة
- اختيار الفرع الحالي للعمل
- عرض معلومات الفرع (الاسم، الموقع)
- الانتقال إلى صفحة الدور الأرضي (Floor Page)

**Components Used:**
- Branch selector
- Branch info display
- Selection handler

**Data Types:**
```typescript
type Branch = { 
  id: string; 
  name: string; 
  slug: string; 
};
type CommerceRead = {
  branches: Branch[];
  // ... other commerce data
}
```

---

## 🏪 Main Operation Pages

### 3. **FloorPage**
**Path:** `/floor`  
**Route:** `<Route path="/floor" element={<RequireAuth><FloorPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/FloorPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة إدارة الطاولات والدور الأرضي - الصفحة الرئيسية

**Features:**
- عرض تخطيط الدور الأرضي بصرياً
- إدارة حالة الطاولات (Available, Occupied, Reserved)
- إنشاء طلبات جديدة
- عرض الطلبات النشطة لكل طاولة
- تحديثات فورية عبر WebSocket
- تصفية وبحث الطاولات
- إدارة الحجوزات

**Components Used:**
- Table grid/layout
- Table status indicators
- Order summary
- Reservation system
- Real-time updates

**Data Types:**
```typescript
type Table = {
  id: string;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  currentOrderId?: string;
  seatCount: number;
  position?: { x: number; y: number };
}
```

---

### 4. **MenuPage**
**Path:** `/menu`  
**Route:** `<Route path="/menu" element={<RequireAuth><MenuPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/MenuPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة قائمة الطعام - إدارة ونقاط البيع

**Features:**
- عرض الفئات (Categories) مع المنتجات
- البحث عن المنتجات
- إضافة المنتجات إلى الطلب
- تحديد الخيارات والإضافات
- عرض السعر والتفاصيل
- إدارة عربة التسوق (Cart)
- إكمال الطلب
- تطبيق الخصومات والكوبونات

**Components Used:**
- Category tabs/tree
- Product cards
- Search bar
- Cart panel
- Customization options
- Price calculation

**Data Types:**
```typescript
type Category = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  position?: number;
  items: MenuItem[];
}

type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  availability: boolean;
  customizationGroups?: CustomizationGroup[];
}
```

---

### 5. **CustomerLookupPage**
**Path:** `/customers`  
**Route:** `<Route path="/customers" element={<RequireAuth><CustomerLookupPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/CustomerLookupPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة البحث والتعامل مع بيانات العملاء

**Features:**
- البحث عن العملاء بالاسم/الهاتف/البريد
- عرض معلومات العميل (تاريخ التسجيل، الطلبات السابقة)
- عرض تفاصيل العميل
- إنشاء عميل جديد
- إدارة بيانات التواصل
- عرض سجل الطلبات السابقة
- الملاحظات والتعليقات

**Components Used:**
- Search input
- Customer list
- Customer detail panel
- Contact information
- Order history

**Data Types:**
```typescript
type SearchHit = {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  lastOrderAt?: string;
};

type CustomerDetail = {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  orders?: Order[];
  loyaltyStatus?: string;
  totalSpent?: number;
}
```

---

## 👨‍🍳 Kitchen/Bar Station Pages

### 6. **KitchenPage (Kitchen Station)**
**Path:** `/kitchen`  
**Route:** `<Route path="/kitchen" element={<RequireAuth><KitchenPage station="KITCHEN" /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/KitchenPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة محطة المطبخ - عرض وإدارة تذاكر الطلبات

**Features:**
- عرض تذاكر الطلبات المعلقة (Pending Tickets)
- تصنيف التذاكر حسب الحالة (جديد، قيد المعالجة، جاهز)
- عرض تفاصيل الطلب والعناصر
- تحديث حالة الطلب (Mark as Ready)
- إشعارات الطلبات الجديدة
- الفرز حسب الأولوية
- عرض وقت الانتظار
- تحديثات فورية

**Components Used:**
- Ticket display
- Ticket status indicator
- Item list detail
- Status update buttons
- Real-time notifications
- Priority indicators

**Data Types:**
```typescript
type Ticket = {
  id: string;
  orderId: string;
  station: 'KITCHEN' | 'BAR';
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'PICKED_UP';
  items: TicketItem[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  tableNumber?: string;
  customerName?: string;
  notes?: string;
}

type TicketItem = {
  id: string;
  productName: string;
  quantity: number;
  specialInstructions?: string;
  status: 'PENDING' | 'PREPARED' | 'SERVED';
}
```

---

### 7. **KitchenPage (Bar Station)**
**Path:** `/bar`  
**Route:** `<Route path="/bar" element={<RequireAuth><KitchenPage station="BAR" /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/KitchenPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة محطة البار - عرض وإدارة تذاكر الطلبات

**Features:**
- متطابقة مع محطة المطبخ
- محسّبة خصيصاً لمنتجات المشروبات
- تحديثات فورية للطلبات
- إدارة حالة تحضير المشروبات
- عرض التفاصيل الخاصة للمشروبات (الثلج، الإضافات، إلخ)

**Components Used:**
- نفس مكونات المطبخ (Identical to Kitchen)

---

### 8. **OpenOrdersPage**
**Path:** `/orders`  
**Route:** `<Route path="/orders" element={<RequireAuth><OpenOrdersPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/OpenOrdersPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة الطلبات المفتوحة - عرض إجمالي الطلبات النشطة

**Features:**
- عرض جداول بجميع الطلبات المفتوحة/النشطة
- معلومات الطاولة ورقم الطلب
- إجمالي المبلغ
- مدة الطلب المفتوح
- حالة الطلب
- البحث والفرز
- عرض تفاصيل الطلب
- إجراءات سريعة (إضافة عنصر، إغلاق الفاتورة)

**Components Used:**
- Order table/list
- Sorting controls
- Search/filter
- Order detail panel
- Quick action buttons

**Data Types:**
```typescript
type OpenOrderRow = {
  id: string;
  tableId: string;
  tableName: string;
  customerName?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'IN_PREPARATION' | 'READY' | 'SERVED';
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  createdAt: string;
  elapsedMinutes?: number;
}

type OpenOrdersResponse = {
  items: OpenOrderRow[];
  total: number;
}
```

---

## 📊 Reports & Analytics Pages

### 9. **ReportsPage**
**Path:** `/reports`  
**Route:** `<Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/ReportsPage.tsx`  
**Protected:** ✅ Yes  
**Description:** الصفحة الرئيسية للتقارير - تحليل البيانات والأداء

**Features:**
- عرض KPIs الرئيسية (الإيرادات، عدد الطلبات)
- الرسوم البيانية بالمبيعات
- أداء الفئات
- ترتيب المنتجات الأكثر مبيعاً
- تحليل الساعات الذروة
- تقارير يومية/أسبوعية/شهرية
- تصدير التقارير
- مقارنة الفترات الزمنية

**Components Used:**
- KPI cards
- Charts (Line, Bar, Pie)
- Report filters
- Date range picker
- Data table
- Export functionality
- DailyReportBody component

**Data Types:**
```typescript
type ReportMetrics = {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  itemsSold: number;
  categoryBreakdown: CategoryMetric[];
  topProducts: ProductMetric[];
  peakHours: HourMetric[];
  timestamp: string;
}
```

---

### 10. **ShiftHandoffPage**
**Path:** `/reports/shift-handoff`  
**Route:** `<Route path="/reports/shift-handoff" element={<RequireAuth><ShiftHandoffPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/ShiftHandoffPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة تسليم الوردية - تقرير انتقالي بين الورديات

**Features:**
- ملخص الوردية الحالية
- الإيرادات والطلبات
- المشاكل المعلقة والملاحظات
- المخزون المتبقي
- التنبيهات والقضايا المهمة
- سجل الحضور
- توقيع المسؤول
- نموذج تسليم رسمي

**Components Used:**
- Shift summary cards
- Metrics display
- Issues list
- Sign-off form
- Notes section

---

### 11. **WeeklyDigestPage**
**Path:** `/weekly-digest`  
**Route:** `<Route path="/weekly-digest" element={<RequireAuth><WeeklyDigestPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/WeeklyDigestPage.tsx`  
**Protected:** ✅ Yes  
**Description:** تقرير الملخص الأسبوعي - ملخص شامل للأداء الأسبوعي

**Features:**
- ملخص الإيرادات الأسبوعية
- مقارنة مع الأسبوع السابق
- أداء المنتجات والفئات
- اتجاهات المبيعات
- أيام الذروة والكساد
- رسوم بيانية مقارنة
- توقعات الأسبوع القادم
- نقاط رئيسية للإجراء

**Components Used:**
- Weekly summary card
- Comparison charts
- Trend analysis
- Action items list
- Performance indicators

**Data Types:**
```typescript
type WeeklyDigest = {
  weekStart: string;
  weekEnd: string;
  totalRevenue: number;
  previousWeekRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topCategory: string;
  topProduct: string;
  peakDay: string;
  insights: string[];
  recommendations: string[];
}
```

---

### 12. **StockPage**
**Path:** `/stock`  
**Route:** `<Route path="/stock" element={<RequireAuth><StockPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/StockPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة إدارة المخزون - تتبع الكميات والمكونات

**Features:**
- عرض قائمة المخزون الكاملة
- مراقبة الكميات المنخفضة
- تنبيهات المخزون المنخفض
- تحديث الكميات اليدوي
- سجل الحركات
- طلب البضائع
- تقارير الاستهلاك
- توقعات المخزون

**Components Used:**
- Stock table/list
- Quantity indicator
- Low stock alert
- Update form
- Movement history
- Purchase order form

**Data Types:**
```typescript
type Stock = {
  id: string;
  name: string;
  quantity: string;
  lowThreshold: string;
  unit: string;
  lastUpdated: string;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  cost?: number;
  supplier?: string;
}
```

---

## ⚙️ Management Pages

### 13. **SetupPage**
**Path:** `/setup`  
**Route:** `<Route path="/setup" element={<RequireAuth><SetupPage /></RequireAuth>} />`  
**File:** `apps/ops-web/src/pages/SetupPage.tsx`  
**Protected:** ✅ Yes  
**Description:** صفحة الإعداد الأولي - تكوين الفرع والنظام

**Features:**
- الإعداد الأولي للفرع
- قائمة المهام الأساسية
- تكوين المنتجات والفئات
- إعدادات الجداول والطاولات
- إدارة الموظفين
- تكوين الدفع
- تكوين الطابعة
- اختبار الاتصالات

**Components Used:**
- Setup wizard steps
- Task checklist
- Configuration forms
- Progress indicator
- Save/submit buttons

**Data Types:**
```typescript
type OnboardingStepDetail = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  order: number;
  action?: string;
}

type OnboardingStatus = {
  completionPercentage: number;
  steps: OnboardingStepDetail[];
  currentStep?: string;
}

type CommerceReadModel = {
  branchId: string;
  tenantId: string;
  branchName: string;
  location?: string;
  timezone?: string;
  currency?: string;
  // ... other commerce configuration
}
```

---

## 🔧 Support & Internal Pages

### 14. **SupportConsolePage** (Internal Only)
**Path:** `/internal/support`  
**Route:** `<Route path="/internal/support" element={<SupportConsolePage />} />`  
**File:** `apps/ops-web/src/pages/SupportConsolePage.tsx`  
**Protected:** ✅ Yes (Behind ENV Flag)  
**Enabled When:** `VITE_SUPPORT_CONSOLE === 'true'`  
**Description:** لوحة قيادة الدعم الداخلي - إدارة المستأجرين والتشخيص

**Features:**
- البحث عن المستأجرين
- عرض معلومات المستأجر
- تشخيص المشاكل
- إدارة المستخدمين
- عرض السجلات
- تشغيل الأدوات التشخيصية
- إدارة الاشتراكات

**Components Used:**
- Tenant search
- Tenant detail view
- Diagnostic tools
- Log viewer
- User management

---

### 15. **PilotPortfolioPage** (Internal Only)
**Path:** `/internal/pilots`  
**Route:** `<Route path="/internal/pilots" element={<PilotPortfolioPage />} />`  
**File:** `apps/ops-web/src/pages/PilotPortfolioPage.tsx`  
**Protected:** ✅ Yes (Behind ENV Flag)  
**Enabled When:** `VITE_SUPPORT_CONSOLE === 'true'`  
**Description:** محفظة المشاريع التجريبية - إدارة عملاء الاختبار

**Features:**
- عرض قائمة جميع المشاريع التجريبية
- حالة كل مشروع (نشط، منتهي، متوقف)
- معلومات العميل
- تاريخ البدء والنهاية
- الميزات المختبرة
- الملاحظات والتقييمات
- روابط سريعة لتفاصيل المشروع

**Components Used:**
- Pilot list table
- Status indicators
- Filtering controls
- Navigation links

**Data Types:**
```typescript
type PilotRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  branchCount: number;
  userCount: number;
  revenue?: number;
  feedback?: string;
}
```

---

### 16. **PilotDetailPage** (Internal Only)
**Path:** `/internal/pilots/:tenantId`  
**Route:** `<Route path="/internal/pilots/:tenantId" element={<PilotDetailPage />} />`  
**File:** `apps/ops-web/src/pages/PilotDetailPage.tsx`  
**Protected:** ✅ Yes (Behind ENV Flag)  
**Enabled When:** `VITE_SUPPORT_CONSOLE === 'true'`  
**Description:** تفاصيل المشروع التجريبي الفردي

**Features:**
- معلومات المستأجر الكاملة
- قائمة الفروع
- سجل التغييرات
- التعليقات والملاحظات
- مقاييس الأداء
- معدل الاستخدام
- المشاكل المبلغ عنها
- المحادثات مع العميل

**Components Used:**
- Tenant info panel
- Branch list
- Feedback/comments section
- Metrics display
- Timeline view

**Data Types:**
```typescript
type BranchRow = { 
  id: string; 
  name: string; 
  slug: string; 
};

type FeedbackRow = {
  id: string;
  tenantId: string;
  type: 'FEEDBACK' | 'BUG_REPORT' | 'FEATURE_REQUEST';
  content: string;
  createdAt: string;
  createdBy: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
};
```

---

### 17. **PilotWeeklyPage** (Internal Only)
**Path:** `/internal/pilots/weekly`  
**Route:** `<Route path="/internal/pilots/weekly" element={<PilotWeeklyPage />} />`  
**File:** `apps/ops-web/src/pages/PilotWeeklyPage.tsx`  
**Protected:** ✅ Yes (Behind ENV Flag)  
**Enabled When:** `VITE_SUPPORT_CONSOLE === 'true'`  
**Description:** تقرير الأسبوع للمشاريع التجريبية

**Features:**
- ملخص الأداء الأسبوعي لكل مشروع
- مقارنة مع الأسبوع السابق
- معدل النمو
- مشاكل الأسبوع
- خطة الأسبوع القادم
- توصيات الدعم

**Components Used:**
- Tenant list
- Weekly metrics cards
- Performance charts
- Issues table
- Action items

**Data Types:**
```typescript
type WeeklyTenant = {
  tenantId: string;
  tenantName: string;
  weekStart: string;
  weekEnd: string;
  revenue: number;
  orders: number;
  activeUsers: number;
}

type WeeklyReport = {
  week: string;
  tenants: WeeklyTenant[];
  highlights: string[];
  issues: string[];
  recommendations: string[];
}
```

---

## 🌐 Public Pages

### 18. **PublicMenuPage**
**Path:** `/m/:tenantSlug/:branchSlug/t/:token`  
**Route:** `<Route path="/m/:tenantSlug/:branchSlug/t/:token" element={<PublicMenuPage />} />`  
**File:** `apps/ops-web/src/pages/PublicMenuPage.tsx`  
**Protected:** ❌ No (Public - Token-based)  
**Description:** صفحة القائمة العامة للعملاء - قائمة المطعم العامة

**Features:**
- عرض قائمة الطعام العامة
- لا تتطلب تسجيل دخول
- عرض الأسعار والصور
- وصف تفصيلي للمنتجات
- البحث والفرز
- عرض الفئات
- معلومات متعددة اللغات (في المستقبل)
- QR Code للوصول للطلب

**Components Used:**
- Public menu display
- Category selector
- Product cards
- Search functionality
- Responsive layout

**Data Types:**
```typescript
type MenuResponse = {
  tenantName: string;
  branchName: string;
  categories: PublicCategory[];
  branchInfo?: BranchInfo;
}

type PublicCategory = {
  id: string;
  name: string;
  items: PublicMenuItem[];
}

type PublicMenuItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
}
```

---

## 🧩 Global Components

### 1. **OperationalStrip** Component
**File:** `apps/ops-web/src/components/OperationalStrip.tsx`  
**Description:** شريط المعلومات التشغيلية العام

**Features:**
- عرض المؤشرات الحالية
- حالة النظام
- الإشعارات
- معلومات الموظف الحالي
- زر التسجيل الخارجي

---

### 2. **CloseOfDayPanel** Component
**File:** `apps/ops-web/src/components/CloseOfDayPanel.tsx`  
**Description:** لوحة إغلاق الكاش اليومي

**Features:**
- ملخص المبيعات اليومية
- المبالغ المتوقعة والفعلية
- تسوية الفروقات
- تقرير إغلاق الكاش
- توقيع المسؤول

---

### 3. **DailyReportBody** Component
**File:** `apps/ops-web/src/pages/reports/DailyReportBody.tsx`  
**Description:** جسم التقرير اليومي

**Features:**
- عرض بيانات يومية مفصلة
- الرسوم البيانية
- الجداول
- تفسير البيانات

---

### 4. **TenantRollupSection** Component
**File:** `apps/ops-web/src/pages/reports/TenantRollupSection.tsx`  
**Description:** قسم تجميع بيانات المستأجرين

**Features:**
- تجميع البيانات من جميع الفروع
- عرض الملخص الشامل
- مقارنة الفروع

---

### 5. **Reports Helper Utilities**
**File:** `apps/ops-web/src/pages/reports/reports-shared.tsx`  
**Description:** أدوات مشتركة لالتقارير

**File:** `apps/ops-web/src/pages/reports/reports-cues.ts`  
**Description:** إشارات ومؤشرات التقارير

**File:** `apps/ops-web/src/pages/reports/reports-types.ts`  
**Description:** تعريفات الأنواع لالتقارير

---

## 🔄 Navigation Flow

```
┌─────────────────────────────────────────────┐
│          InitialRoute: /                    │
│     └─→ Redirects to /floor               │
└─────────────────────────────────────────────┘

                     │
                     ▼
┌─────────────────────────────────────────────┐
│          /login (LoginPage)                 │
│     ✓ No Auth Required                      │
│     ✓ Select Tenant                         │
│     ✓ Enter Credentials                     │
└─────────────────────────────────────────────┘
                     │
                     ▼
         ✓ Auth Success + Set Token
                     │
                     ▼
┌─────────────────────────────────────────────┐
│       /branch (BranchSelectPage)            │
│     ✓ Choose Operating Branch               │
│     ✓ Set Active Branch                     │
└─────────────────────────────────────────────┘
                     │
                     ▼
         ✓ Branch Selected + Stored
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      /floor (FloorPage) - MAIN HUB          │
│   ✓ Table Management                        │
│   ✓ Real-time Updates                       │
│   ✓ Order Creation                          │
└─────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    /menu        /kitchen           /bar
  (MenuPage)  (KitchenPage)    (KitchenPage)
    
         │
         ▼
    /orders
  (OpenOrdersPage)

         │
         ▼
/reports (ReportsPage)
    │        │        │
    ▼        ▼        ▼
 Daily   Weekly   Shift
Report  Handoff  Digest

    /customers (CustomerLookupPage)
    
    /stock (StockPage)
    
    /setup (SetupPage)

    /internal/* (Internal Pages - Behind Flag)
```

---

## 🔒 Authentication & Protection

### Protected Routes (Require Auth)
✅ `/floor` - FloorPage  
✅ `/menu` - MenuPage  
✅ `/kitchen` - KitchenPage (Kitchen)  
✅ `/bar` - KitchenPage (Bar)  
✅ `/reports` - ReportsPage  
✅ `/reports/shift-handoff` - ShiftHandoffPage  
✅ `/weekly-digest` - WeeklyDigestPage  
✅ `/orders` - OpenOrdersPage  
✅ `/customers` - CustomerLookupPage  
✅ `/stock` - StockPage  
✅ `/setup` - SetupPage  
✅ `/branch` - BranchSelectPage (Post-Login)  
✅ `/internal/*` - All Internal Pages (Behind Flag + Auth)  

### Public Routes (No Auth Required)
❌ `/login` - LoginPage  
❌ `/m/:tenantSlug/:branchSlug/t/:token` - PublicMenuPage  
❌ `/` - Root (Redirects to /floor)

---

## 📱 State Management Architecture

### Zustand Stores Used
- **authStore** - Authentication state (token, user, branch)
- **branchStore** - Current branch information
- **uiStore** - UI state (modals, panels, notifications)
- **cartStore** - Shopping cart state (for menu ordering)

### React Query (TanStack)
- **Queries** - Data fetching with caching
- **Mutations** - Server-side state updates
- **staleTime:** 15 seconds
- **refetchOnWindowFocus:** disabled

### Real-time Updates (Socket.IO)
- **Connection** - Per branch via BranchRealtimeProvider
- **Events** - 8 event types (orders, tickets, tables, etc.)
- **Debounce** - 320ms client-side batching
- **Fallback** - Adaptive polling (60s connected, 12s disconnected)

---

## 🎨 UI Framework & Styling

### Framework
- **React 19** - Component library
- **Vite 6** - Build tooling
- **TypeScript** - Type safety

### Styling
- **Tailwind CSS** - Utility-first CSS
- **Vite PWA** - Progressive Web App

### Component Libraries
- **React Router** - Navigation
- **TanStack React Query** - Data management
- **Socket.IO Client** - Real-time communication
- **Zustand** - State management

---

## 📊 Key Features by Page Type

### Point of Sale (POS) Pages
- FloorPage - Table management
- MenuPage - Product ordering
- OpenOrdersPage - Order summary
- CustomerLookupPage - Customer management

### Kitchen Operations
- KitchenPage (Kitchen) - Order tickets
- KitchenPage (Bar) - Beverage tickets

### Management & Reports
- ReportsPage - Analytics
- ShiftHandoffPage - Shift handoff report
- WeeklyDigestPage - Weekly summary
- StockPage - Inventory
- SetupPage - Initial configuration

### Admin/Support (Internal)
- SupportConsolePage - Support dashboard
- PilotPortfolioPage - Pilot projects
- PilotDetailPage - Pilot details
- PilotWeeklyPage - Pilot weekly report

### Public
- PublicMenuPage - Public menu display
- LoginPage - User authentication
- BranchSelectPage - Branch selection

---

## 🚀 Performance Optimizations

1. **Virtualization** - Large lists (28+ items)
   - Kitchen tickets
   - Open orders list

2. **Real-time Debouncing** - 320ms batching
3. **Adaptive Polling** - Dynamic based on connection
4. **Code Splitting** - Per-page components
5. **PWA Caching** - Offline capability

---

## 🔌 Integration Points

### Backend API Routes Connected To
- `GET /api/v1/branches` - Branch list
- `POST /api/v1/auth/login` - Authentication
- `GET /api/v1/tables` - Table data
- `GET /api/v1/menu` - Menu items
- `POST /api/v1/orders` - Create order
- `GET /api/v1/kitchen/tickets` - Kitchen tickets
- `GET /api/v1/reports/*` - Report data
- `GET /api/v1/stock` - Inventory
- `GET /api/v1/customers` - Customer search
- `GET /api/v1/internal/*` - Internal APIs

### WebSocket Events
- `order:created` - New order
- `ticket:updated` - Ticket status change
- `table:status` - Table occupancy
- `customer:updated` - Customer info change
- `inventory:updated` - Stock change
- `metrics:update` - Real-time metrics

---

## 📝 Notes & Best Practices

1. **RequireAuth Wrapper** - Use for protected routes
2. **Branch Isolation** - All data scoped to current branch
3. **Multi-tenant** - Tenant ID from auth store
4. **Error Handling** - Global error boundary + route-level
5. **Loading States** - Skeleton loaders on data fetch
6. **Responsive Design** - Mobile, tablet, desktop
7. **Accessibility** - WCAG compliance
8. **Offline Support** - PWA with Dexie cache

---

## 📄 File Structure Reference

```
apps/ops-web/src/
├── pages/
│   ├── LoginPage.tsx
│   ├── BranchSelectPage.tsx
│   ├── FloorPage.tsx
│   ├── MenuPage.tsx
│   ├── KitchenPage.tsx
│   ├── OpenOrdersPage.tsx
│   ├── CustomerLookupPage.tsx
│   ├── ReportsPage.tsx
│   ├── ShiftHandoffPage.tsx
│   ├── WeeklyDigestPage.tsx
│   ├── StockPage.tsx
│   ├── SetupPage.tsx
│   ├── PublicMenuPage.tsx
│   ├── SupportConsolePage.tsx
│   ├── PilotPortfolioPage.tsx
│   ├── PilotDetailPage.tsx
│   ├── PilotWeeklyPage.tsx
│   └── reports/
│       ├── DailyReportBody.tsx
│       ├── TenantRollupSection.tsx
│       ├── reports-shared.tsx
│       ├── reports-types.ts
│       └── reports-cues.ts
├── components/
│   ├── OperationalStrip.tsx
│   ├── CloseOfDayPanel.tsx
├── lib/
│   ├── auth-store.ts
│   ├── api.ts
│   └── ...
└── App.tsx
```

---

## 🔄 Route Summary Table

| Route | Component | Protection | Purpose |
|-------|-----------|-----------|---------|
| `/` | Redirect | - | Home redirect |
| `/login` | LoginPage | ❌ No | Authentication |
| `/branch` | BranchSelectPage | ✅ Auth | Branch selection |
| `/floor` | FloorPage | ✅ Auth | POS main hub |
| `/menu` | MenuPage | ✅ Auth | Order taking |
| `/kitchen` | KitchenPage | ✅ Auth | Kitchen station |
| `/bar` | KitchenPage | ✅ Auth | Bar station |
| `/orders` | OpenOrdersPage | ✅ Auth | Order overview |
| `/customers` | CustomerLookupPage | ✅ Auth | Customer mgmt |
| `/reports` | ReportsPage | ✅ Auth | Analytics |
| `/reports/shift-handoff` | ShiftHandoffPage | ✅ Auth | Shift report |
| `/weekly-digest` | WeeklyDigestPage | ✅ Auth | Weekly summary |
| `/stock` | StockPage | ✅ Auth | Inventory |
| `/setup` | SetupPage | ✅ Auth | Configuration |
| `/m/:tenantSlug/:branchSlug/t/:token` | PublicMenuPage | ❌ No | Public menu |
| `/internal/support` | SupportConsolePage | ✅ Auth+Flag | Support panel |
| `/internal/pilots` | PilotPortfolioPage | ✅ Auth+Flag | Pilot portfolio |
| `/internal/pilots/:tenantId` | PilotDetailPage | ✅ Auth+Flag | Pilot detail |
| `/internal/pilots/weekly` | PilotWeeklyPage | ✅ Auth+Flag | Pilot weekly |

---

**Documentation Updated:** March 23, 2026  
**Version:** 1.0.0  
**Frontend Version:** React 19 + Vite 6
