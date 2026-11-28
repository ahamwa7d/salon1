# أدوات البائع (تنصيب يدوي / احتياطي)

هذه الأدوات مخصّصة **للبائع** (أنت)، وليست جزءًا من الموقع المنشور.

> **المسار الأساسي للبيع هو التنصيب الذاتي بضغطة زر:** العميل يفتح `install.html`، يُدخل كود التفعيل،
> يربط حسابيه في GitHub وSupabase، ثم يتولّى سير عمل n8n إنشاء المستودع ومشروع Supabase والمخطط
> وحساب المديرة ونشر الموقع. راجع القسم 3.8 من `README.md` الرئيسي.
>
> الملفات هنا (`npm run new-client` وغيرها) هي **بديل يدوي** إن تعذّر التنصيب الذاتي أو أردت إنشاء نسخة
> على جهازك.

## المتطلبات

- Node.js 18 أو أحدث.
- حساب Supabase (منظّمة تملكها) وفوترة المشاريع إن لزم.
- **Personal Access Token** من: <https://supabase.com/dashboard/account/tokens>
  - التوكن يبدأ بـ `sbp_` ويُستخدم مرة واحدة على جهازك ولا يُحفظ في أي ملف.

## إنشاء عميل جديد

```bash
npm install       # مرة واحدة فقط
npm run new-client
```

أو على Windows: انقر نقرًا مزدوجًا على `setup/create-client.cmd` (يثبّت المتطلبات أول مرة ثم يفتح المعالج).

سيسألك:

| السؤال | ملاحظات |
| --- | --- |
| Supabase access token | الصقه، لا يُحفظ |
| المنظمة | تُقرأ تلقائيًا من التوكن |
| اسم العميل/المشروع | يُستخدم في اسم المشروع وفي اسم المجلد |
| المنطقة | الافتراضي `ap-southeast-1`؛ بديل قريب للبحرين: `me-central-1` |
| كلمة مرور قاعدة البيانات | تُولَّد قوية تلقائيًا إن تركتها فارغة |
| بريد وكلمة مرور المدير | يُنشأ الحساب مؤكدًا وجاهزًا للدخول |
| رابط الموقع | اختياري الآن؛ يُضبط في إعدادات Auth لاحقًا |

ثم اكتب `نعم` للتأكيد. تستغرق العملية 1–3 دقائق حسب سرعة إنشاء المشروع.

## المخرجات

```
clients/<slug>/
├── client.json        # ref, URL, region, admin email (بدون أسرار)
└── site/              # ارفع محتواه إلى الاستضافة
    ├── index.html
    ├── admin.html
    ├── privacy.html
    ├── terms.html
    ├── usage-policy.html
    ├── manifest.webmanifest
    ├── sw.js
    ├── config.js      # window.APP_CONFIG مضبوط على مشروع العميل
    ├── css/  js/  img/
    ├── robots.txt
    └── .htaccess
```

كلمة مرور القاعدة، كلمة مرور المدير، ومفتاح `service_role` تُطبع في نهاية التشغيل **مرة واحدة** — احفظها
في مدير كلمات مرور. لا تُكتب داخل `client.json` ولا داخل الموقع.

## ما الذي يتم تلقائيًا

1. `POST /v1/projects` — إنشاء مشروع Supabase.
2. انتظار الحالة `ACTIVE_HEALTHY`.
3. `POST /v1/projects/{ref}/database/query` — تشغيل `schema.sql` الجذري كاملًا (جداول، RLS، دوال،
   صفحات قانونية، `public.admins` + trigger، bucket الشعار).
4. جلب `anon` و`service_role`.
5. إنشاء مستخدم Auth للمدير (`email_confirm: true`) — الـ trigger يضيفه إلى `public.admins` تلقائيًا.
6. محاولة إيقاف التسجيل العام وضبط `Site URL` (إن فشلت تظهر ملاحظة للضبط اليدوي).
7. نسخ ملفات النشر فقط إلى `clients/<slug>/site` وكتابة `config.js` الجذري.

## خطوات ما بعد الإنشاء

1. ارفع محتوى `clients/<slug>/site` إلى استضافة العميل.
2. إن ظهرت ملاحظة `authConfigured: false`:
   - **Authentication → Sign In / Providers → Email**: أوقف *Allow new users to sign up*.
   - **Authentication → URL Configuration**: اضبط *Site URL* على نطاق العميل.
3. افتح الموقع → **دخول النظام** بحساب المدير (أو `admin.html`).
4. **الإدارة → الإعدادات**: ارفع الشعار، واملأ الاسم والهاتف والعنوان والساعات والخريطة والبريد
   والتواصل الاجتماعي وSEO.
5. **الإدارة → الصفحات**: راجع الصفحات القانونية (تصل معبّأة بنسخة ثنائية اللغة كاملة) وعدّل ما يلزم.

## الأمان

- لا تُرفع مجلدات `setup/` أو `clients/` أو `schema.sql` أو `salon-full-auto-installer.json` إلى أي
  استضافة (`.gitignore` يستثني `clients/`، و`.htaccess` يحجب المصادر).
- لا تضع التوكن أو `service_role` في `config.js` أو في المتصفح. `config.js` للمفتاح العام فقط.
- صلاحية التوكن: الأفضل إنشاء توكن مخصّص لهذه الأداة وحذفه بعد إنشاء العملاء.
- الأداة لا تستطيع إنشاء **حساب Supabase** نفسه؛ الحساب والمنظمة والفوترة تبقى بيدك عبر لوحة Supabase.
- ملف `config.js` الجذري **غير ملتزم** في Git؛ لا تدفعه أبدًا إلى مستودع القالب.

## ربط نسخة موقع بمشروع

كل صفحة تقرأ `window.APP_CONFIG` من `config.js` الجذري:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://<project-ref>.supabase.co',
  SUPABASE_ANON_KEY: '<publishable / anon key>',
  SALON_NAME: '<اسم الصالون>',
  GOOGLE_CLIENT_ID: '<oauth client id>.apps.googleusercontent.com'
}
```

`GOOGLE_CLIENT_ID` اختياري ويُفعّل النسخ الاحتياطي إلى Google Drive من لوحة الإدارة. هو معرّف عام
(OAuth client ID) وليس سرًّا؛ اتركه فارغًا إن لم تُفعّل الميزة.

لإنشائه تلقائيًا:

```bash
npm run configure
```

يسألك عن **Project URL** (أو الـ ref فقط) و**publishable / anon key** واسم الصالون و**Google OAuth Client ID**
(اختياري)، يتحقق منها، ثم يكتب `config.js` في جذر المشروع. يرفض `service_role` لأنه يتجاوز كل سياسات RLS.

> لا حاجة لـ `git checkout` بعد الآن: `config.js` مستثنى في `.gitignore` ولم يعد هناك `js/config.js`.

## تطبيق المخطط على مشروع موجود

إذا كان لديك مشروع Supabase جاهز (مثل المشروع التجريبي) وتريد فقط تحديث قاعدة البيانات:

```bash
npm run apply-schema
```

يسألك عن **Personal Access Token** و**Project ref** (أو الصق رابط المشروع)، ثم:

1. يطبّق `schema.sql` الجذري كاملًا عبر Management API.
2. يجلب `anon key` ويتحقق من: `public_info`، `public_legal_page` للصفحات الثلاث، ووجود bucket `branding`.

بديل بلا توكن: الصق محتوى `schema.sql` في **SQL Editor** واضغط Run (آمن للتكرار).

## تراخيص البيع

جدول التراخيص يعيش في **مشروع البائع الرئيسي** فقط، وليس في مشروع العميل:

1. نفّذ `supabase/salon-licenses.sql` مرة واحدة في المشروع الرئيسي.
2. الكود التجريبي `TEST-1234` يُضاف تلقائيًا بحالة `active`.
3. بعد نجاح التنصيب يعلّمه n8n بحالة `used` ويسجّل رابط الموقع ومشروع Supabase.
4. لإصدار كود جديد من SQL Editor:

```sql
select public.issue_salon_license('standard', 'اسم الصالون', 'owner@example.com', '+973...');
```

## بديل يدوي (إن تغيّرت واجهة الإدارة)

1. أنشئ المشروع من لوحة Supabase.
2. نفّذ `schema.sql` في **SQL Editor**.
3. أنشئ مستخدم Auth للمدير وأوقف التسجيل العام.
4. انسخ مجلد الموقع يدويًا، ثم `npm run configure` لكتابة `config.js` بقيم `Project URL` والمفتاح العام.

## اختبارات

```bash
npm run test:setup
```

تختبر منطق الإنشاء والانتظار وجلب المفاتيح وكتابة مجلد النشر بمحاكاة للشبكة، دون أي اتصال حقيقي بـ Supabase.
