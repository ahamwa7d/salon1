create extension if not exists pg_net with schema extensions;
create extension if not exists moddatetime with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  price numeric(10,3) not null check (price >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  username text,
  password_hash text,
  login_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  invoice_no text,
  client_name text not null,
  client_phone text not null,
  service_id uuid not null references public.services(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  appointment_date timestamptz not null,
  payment_proof text,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  total_price numeric(10,3) not null default 0 check (total_price >= 0),
  commission_amount numeric(10,3) not null default 0 check (commission_amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

-- Official invoice numbers: 6 digits, strictly sequential, never reused.
-- The sequence is only advanced on insert, so a cancelled booking never frees
-- its number. Values above 999999 simply grow to 7 digits.
create sequence if not exists public.invoice_number_seq start with 1 increment by 1;

create table if not exists public.settings (
  setting_key text primary key,
  setting_value text,
  updated_at timestamptz not null default now()
);

-- Staff app sessions. Only a SHA-256 hash of the token is stored, so a database
-- leak cannot be replayed against the API. Tokens are created only by
-- public.staff_login() after username, password and access code all verify.
drop table if exists public.staff_sessions cascade;
create table public.staff_sessions (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

-- Failed staff logins, used for throttling brute-force attempts.
create table if not exists public.staff_login_attempts (
  id bigint generated always as identity primary key,
  username text,
  created_at timestamptz not null default now()
);
create index if not exists idx_staff_login_attempts on public.staff_login_attempts (username, created_at desc);

-- Outbound WhatsApp log (kept for diagnostics; request/response details are
-- visible to admins through public.admin_whatsapp_log()).
create table if not exists public.whatsapp_log (
  id bigint generated always as identity primary key,
  appointment_id uuid references public.appointments(id) on delete set null,
  recipient text not null,
  phone text,
  message text,
  request_id bigint,
  created_at timestamptz not null default now()
);

-- Outbound Google Sheets rows (via an Apps Script Web App). Each booking and
-- each status change is queued here so the admin can see what was sent.
create table if not exists public.sheets_log (
  id bigint generated always as identity primary key,
  appointment_id uuid references public.appointments(id) on delete set null,
  kind text not null default 'booking',
  request_id bigint,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sheets_log_created on public.sheets_log (created_at desc);

-- Upgrade safety: if these tables were created earlier from a minimal schema,
-- CREATE TABLE IF NOT EXISTS would leave them without the extra columns the
-- app relies on. ADD COLUMN IF NOT EXISTS makes this script safe to re-run.
alter table public.services add column if not exists is_active boolean not null default true;
alter table public.services add column if not exists created_at timestamptz not null default now();
alter table public.services add column if not exists image_url text;

-- Landing-page pictures. The services editor only manages the Arabic name,
-- English name and price; pictures are mapped automatically from the name, and
-- these defaults cover the usual salon services.
update public.services set image_url = 'img/services/nails.jpg' where image_url is null and (name_en ilike '%nail%' or name_en ilike '%gel%' or name_en ilike '%acrylic%' or name_en ilike '%manicure%' or name_ar like '%أظافر%' or name_ar like '%اظافر%' or name_ar like '%مانيكير%' or name_ar like '%جل%');
update public.services set image_url = 'img/services/pedicure.jpg' where image_url is null and (name_en ilike '%pedicure%' or name_ar like '%باديكير%');
update public.services set image_url = 'img/services/lashes.jpg' where image_url is null and (name_en ilike '%lash%' or name_en ilike '%eyelash%' or name_ar like '%رموش%');
update public.services set image_url = 'img/services/brows.jpg' where image_url is null and (name_en ilike '%brow%' or name_en ilike '%thread%' or name_ar like '%حواجب%' or name_ar like '%حاجب%');
update public.services set image_url = 'img/services/makeup.jpg' where image_url is null and (name_en ilike '%makeup%' or name_en ilike '%make-up%' or name_ar like '%مكياج%' or name_ar like '%ميكاب%');
update public.services set image_url = 'img/services/bridal.jpg' where image_url is null and (name_en ilike '%bridal%' or name_en ilike '%wedding%' or name_ar like '%عروس%' or name_ar like '%زفاف%');
update public.services set image_url = 'img/services/facial.jpg' where image_url is null and (name_en ilike '%facial%' or name_en ilike '%skin%' or name_en ilike '%clean%' or name_ar like '%بشرة%' or name_ar like '%تنظيف%');
update public.services set image_url = 'img/services/waxing.jpg' where image_url is null and (name_en ilike '%wax%' or name_ar like '%شمع%' or name_ar like '%إزالة%' or name_ar like '%ازالة%');
update public.services set image_url = 'img/services/hairwash.jpg' where image_url is null and (name_en ilike '%hair spa%' or name_en ilike '%hair wash%' or name_en ilike '%keratin%' or name_ar like '%حمام كريمي%' or name_ar like '%بروتين%');
update public.services set image_url = 'img/services/massage.jpg' where image_url is null and (name_en ilike '%massage%' or name_en ilike '%spa%' or name_ar like '%مساج%' or name_ar like '%تدليك%');
update public.services set image_url = 'img/services/color.jpg' where image_url is null and (name_en ilike '%color%' or name_en ilike '%colour%' or name_en ilike '%highlight%' or name_en ilike '%balayage%' or name_ar like '%صبغ%' or name_ar like '%هاي لايت%');
update public.services set image_url = 'img/services/hair.jpg' where image_url is null and (name_en ilike '%hair%' or name_en ilike '%cut%' or name_en ilike '%style%' or name_en ilike '%blow%' or name_ar like '%شعر%' or name_ar like '%قص%' or name_ar like '%تصفيف%');
update public.services set image_url = 'img/services/nails.jpg' where image_url is null;
alter table public.staff add column if not exists phone text;
alter table public.staff add column if not exists is_active boolean not null default true;
alter table public.staff add column if not exists created_at timestamptz not null default now();
alter table public.staff add column if not exists username text;
alter table public.staff add column if not exists password_hash text;
alter table public.staff add column if not exists login_enabled boolean not null default false;
create unique index if not exists idx_staff_username on public.staff (lower(username)) where username is not null;
alter table public.appointments add column if not exists notes text;
alter table public.appointments add column if not exists created_at timestamptz not null default now();
alter table public.appointments add column if not exists invoice_no text;
create unique index if not exists idx_appointments_invoice_no on public.appointments (invoice_no) where invoice_no is not null;

-- Give existing rows sequential numbers, then push the sequence past them so a
-- number is never reused. Safe to re-run: only rows without a number are filled.
do $$
declare
  v_max integer;
  v_last integer;
  v_called boolean;
  v_next integer;
begin
  with numbered as (
    select id, row_number() over (order by created_at asc, id asc) as rn
    from public.appointments
    where invoice_no is null
  )
  update public.appointments a
  set invoice_no = lpad(n.rn::text, 6, '0')
  from numbered n
  where a.id = n.id;

  select coalesce(max(invoice_no::integer), 0) into v_max
  from public.appointments
  where invoice_no ~ '^[0-9]+$';

  -- Move the sequence forward only. It is never rewound, so a number that was
  -- ever issued (even for a row that was later deleted) is never reused.
  select last_value, is_called into v_last, v_called from public.invoice_number_seq;
  v_next := greatest(v_max, case when v_called then v_last else 0 end);
  if v_next > 0 then
    perform setval('public.invoice_number_seq', v_next, true);
  end if;
end $$;
alter table public.settings add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_status_date on public.appointments (status, appointment_date);
create index if not exists idx_appointments_staff on public.appointments (staff_id);
create index if not exists idx_appointments_service on public.appointments (service_id);

alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.appointments enable row level security;
alter table public.settings enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.staff_login_attempts enable row level security;
alter table public.whatsapp_log enable row level security;
alter table public.sheets_log enable row level security;

-- Anonymous access is closed: only authenticated admins read tables directly,
-- and staff read through token-checked RPCs further down.
drop policy if exists services_select_all on public.services;
drop policy if exists services_select_public on public.services;

drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services for all to authenticated using (true) with check (true);

drop policy if exists staff_select_all on public.staff;
drop policy if exists staff_select_public on public.staff;
drop policy if exists staff_select_admin on public.staff;
create policy staff_select_admin on public.staff for select to authenticated using (true);

drop policy if exists staff_admin_write on public.staff;
create policy staff_admin_write on public.staff for all to authenticated using (true) with check (true);

-- The POS no longer exposes staff data anonymously: staff lists come from
-- public.staff_list(token) and services from public.staff_services(token).
drop function if exists public.public_staff();

drop policy if exists appointments_insert_anon on public.appointments;

drop policy if exists appointments_insert_authenticated on public.appointments;
create policy appointments_insert_authenticated on public.appointments for insert to authenticated with check (true);

drop policy if exists appointments_select_admin on public.appointments;
create policy appointments_select_admin on public.appointments for select to authenticated using (true);

drop policy if exists appointments_update_admin on public.appointments;
create policy appointments_update_admin on public.appointments for update to authenticated using (true) with check (true);

drop policy if exists appointments_delete_admin on public.appointments;
create policy appointments_delete_admin on public.appointments for delete to authenticated using (true);

drop policy if exists settings_select_public on public.settings;
drop policy if exists settings_select_admin on public.settings;
create policy settings_select_admin on public.settings for select to authenticated using (true);

drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings for all to authenticated using (true) with check (true);

drop policy if exists whatsapp_log_admin_select on public.whatsapp_log;
create policy whatsapp_log_admin_select on public.whatsapp_log for select to authenticated using (true);

insert into public.settings (setting_key, setting_value) values
  -- Deliberately blank for a new white-label install: every client fills these
  -- from Admin → Settings. Existing installations keep their values because of
  -- "on conflict do nothing".
  ('salon_name', ''),
  ('salon_phone', ''),
  ('salon_address', ''),
  ('salon_hours', '10:00 AM – 8:00 PM'),
  ('map_url', ''),
  ('admin_whatsapp', ''),
  ('vat_rate', '10'),
  ('vat_inclusive', 'true'),
  ('vat_number', ''),
  ('evolution_api_url', ''),
  ('evolution_api_key', ''),
  ('evolution_instance', ''),
  ('google_sheet_url', ''),
  -- White-label brand identity (all editable from Admin → Settings).
  ('logo_url', ''),
  ('salon_email', ''),
  ('brand_tagline_ar', 'جمال · عناية · ثقة'),
  ('brand_tagline_en', 'Beauty · Care · Confidence'),
  ('hero_image_url', ''),
  ('about_image_url', ''),
  ('about_text_ar', ''),
  ('about_text_en', ''),
  ('social_instagram', ''),
  ('social_tiktok', ''),
  ('social_facebook', ''),
  ('social_snapchat', ''),
  ('social_x', ''),
  ('social_youtube', ''),
  ('social_whatsapp', ''),
  ('seo_title_ar', ''),
  ('seo_title_en', ''),
  ('seo_description_ar', ''),
  ('seo_description_en', '')
on conflict (setting_key) do nothing;

-- Public branding: only the salon name, so the login gate can show it.
-- Nothing else from settings is exposed to anonymous visitors.
create or replace function public.public_branding()
returns table (salon_name text)
language sql
stable
security definer
set search_path = public
as $$
  select (select setting_value from public.settings where setting_key = 'salon_name');
$$;

revoke all on function public.public_branding() from public;
grant execute on function public.public_branding() to anon, authenticated;

-- Public contact details and brand identity for the landing page and the legal
-- pages. The manager controls all of them from the admin dashboard.
-- The return columns changed after the first release, so the function is
-- dropped first to keep this script safe to re-run on an older database.
drop function if exists public.public_info();
create or replace function public.public_info()
returns table (
  salon_name text,
  salon_phone text,
  salon_address text,
  salon_hours text,
  map_url text,
  salon_email text,
  logo_url text,
  hero_image_url text,
  about_image_url text,
  tagline_ar text,
  tagline_en text,
  about_ar text,
  about_en text,
  social_instagram text,
  social_tiktok text,
  social_facebook text,
  social_snapchat text,
  social_x text,
  social_youtube text,
  social_whatsapp text,
  seo_title_ar text,
  seo_title_en text,
  seo_description_ar text,
  seo_description_en text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select setting_value from public.settings where setting_key = 'salon_name'),
    (select setting_value from public.settings where setting_key = 'salon_phone'),
    (select setting_value from public.settings where setting_key = 'salon_address'),
    (select setting_value from public.settings where setting_key = 'salon_hours'),
    (select setting_value from public.settings where setting_key = 'map_url'),
    (select setting_value from public.settings where setting_key = 'salon_email'),
    (select setting_value from public.settings where setting_key = 'logo_url'),
    (select setting_value from public.settings where setting_key = 'hero_image_url'),
    (select setting_value from public.settings where setting_key = 'about_image_url'),
    (select setting_value from public.settings where setting_key = 'brand_tagline_ar'),
    (select setting_value from public.settings where setting_key = 'brand_tagline_en'),
    (select setting_value from public.settings where setting_key = 'about_text_ar'),
    (select setting_value from public.settings where setting_key = 'about_text_en'),
    (select setting_value from public.settings where setting_key = 'social_instagram'),
    (select setting_value from public.settings where setting_key = 'social_tiktok'),
    (select setting_value from public.settings where setting_key = 'social_facebook'),
    (select setting_value from public.settings where setting_key = 'social_snapchat'),
    (select setting_value from public.settings where setting_key = 'social_x'),
    (select setting_value from public.settings where setting_key = 'social_youtube'),
    (select setting_value from public.settings where setting_key = 'social_whatsapp'),
    (select setting_value from public.settings where setting_key = 'seo_title_ar'),
    (select setting_value from public.settings where setting_key = 'seo_title_en'),
    (select setting_value from public.settings where setting_key = 'seo_description_ar'),
    (select setting_value from public.settings where setting_key = 'seo_description_en');
$$;

revoke all on function public.public_info() from public;
grant execute on function public.public_info() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Legal pages (privacy / terms / usage), editable from the admin dashboard
-- ---------------------------------------------------------------------
-- Body text is HTML authored by the salon manager. The page shell wraps it in
-- cards and replaces placeholders such as {salon_name} and {phone} with the
-- current settings, so the policies always match the live contact details.
insert into public.settings (setting_key, setting_value) values
  ('legal_privacy_title_ar', 'سياسة الخصوصية'),
  ('legal_privacy_title_en', 'Privacy Policy'),
  ('legal_privacy_intro_ar', 'خصوصيتك تهمّنا، وهذه السياسة توضح كيف نتعامل مع بياناتك.'),
  ('legal_privacy_intro_en', 'Your privacy matters. This policy explains how we handle your data.'),
  ('legal_privacy_body_ar', $legal$<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">1. من نحن</h2><p class="mt-2">تخص هذه السياسة {salon_name} ({address})، وتوضح كيف نجمع بياناتك ونستخدمها ونحميها عند استخدامك للموقع أو حجز موعد أونلاين.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">2. البيانات التي نجمعها</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>الاسم ورقم الهاتف الذي تدخلينه في نموذج الحجز.</li><li>تفاصيل الموعد: الخدمة، الموظفة، التاريخ والوقت، والملاحظات الاختيارية.</li><li>رقم الفاتورة ومبلغ الخدمة وحالة الحجز لأغراض المحاسبة والضريبة.</li><li>بيانات تقنية محدودة مثل لغة الواجهة المختارة، تُحفظ في متصفحك فقط.</li></ul><p class="mt-2">لا نطلب بيانات بطاقات بنكية عبر هذا الموقع، ولا نجمع بيانات دفع إلكتروني.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">3. لماذا نستخدم بياناتك</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>تسجيل الحجز وتأكيده والتواصل معك بخصوصه.</li><li>إصدار الفاتورة الضريبية الرسمية وإرسالها عبر واتساب.</li><li>إدارة المواعيد والخدمات والالتزام بالمتطلبات المحاسبية والضريبية.</li><li>تحسين جودة الخدمة والتعامل مع أي استفسار أو شكوى.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">4. المشاركة مع أطراف أخرى</h2><p class="mt-2">لا نبيع بياناتك. قد تُشارك بيانات الحجز فقط مع: مزوّد خدمة واتساب لإرسال تأكيد الحجز والفاتورة، وأدوات إدارة الحجوزات المفعّلة، والجهات الرسمية عند وجود التزام قانوني أو ضريبي.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">5. مدة الاحتفاظ</h2><p class="mt-2">نحتفظ بسجلات الحجز والفواتير للمدة اللازمة لأغراض المحاسبة والضريبة وفق الأنظمة المعمول بها، ثم تُحذف أو تُجهَّل البيانات غير المطلوبة.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">6. حماية البيانات</h2><p class="mt-2">نستخدم اتصالاً مشفّراً (HTTPS)، وقاعدة بيانات محمية بصلاحيات دقيقة، ولا يمكن الوصول إلى بيانات الحجوزات من المتصفح إلا من خلال واجهات محدودة ومحمية. الوصول إلى لوحة الإدارة مقصور على الحسابات المصرّح لها.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">7. ملفات تعريف الارتباط والتخزين المحلي</h2><p class="mt-2">لا نستخدم ملفات تتبّع إعلانية. نستخدم التخزين المحلي في متصفحك لتذكّر اللغة المختارة وجلسة دخول الموظفات فقط. يمكنك مسحها من إعدادات المتصفح في أي وقت.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">8. حقوقك</h2><p class="mt-2">يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها (مع مراعاة الالتزامات المحاسبية)، أو سحب موافقتك على التواصل التسويقي عبر {phone} أو {email}.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">9. التحديثات</h2><p class="mt-2">قد نحدّث هذه السياسة من وقت لآخر، وسيظهر تاريخ آخر تحديث أعلى الصفحة. استمرارك في استخدام الموقع بعد التحديث يعني موافقتك على النسخة المحدّثة.</p></section>$legal$),
  ('legal_privacy_body_en', $legal$<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">1. Who we are</h2><p class="mt-2">This policy applies to {salon_name} ({address}). It explains how we collect, use and protect your data when you use this website or book an appointment online.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">2. Data we collect</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>The name and phone number you enter in the booking form.</li><li>Appointment details: service, staff member, date, time and optional notes.</li><li>Invoice number, service amount and booking status for accounting and tax purposes.</li><li>Limited technical data such as your chosen interface language, stored only in your browser.</li></ul><p class="mt-2">We do not request bank card details through this website and do not collect online payment data.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">3. Why we use your data</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>To register and confirm your booking and communicate with you about it.</li><li>To issue the official tax invoice and send it via WhatsApp.</li><li>To manage appointments and services and comply with accounting and tax requirements.</li><li>To improve service quality and handle any enquiry or complaint.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">4. Sharing with others</h2><p class="mt-2">We never sell your data. Booking details may be shared only with: the WhatsApp messaging provider used to send booking confirmations and invoices, the booking-management tools enabled for the business, and official authorities where legally or fiscally required.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">5. Retention</h2><p class="mt-2">Booking and invoice records are kept for the period required for accounting and tax purposes under applicable regulations. Data that is no longer required is deleted or anonymised.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">6. Data protection</h2><p class="mt-2">We use encrypted connections (HTTPS) and a database protected by strict permissions. Booking data is never readable directly from the browser; access is limited to narrow, protected interfaces, and the admin dashboard is restricted to authorised accounts.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">7. Cookies and local storage</h2><p class="mt-2">We do not use advertising trackers. Local storage in your browser is used only to remember the selected language and staff login sessions. You may clear it from your browser settings at any time.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">8. Your rights</h2><p class="mt-2">You may request access to, correction of, or deletion of your data (subject to accounting obligations), or withdraw consent for marketing communication by contacting us on {phone} or {email}.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">9. Updates</h2><p class="mt-2">We may update this policy from time to time, and the last-updated date will appear at the top of the page. Continuing to use the website after an update means you accept the revised version.</p></section>$legal$),
  ('legal_terms_title_ar', 'شروط الاستخدام'),
  ('legal_terms_title_en', 'Terms of Use'),
  ('legal_terms_intro_ar', 'شروط واضحة لحجز مريح.'),
  ('legal_terms_intro_en', 'Clear terms for a smooth booking.'),
  ('legal_terms_body_ar', $legal$<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">1. قبول الشروط</h2><p class="mt-2">باستخدامك هذا الموقع أو إرسال طلب حجز، فإنك توافقين على هذه الشروط وعلى سياسة الخصوصية. إذا لم توافقي على أي منها، يرجى عدم استخدام خدمة الحجز الأونلاين.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">2. الحجز والمواعيد</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>الحجز الأونلاين طلب مبدئي، ويُعد مؤكداً بعد تواصل {salon_name} معك.</li><li>يجب إدخال اسم صحيح ورقم هاتف فعّال، وقد يُلغى الحجز إذا تعذّر التواصل.</li><li>يرجى الحضور قبل الموعد بخمس دقائق على الأقل. قد يؤدي التأخر لأكثر من 15 دقيقة إلى إعادة ترتيب الموعد حسب توفر الفريق.</li><li>لتعديل أو إلغاء الموعد، يرجى التواصل معنا في أقرب وقت ممكن على {phone}.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">3. الأسعار والدفع والضريبة</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>جميع الأسعار بالدينار البحريني (د.ب) وتشمل ضريبة القيمة المضافة وفق الإعدادات المعتمدة.</li><li>قد تختلف الأسعار حسب الخدمة الإضافية أو طول الشعر أو المنتجات المستخدمة، ويتم إبلاغك قبل تنفيذ الخدمة.</li><li>الدفع داخل المكان نقداً أو عبر وسائل الدفع المتاحة، وتصدر الفاتورة الضريبية الرسمية بعد إتمام الخدمة.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">4. الخدمات والسلامة</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>يرجى إخبار الفريق بأي حساسية أو حالة جلدية أو حمل أو دواء قبل بدء الخدمة.</li><li>بعض الخدمات قد لا تناسب حالات معينة، ويحق لنا اقتراح بديل أو الاعتذار عن الخدمة حفاظاً على سلامتك.</li><li>النتائج تختلف من شخص لآخر، ولا يمكن ضمان نتيجة مطابقة لصورة مرجعية بشكل كامل.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">5. الإلغاء والتأخير</h2><p class="mt-2">يمكنك إلغاء أو تعديل الموعد بالتواصل معنا. في حال التكرار المتكرر لعدم الحضور دون إشعار، قد يتم تقييد الحجز الأونلاين مستقبلاً.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">6. حدود المسؤولية</h2><p class="mt-2">نبذل عناية معقولة في تقديم الخدمات وفي دقة المعلومات المنشورة. لا نتحمل مسؤولية أي انقطاع تقني خارق للسيطرة أو أي استخدام غير صحيح للموقع.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">7. التعديلات</h2><p class="mt-2">قد نحدّث هذه الشروط من وقت لآخر، ويظهر تاريخ آخر تحديث أعلى الصفحة. استمرارك في استخدام الموقع بعد التحديث يعني موافقتك على النسخة المحدّثة.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">8. التواصل</h2><p class="mt-2">لأي استفسار بخصوص هذه الشروط: {phone} · {email} · {address}.</p></section>$legal$),
  ('legal_terms_body_en', $legal$<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">1. Acceptance of terms</h2><p class="mt-2">By using this website or submitting a booking request, you agree to these terms and to the Privacy Policy. If you do not agree with any part of them, please do not use the online booking service.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">2. Bookings and appointments</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>An online booking is an initial request and is confirmed after {salon_name} contacts you.</li><li>You must provide a correct name and a working phone number; a booking may be cancelled if we cannot reach you.</li><li>Please arrive at least five minutes before your appointment. A delay of more than 15 minutes may require rescheduling, subject to team availability.</li><li>To change or cancel an appointment, please contact us as early as possible on {phone}.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">3. Prices, payment and tax</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>All prices are in Bahraini Dinar (BHD) and include VAT according to the configured settings.</li><li>Prices may vary with additional services, hair length or products used; you will be informed before the service is performed.</li><li>Payment is made on site by cash or the available payment methods, and the official tax invoice is issued after the service is completed.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">4. Services and safety</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>Please tell the team about any allergy, skin condition, pregnancy or medication before the service starts.</li><li>Some services may not suit certain conditions, and we may suggest an alternative or decline the service to protect your safety.</li><li>Results vary between individuals, and an exact match to a reference photo cannot be guaranteed.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">5. Cancellation and delays</h2><p class="mt-2">You can cancel or change an appointment by contacting us. Repeated no-shows without notice may result in online booking being restricted in the future.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">6. Limitation of liability</h2><p class="mt-2">We take reasonable care in providing services and in the accuracy of published information. We are not liable for technical interruptions beyond our control or for improper use of the website.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">7. Changes</h2><p class="mt-2">We may update these terms from time to time, and the last-updated date will appear at the top of the page. Continuing to use the website after an update means you accept the revised version.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">8. Contact</h2><p class="mt-2">For any question about these terms: {phone} · {email} · {address}.</p></section>$legal$),
  ('legal_usage_title_ar', 'سياسة الاستخدام'),
  ('legal_usage_title_en', 'Usage Policy'),
  ('legal_usage_intro_ar', 'استخدام عادل وآمن للموقع وخدمة الحجز.'),
  ('legal_usage_intro_en', 'Fair and safe use of the website and booking service.'),
  ('legal_usage_body_ar', $legal$<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">1. الاستخدام المقبول</h2><p class="mt-2">هذا الموقع مخصص للاطلاع على الخدمات وحجز المواعيد وإدارة حسابك مع {salon_name}. يُمنع استخدامه لأي غرض غير قانوني أو غير مصرّح به.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">2. الحسابات والدخول</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>يبقى اسم المستخدم وكلمة المرور ورمز الوصول الخاص بالموظفات مسؤوليتك الشخصية.</li><li>يُمنع مشاركة بيانات الدخول أو استخدام حساب شخص آخر.</li><li>يجب إبلاغ الإدارة فوراً عند الاشتباه في أي استخدام غير مصرّح به.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">3. دقة البيانات</h2><p class="mt-2">أنت مسؤولة عن صحة الاسم ورقم الهاتف وتفاصيل الحجز التي تدخلينها. البيانات غير الصحيحة قد تؤدي إلى إلغاء الموعد أو تعذّر التواصل.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">4. السلوك الممنوع</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>محاولة الوصول إلى بيانات أو حسابات لا تخصك.</li><li>إرسال حجوزات وهمية أو مكررة أو برقم هاتف غير صحيح.</li><li>استخدام برامج آلية أو طرق تؤثر على أداء الموقع أو أمنه.</li><li>نشر محتوى مسيء أو مخالف للقانون عبر أي وسيلة تواصل تابعة للموقع.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">5. الملكية الفكرية</h2><p class="mt-2">جميع النصوص والصور والتصاميم والشعارات في هذا الموقع مملوكة لـ {salon_name} أو مرخّصة لها، ولا يجوز نسخها أو إعادة استخدامها دون إذن مكتوب.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">6. إساءة الاستخدام</h2><p class="mt-2">نحتفظ بحق رفض أو إلغاء أي حجز أو تعليق الوصول إلى الموقع عند وجود إساءة استخدام أو مخالفة لهذه السياسة، مع إبلاغ الجهات المختصة عند الحاجة.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">7. التواصل</h2><p class="mt-2">لأي استفسار حول هذه السياسة: {phone} · {email} · {address}.</p></section>$legal$),
  ('legal_usage_body_en', $legal$<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">1. Acceptable use</h2><p class="mt-2">This website is provided to browse services, book appointments and manage your relationship with {salon_name}. It may not be used for any unlawful or unauthorised purpose.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">2. Accounts and access</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>You are responsible for keeping your username, password and staff access code confidential.</li><li>Do not share login details or use another person's account.</li><li>Notify management immediately if you suspect any unauthorised access.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">3. Accuracy of information</h2><p class="mt-2">You are responsible for the accuracy of the name, phone number and booking details you provide. Incorrect information may lead to cancellation or us being unable to contact you.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">4. Prohibited behaviour</h2><ul class="mt-2 list-disc space-y-1 ps-5"><li>Attempting to access data or accounts that do not belong to you.</li><li>Submitting fake, duplicate or invalid-phone bookings.</li><li>Using automated tools or any method that harms the website's performance or security.</li><li>Posting offensive or unlawful content through any contact channel linked to the website.</li></ul></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">5. Intellectual property</h2><p class="mt-2">All text, images, designs and logos on this website are owned by or licensed to {salon_name} and may not be copied or reused without written permission.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">6. Misuse</h2><p class="mt-2">We reserve the right to refuse or cancel any booking or suspend website access where misuse or a breach of this policy occurs, and to report matters to the relevant authorities when necessary.</p></section>
<section class="card p-5"><h2 class="text-base font-extrabold text-gray-900">7. Contact</h2><p class="mt-2">For any question about this policy: {phone} · {email} · {address}.</p></section>$legal$)
on conflict (setting_key) do nothing;

create or replace function public.public_legal_page(p_slug text)
returns table (
  slug text,
  title_ar text,
  title_en text,
  intro_ar text,
  intro_en text,
  body_ar text,
  body_en text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p_slug,
    (select setting_value from public.settings where setting_key = 'legal_' || p_slug || '_title_ar'),
    (select setting_value from public.settings where setting_key = 'legal_' || p_slug || '_title_en'),
    (select setting_value from public.settings where setting_key = 'legal_' || p_slug || '_intro_ar'),
    (select setting_value from public.settings where setting_key = 'legal_' || p_slug || '_intro_en'),
    (select setting_value from public.settings where setting_key = 'legal_' || p_slug || '_body_ar'),
    (select setting_value from public.settings where setting_key = 'legal_' || p_slug || '_body_en'),
    (select updated_at from public.settings where setting_key = 'legal_' || p_slug || '_body_ar')
  where p_slug in ('privacy', 'terms', 'usage');
$$;

revoke all on function public.public_legal_page(text) from public;
grant execute on function public.public_legal_page(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Brand images (logo, hero, about) in a public Storage bucket.
-- Anyone may read the images; only signed-in admins may upload or replace.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'branding');

drop policy if exists branding_admin_insert on storage.objects;
create policy branding_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'branding');

drop policy if exists branding_admin_update on storage.objects;
create policy branding_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'branding') with check (bucket_id = 'branding');

drop policy if exists branding_admin_delete on storage.objects;
create policy branding_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'branding');

create or replace function public.set_appointment_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric(10,3);
  v_rate numeric(5,2);
begin
  select price into v_price from public.services where id = new.service_id;
  select commission_rate into v_rate from public.staff where id = new.staff_id;
  if v_price is null then
    raise exception 'invalid service_id';
  end if;
  new.total_price := v_price;
  new.commission_amount := round(v_price * coalesce(v_rate, 0) / 100.0, 3);
  -- Never trust a client-supplied status on insert: every new booking starts
  -- as pending and can only be completed/cancelled by an authenticated admin.
  new.status := 'pending';
  -- Official invoice number is always assigned by the database, never by the
  -- client, so numbers stay unique and sequential.
  new.invoice_no := lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_appointment_totals on public.appointments;
create trigger trg_set_appointment_totals
before insert on public.appointments
for each row execute function public.set_appointment_totals();

drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at
before update on public.settings
for each row execute function extensions.moddatetime(updated_at);

-- =====================================================================
-- Staff access (username + password + shared app code)
-- Staff do NOT use Supabase Auth. Only the admin logs in with Supabase Auth.
-- =====================================================================
-- Dropped before re-creation because CREATE OR REPLACE cannot change a
-- function's result columns (OUT parameters). This keeps the script safe to
-- run over an older version of the schema. They are recreated below.
drop function if exists public.staff_login(text, text, text);
drop function if exists public.staff_me(uuid);
drop function if exists public.staff_services(uuid);
drop function if exists public.staff_settings(uuid);
drop function if exists public.staff_list(uuid);
drop function if exists public.staff_create_booking(uuid, text, text, uuid, uuid, timestamptz, text, text);
drop function if exists public.staff_appointments(uuid);
drop function if exists public.staff_set_appointment_status(uuid, uuid, text);
drop function if exists public.staff_logout(uuid);
drop function if exists public.invoice_text(uuid);
drop function if exists public.invoice_for(uuid, uuid);
drop function if exists public.public_services();
drop function if exists public.public_staff_list();
drop function if exists public.public_booking(text, text, uuid, uuid, timestamptz, text);
drop function if exists public.sheet_row(uuid);
drop function if exists public.sheet_send(uuid, text);
-- The trigger must go before its function, otherwise DROP FUNCTION fails on a re-run.
drop trigger if exists trg_sync_appointment_sheet on public.appointments;
drop function if exists public.sync_appointment_sheet();
drop function if exists public.admin_test_sheet();
drop function if exists public.admin_sync_all_to_sheet();
drop function if exists public.admin_sheet_log();

-- The duration was removed from services (name, price and picture only).
alter table public.services drop column if exists duration;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select auth.uid() is not null $$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admin only: set or clear a staff member's username/password.
create or replace function public.admin_set_staff_login(
  p_staff_id uuid,
  p_username text,
  p_password text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text;
  v_password text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id) then
    raise exception 'staff_not_found';
  end if;

  v_username := nullif(lower(btrim(coalesce(p_username, ''))), '');
  v_password := btrim(coalesce(p_password, ''));

  if v_username is not null and v_username !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'invalid_username';
  end if;
  if v_username is not null and exists (
    select 1 from public.staff
    where lower(username) = v_username and id <> p_staff_id
  ) then
    raise exception 'username_taken';
  end if;
  if v_password <> '' and length(v_password) < 6 then
    raise exception 'weak_password';
  end if;

  if v_password <> '' then
    update public.staff
      set username = v_username,
          password_hash = crypt(v_password, gen_salt('bf')),
          login_enabled = coalesce(p_enabled, false)
      where id = p_staff_id;
  else
    update public.staff
      set username = v_username,
          login_enabled = coalesce(p_enabled, false)
      where id = p_staff_id;
  end if;

  -- A login is only usable when username + password both exist.
  update public.staff
    set login_enabled = false
    where id = p_staff_id
      and (username is null or password_hash is null);
end;
$$;

revoke all on function public.admin_set_staff_login(uuid, text, text, boolean) from public;
grant execute on function public.admin_set_staff_login(uuid, text, text, boolean) to authenticated;

-- Admin only: set the shared access code that staff must type at login.
create or replace function public.admin_set_staff_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if coalesce(btrim(p_code), '') = '' then
    delete from public.settings where setting_key = 'staff_app_code_hash';
    return;
  end if;

  if length(btrim(p_code)) < 4 then
    raise exception 'weak_code';
  end if;

  insert into public.settings (setting_key, setting_value)
  values ('staff_app_code_hash', crypt(btrim(p_code), gen_salt('bf')))
  on conflict (setting_key) do update set setting_value = excluded.setting_value;
end;
$$;

revoke all on function public.admin_set_staff_code(text) from public;
grant execute on function public.admin_set_staff_code(text) to authenticated;

-- Public (anon) entry point used by the staff login form. Tokens are random
-- UUIDs; the database stores only their SHA-256 hash.
create or replace function public.staff_login(
  p_username text,
  p_password text,
  p_app_code text
)
returns table (token uuid, staff_id uuid, name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code_hash text;
  v_staff public.staff%rowtype;
  v_token uuid;
  v_username text := lower(btrim(coalesce(p_username, '')));
begin
  -- Brute-force throttle: 8 failures per username within 15 minutes.
  delete from public.staff_login_attempts where created_at < now() - interval '1 day';
  if (
    select count(*) from public.staff_login_attempts
    where created_at > now() - interval '15 minutes'
      and username = v_username
  ) >= 8 then
    raise exception 'too_many_attempts';
  end if;

  select setting_value into v_code_hash
  from public.settings where setting_key = 'staff_app_code_hash';

  if coalesce(v_code_hash, '') = '' then
    raise exception 'code_not_set';
  end if;
  -- A wrong access code returns the same generic error as wrong credentials, so
  -- an attacker cannot tell the two apart.
  if crypt(coalesce(p_app_code, ''), v_code_hash) <> v_code_hash then
    insert into public.staff_login_attempts (username) values (v_username);
    raise exception 'invalid_credentials';
  end if;

  select * into v_staff
  from public.staff
  where lower(username) = v_username
    and login_enabled = true
    and is_active = true
  limit 1;

  if not found or v_staff.password_hash is null
     or crypt(coalesce(p_password, ''), v_staff.password_hash) <> v_staff.password_hash then
    insert into public.staff_login_attempts (username) values (v_username);
    raise exception 'invalid_credentials';
  end if;

  delete from public.staff_login_attempts where username = v_username;
  delete from public.staff_sessions where expires_at < now();

  v_token := gen_random_uuid();
  insert into public.staff_sessions (staff_id, token_hash)
  values (v_staff.id, extensions.digest(v_token::text, 'sha256'));

  return query select v_token, v_staff.id, v_staff.name;
end;
$$;

revoke all on function public.staff_login(text, text, text) from public;
grant execute on function public.staff_login(text, text, text) to anon, authenticated;

-- Internal helper: resolve a live token to a staff id. Not callable by clients.
create or replace function public.staff_id_from_token(p_token uuid)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select ss.staff_id
  from public.staff_sessions ss
  join public.staff s on s.id = ss.staff_id
  where p_token is not null
    and ss.token_hash = extensions.digest(p_token::text, 'sha256')
    and ss.expires_at > now()
    and s.is_active = true;
$$;

revoke all on function public.staff_id_from_token(uuid) from public;

-- Validate a saved token after page reload.
create or replace function public.staff_me(p_token uuid)
returns table (staff_id uuid, name text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select s.id, s.name
  from public.staff_sessions ss
  join public.staff s on s.id = ss.staff_id
  where p_token is not null
    and ss.token_hash = extensions.digest(p_token::text, 'sha256')
    and ss.expires_at > now()
    and s.is_active = true;
$$;

revoke all on function public.staff_me(uuid) from public;
grant execute on function public.staff_me(uuid) to anon, authenticated;

-- Active services for the booking form (no admin-only columns exist here).
create or replace function public.staff_services(p_token uuid)
returns table (id uuid, name_ar text, name_en text, price numeric)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.staff_id_from_token(p_token) is null then
    raise exception 'invalid_session';
  end if;

  return query
    select sv.id, sv.name_ar, sv.name_en, sv.price
    from public.services sv
    where sv.is_active = true
    order by sv.created_at asc;
end;
$$;

revoke all on function public.staff_services(uuid) from public;
grant execute on function public.staff_services(uuid) to anon, authenticated;

-- Safe public settings only (never WhatsApp / Evolution / access-code values).
create or replace function public.staff_settings(p_token uuid)
returns table (salon_name text, vat_rate text, vat_inclusive text, vat_number text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.staff_id_from_token(p_token) is null then
    raise exception 'invalid_session';
  end if;

  return query
    select
      (select setting_value from public.settings where setting_key = 'salon_name'),
      (select setting_value from public.settings where setting_key = 'vat_rate'),
      (select setting_value from public.settings where setting_key = 'vat_inclusive'),
      (select setting_value from public.settings where setting_key = 'vat_number');
end;
$$;

revoke all on function public.staff_settings(uuid) from public;
grant execute on function public.staff_settings(uuid) to anon, authenticated;

-- Staff names for the booking form: no phone numbers, no commission rates.
create or replace function public.staff_list(p_token uuid)
returns table (id uuid, name text, is_active boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public.staff_id_from_token(p_token) is null then
    raise exception 'invalid_session';
  end if;

  return query
    select s.id, s.name, s.is_active
    from public.staff s
    where s.is_active = true
    order by s.created_at asc;
end;
$$;

revoke all on function public.staff_list(uuid) from public;
grant execute on function public.staff_list(uuid) to anon, authenticated;

-- Staff-created booking. Totals, commission and status are computed by the
-- trigger, so the client cannot forge them.
create or replace function public.staff_create_booking(
  p_token uuid,
  p_client_name text,
  p_client_phone text,
  p_service_id uuid,
  p_staff_id uuid,
  p_appointment_date timestamptz,
  p_payment_proof text default null,
  p_notes text default null
)
returns table (id uuid, invoice_no text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_invoice text;
begin
  if public.staff_id_from_token(p_token) is null then
    raise exception 'invalid_session';
  end if;

  if char_length(btrim(coalesce(p_client_name, ''))) not between 2 and 120 then
    raise exception 'invalid_client_name';
  end if;
  if char_length(btrim(coalesce(p_client_phone, ''))) not between 6 and 20 then
    raise exception 'invalid_client_phone';
  end if;
  if char_length(coalesce(p_payment_proof, '')) > 120
     or char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'invalid_input';
  end if;
  if p_appointment_date is null
     or p_appointment_date < now() - interval '1 day'
     or p_appointment_date > now() + interval '366 days' then
    raise exception 'invalid_date';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and is_active = true) then
    raise exception 'invalid_service';
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id and is_active = true) then
    raise exception 'invalid_staff';
  end if;

  insert into public.appointments (
    client_name, client_phone, service_id, staff_id,
    appointment_date, payment_proof, notes
  )
  values (
    btrim(p_client_name), btrim(p_client_phone), p_service_id, p_staff_id,
    p_appointment_date, nullif(btrim(coalesce(p_payment_proof, '')), ''), nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id, invoice_no into v_id, v_invoice;

  return query select v_id, v_invoice;
end;
$$;

revoke all on function public.staff_create_booking(uuid, text, text, uuid, uuid, timestamptz, text, text) from public;
grant execute on function public.staff_create_booking(uuid, text, text, uuid, uuid, timestamptz, text, text) to anon, authenticated;

-- =====================================================================
-- Public landing page (no login required)
-- =====================================================================
-- Only what a visitor needs: names, pictures and active staff names. Prices
-- stay inside the POS, and no phone number, username or commission is exposed.
create or replace function public.public_services()
returns table (id uuid, name_ar text, name_en text, image_url text)
language sql
stable
security definer
set search_path = public
as $$
  select sv.id, sv.name_ar, sv.name_en, coalesce(sv.image_url, '')
  from public.services sv
  where sv.is_active = true
  order by sv.created_at asc;
$$;

revoke all on function public.public_services() from public;
grant execute on function public.public_services() to anon, authenticated;

create or replace function public.public_staff_list()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select st.id, st.name
  from public.staff st
  where st.is_active = true
  order by st.created_at asc;
$$;

revoke all on function public.public_staff_list() from public;
grant execute on function public.public_staff_list() to anon, authenticated;

-- A visitor books directly from the landing page. The database still decides
-- the price, commission, pending status and invoice number. Simple abuse
-- guards: max 3 live bookings per phone in 24h, plus a global hourly cap.
create or replace function public.public_booking(
  p_client_name text,
  p_client_phone text,
  p_service_id uuid,
  p_staff_id uuid,
  p_appointment_date timestamptz,
  p_notes text default null
)
returns table (invoice_no text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text;
  v_invoice text;
  v_recent integer;
  v_hourly integer;
begin
  if char_length(btrim(coalesce(p_client_name, ''))) not between 2 and 120 then
    raise exception 'invalid_client_name';
  end if;

  v_phone := public.normalize_phone(p_client_phone);
  if v_phone !~ '^[0-9]{8,15}$' then
    raise exception 'invalid_client_phone';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'invalid_input';
  end if;

  if p_appointment_date is null
     or p_appointment_date < now() + interval '15 minutes'
     or p_appointment_date > now() + interval '120 days' then
    raise exception 'invalid_date';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and is_active = true) then
    raise exception 'invalid_service';
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id and is_active = true) then
    raise exception 'invalid_staff';
  end if;

  select count(*) into v_recent
  from public.appointments
  where client_phone = v_phone
    and status <> 'cancelled'
    and created_at > now() - interval '24 hours';
  if v_recent >= 3 then
    raise exception 'too_many_bookings';
  end if;

  select count(*) into v_hourly
  from public.appointments
  where created_at > now() - interval '1 hour';
  if v_hourly >= 40 then
    raise exception 'too_many_requests';
  end if;

  insert into public.appointments (
    client_name, client_phone, service_id, staff_id, appointment_date, notes
  )
  values (
    btrim(p_client_name), v_phone, p_service_id, p_staff_id,
    p_appointment_date, nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning invoice_no into v_invoice;

  return query select v_invoice;
end;
$$;

revoke all on function public.public_booking(text, text, uuid, uuid, timestamptz, text) from public;
grant execute on function public.public_booking(text, text, uuid, uuid, timestamptz, text) to anon, authenticated;

-- Staff's own appointments, without commission columns.
create or replace function public.staff_appointments(p_token uuid)
returns table (
  id uuid,
  invoice_no text,
  client_name text,
  client_phone text,
  service_ar text,
  service_en text,
  appointment_date timestamptz,
  status text,
  total_price numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff_id uuid := public.staff_id_from_token(p_token);
begin
  if v_staff_id is null then
    raise exception 'invalid_session';
  end if;

  return query
    select a.id, a.invoice_no, a.client_name, a.client_phone, sv.name_ar, sv.name_en,
           a.appointment_date, a.status, a.total_price
    from public.appointments a
    join public.services sv on sv.id = a.service_id
    where a.staff_id = v_staff_id
    order by a.appointment_date desc
    limit 200;
end;
$$;

revoke all on function public.staff_appointments(uuid) from public;
grant execute on function public.staff_appointments(uuid) to anon, authenticated;

create or replace function public.staff_set_appointment_status(
  p_token uuid,
  p_appointment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff_id uuid := public.staff_id_from_token(p_token);
begin
  if p_status not in ('pending', 'completed', 'cancelled') then
    raise exception 'invalid_status';
  end if;

  if v_staff_id is null then
    raise exception 'invalid_session';
  end if;

  update public.appointments
    set status = p_status
    where id = p_appointment_id and staff_id = v_staff_id;

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.staff_set_appointment_status(uuid, uuid, text) from public;
grant execute on function public.staff_set_appointment_status(uuid, uuid, text) to anon, authenticated;

create or replace function public.staff_logout(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.staff_sessions
  where token_hash = extensions.digest(coalesce(p_token::text, ''), 'sha256');
end;
$$;

revoke all on function public.staff_logout(uuid) from public;
grant execute on function public.staff_logout(uuid) to anon, authenticated;

-- =====================================================================
-- WhatsApp notifications (Evolution API via pg_net)
-- =====================================================================
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
  i integer;
begin
  d := coalesce(p_phone, '');

  -- Convert Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to ASCII,
  -- so numbers typed with an Arabic keyboard are not silently dropped.
  for i in 0..9 loop
    d := replace(d, chr(1632 + i), i::text);  -- ٠ U+0660
    d := replace(d, chr(1776 + i), i::text);  -- ۰ U+06F0
  end loop;

  d := regexp_replace(d, '\D', '', 'g');

  if left(d, 2) = '00' then
    d := substr(d, 3);
  end if;
  -- Drop a single national trunk zero (e.g. 03312345 -> 3312345).
  if left(d, 1) = '0' and length(d) = 9 then
    d := substr(d, 2);
  end if;
  -- Local Bahraini numbers (8 digits) get the +973 country code.
  if length(d) = 8 then
    d := '973' || d;
  end if;
  return d;
end;
$$;

create or replace function public.send_whatsapp(
  p_phone text,
  p_text text,
  p_appointment_id uuid default null,
  p_kind text default 'booking'
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
  v_instance text;
  v_phone text;
  v_req bigint;
begin
  select setting_value into v_url from public.settings where setting_key = 'evolution_api_url';
  select setting_value into v_key from public.settings where setting_key = 'evolution_api_key';
  select setting_value into v_instance from public.settings where setting_key = 'evolution_instance';

  v_url := btrim(coalesce(v_url, ''));
  v_key := btrim(coalesce(v_key, ''));
  v_instance := btrim(coalesce(v_instance, ''));

  -- Every skip is logged, so a missing message is always explainable.
  if v_url = '' or v_key = '' or v_instance = '' then
    insert into public.whatsapp_log (appointment_id, recipient, phone, message)
    values (p_appointment_id, p_kind, p_phone, 'SKIPPED: Evolution API settings are incomplete (URL / key / instance)');
    return null;
  end if;
  if v_url !~ '^https?://' then
    insert into public.whatsapp_log (appointment_id, recipient, phone, message)
    values (p_appointment_id, p_kind, p_phone, 'SKIPPED: invalid Evolution API URL');
    return null;
  end if;

  v_phone := public.normalize_phone(p_phone);
  if v_phone = '' then
    insert into public.whatsapp_log (appointment_id, recipient, phone, message)
    values (p_appointment_id, p_kind, coalesce(p_phone, ''), 'SKIPPED: empty or invalid phone number');
    return null;
  end if;

  -- Tolerate a pasted full endpoint: keep only the API base URL.
  v_url := regexp_replace(v_url, '/+$', '');
  v_url := regexp_replace(v_url, '/message/sendText/.*$', '');

  v_req := net.http_post(
    url := v_url || '/message/sendText/' || v_instance,
    body := jsonb_build_object('number', v_phone, 'text', p_text),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_key
    ),
    timeout_milliseconds := 10000
  );

  insert into public.whatsapp_log (appointment_id, recipient, phone, message, request_id)
  values (p_appointment_id, p_kind, v_phone, p_text, v_req);

  return v_req;
exception when others then
  insert into public.whatsapp_log (appointment_id, recipient, phone, message)
  values (p_appointment_id, p_kind, p_phone, 'ERROR: ' || sqlerrm);
  return -1;
end;
$$;

revoke all on function public.send_whatsapp(text, text, uuid, text) from public;

-- =====================================================================
-- Official bilingual invoice (WhatsApp / print)
-- =====================================================================
-- Builds the invoice text for one appointment. Internal helper: it takes only
-- an id, so it is never granted to clients directly (see public.invoice_for).
create or replace function public.invoice_text(p_appointment_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a public.appointments%rowtype;
  v_salon text;
  v_phone text;
  v_address text;
  v_vat_no text;
  v_rate numeric;
  v_inclusive boolean;
  v_net numeric;
  v_vat numeric;
  v_gross numeric;
  v_service_ar text;
  v_service_en text;
  v_staff text;
  v_when text;
  v_issued text;
begin
  select * into a from public.appointments where id = p_appointment_id;
  if not found then
    return null;
  end if;

  select setting_value into v_salon from public.settings where setting_key = 'salon_name';
  select setting_value into v_phone from public.settings where setting_key = 'salon_phone';
  select setting_value into v_address from public.settings where setting_key = 'salon_address';
  select setting_value into v_vat_no from public.settings where setting_key = 'vat_number';
  v_rate := coalesce(
    (select nullif(btrim(setting_value), '')::numeric from public.settings where setting_key = 'vat_rate'),
    10
  );
  v_inclusive := coalesce(
    (select setting_value from public.settings where setting_key = 'vat_inclusive'),
    'true'
  ) <> 'false';

  -- total_price is the amount the client pays (VAT inclusive) when the salon
  -- prices include VAT; otherwise it is the net amount and VAT is added on top.
  v_gross := a.total_price;
  if v_inclusive then
    v_net := round(v_gross / (1 + v_rate / 100.0), 3);
    v_vat := round(v_gross - v_net, 3);
  else
    v_net := v_gross;
    v_vat := round(v_gross * v_rate / 100.0, 3);
    v_gross := round(v_net + v_vat, 3);
  end if;

  select name_ar, name_en into v_service_ar, v_service_en
  from public.services where id = a.service_id;
  select name into v_staff from public.staff where id = a.staff_id;

  v_when := to_char(a.appointment_date at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI');
  v_issued := to_char(coalesce(a.created_at, now()) at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI');

  return
    '🧾 *فاتورة ضريبية / TAX INVOICE*' || E'\n' ||
    '💅 *' || coalesce(nullif(btrim(v_salon), ''), 'Salon') || '*' || E'\n' ||
    case when coalesce(btrim(v_address), '') <> ''
      then '📍 ' || btrim(v_address) || E'\n' else '' end ||
    case when coalesce(btrim(v_phone), '') <> ''
      then '📞 ' || btrim(v_phone) || E'\n' else '' end ||
    '🔖 رقم الفاتورة / Invoice No: *' || coalesce(a.invoice_no, '-') || '*' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    '👤 العميلة / Client: ' || a.client_name || E'\n' ||
    '📞 الهاتف / Phone: ' || a.client_phone || E'\n' ||
    '💄 الخدمة / Service: ' || coalesce(v_service_ar, '-') || ' / ' || coalesce(v_service_en, '-') || E'\n' ||
    '💁‍♀️ الموظفة / Staff: ' || coalesce(v_staff, '-') || E'\n' ||
    '🗓️ الموعد / Appointment: ' || v_when || E'\n' ||
    '📅 تاريخ الإصدار / Issued: ' || v_issued ||
    case when coalesce(a.payment_proof, '') <> ''
      then E'\n' || '💳 المرجع / Reference: ' || a.payment_proof
      else '' end || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    'المجموع قبل الضريبة / Subtotal: ' || to_char(v_net, 'FM9999990.000') || ' BHD' || E'\n' ||
    'ضريبة القيمة المضافة ' || to_char(v_rate, 'FM990') || '% / VAT ' ||
      to_char(v_rate, 'FM990') || '%: ' || to_char(v_vat, 'FM9999990.000') || ' BHD' || E'\n' ||
    '*الإجمالي شامل الضريبة / Total: ' || to_char(v_gross, 'FM9999990.000') || ' BHD*' || E'\n' ||
    '━━━━━━━━━━━━━━' || E'\n' ||
    '🏛️ الرقم الضريبي / VAT No: ' || coalesce(nullif(btrim(v_vat_no), ''), '-') || E'\n' ||
    '✅ شكراً لثقتك / Thank you';
end;
$$;

revoke all on function public.invoice_text(uuid) from public;

-- App entry point: an admin may fetch any invoice; a staff session may fetch
-- only an invoice that belongs to her own appointments.
create or replace function public.invoice_for(p_token uuid, p_appointment_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff_id uuid := public.staff_id_from_token(p_token);
begin
  if public.is_admin() then
    return public.invoice_text(p_appointment_id);
  end if;

  if v_staff_id is null then
    raise exception 'invalid_session';
  end if;
  if not exists (
    select 1 from public.appointments
    where id = p_appointment_id and staff_id = v_staff_id
  ) then
    raise exception 'not_found';
  end if;

  return public.invoice_text(p_appointment_id);
end;
$$;

revoke all on function public.invoice_for(uuid, uuid) from public;
grant execute on function public.invoice_for(uuid, uuid) to anon, authenticated;

create or replace function public.notify_new_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_salon text;
  v_admin text;
  v_service text;
  v_staff text;
  v_when text;
  v_total text;
  v_admin_msg text;
  v_client_msg text;
begin
  -- A notification problem must never block saving a booking.
  begin
    select setting_value into v_salon from public.settings where setting_key = 'salon_name';
    select setting_value into v_admin from public.settings where setting_key = 'admin_whatsapp';

    select name_ar || ' / ' || name_en into v_service
    from public.services where id = new.service_id;

    select name into v_staff from public.staff where id = new.staff_id;

    v_when := to_char(new.appointment_date at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI');
    v_total := to_char(new.total_price, 'FM9999990.000') || ' BHD';

    v_admin_msg := '📅 ' || 'New Booking / حجز جديد' || E'\n' ||
      '——————————' || E'\n' ||
      '🔖 ' || 'Invoice/الفاتورة: ' || coalesce(new.invoice_no, '-') || E'\n' ||
      '👤 ' || 'Client/العميلة: ' || new.client_name || E'\n' ||
      '📞 ' || 'Phone/الهاتف: ' || new.client_phone || E'\n' ||
      '💄 ' || 'Service/الخدمة: ' || coalesce(v_service, '-') || E'\n' ||
      '💁‍♀️ ' || 'Staff/الموظفة: ' || coalesce(v_staff, '-') || E'\n' ||
      '🕒 ' || 'Time/الوقت: ' || v_when || E'\n' ||
      '💵 ' || 'Total/الإجمالي: ' || v_total ||
      case when coalesce(new.payment_proof, '') <> ''
        then E'\n' || '🧾 ' || 'Ref/الإيصال: ' || new.payment_proof
        else '' end;

    -- The client receives the official bilingual tax invoice.
    v_client_msg := coalesce(public.invoice_text(new.id),
      '💅 ' || coalesce(nullif(btrim(v_salon), ''), 'Salon') || E'\n' ||
      '✅ ' || 'تم تأكيد حجزك / Booking confirmed' || E'\n' ||
      '💄 ' || 'الخدمة / Service: ' || coalesce(v_service, '-') || E'\n' ||
      '💁‍♀️ ' || 'الموظفة / Staff: ' || coalesce(v_staff, '-') || E'\n' ||
      '🕒 ' || 'الموعد / Time: ' || v_when || E'\n' ||
      '💵 ' || 'الإجمالي / Total: ' || v_total);

    perform public.send_whatsapp(v_admin, v_admin_msg, new.id, 'admin');
    perform public.send_whatsapp(new.client_phone, v_client_msg, new.id, 'client');
  exception when others then
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_appointment on public.appointments;
create trigger trg_notify_new_appointment
after insert on public.appointments
for each row execute function public.notify_new_appointment();

-- Admin diagnostics: send a test WhatsApp and inspect recent API responses.
create or replace function public.admin_test_whatsapp(p_phone text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  return public.send_whatsapp(
    p_phone,
    '✅ رسالة تجريبية من نظام الصالون' || E'\n' || 'Test message from the salon system',
    null,
    'test'
  );
end;
$$;

revoke all on function public.admin_test_whatsapp(text) from public;
grant execute on function public.admin_test_whatsapp(text) to authenticated;

-- Recreated (not replaced) because the output columns change.
drop function if exists public.admin_whatsapp_log();
create or replace function public.admin_whatsapp_log()
returns table (
  created_at timestamptz,
  recipient text,
  phone text,
  request_id bigint,
  status_code integer,
  response text,
  error_message text,
  message text
)
language sql
security definer
set search_path = public, net
as $$
  select l.created_at, l.recipient, l.phone, l.request_id,
         r.status_code, left(coalesce(r.content, ''), 600), r.error_msg,
         left(coalesce(l.message, ''), 300)
  from public.whatsapp_log l
  left join net._http_response r on r.id = l.request_id
  where public.is_admin()
  order by l.created_at desc
  limit 50;
$$;

revoke all on function public.admin_whatsapp_log() from public;
grant execute on function public.admin_whatsapp_log() to authenticated;

-- =====================================================================
-- Google Sheets sync (Apps Script Web App via pg_net)
-- =====================================================================
-- Every booking (and every status change) is posted as one JSON row to the
-- manager's Google Apps Script Web App. Because the request starts inside the
-- database, there is no CORS problem and no Google secret ever reaches the
-- browser. A missing URL only logs a skip; it never blocks a booking.
create or replace function public.sheet_row(p_appointment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a public.appointments%rowtype;
  v_rate numeric;
  v_inclusive boolean;
  v_net numeric;
  v_vat numeric;
  v_gross numeric;
  v_service_ar text;
  v_service_en text;
  v_staff text;
  v_vat_no text;
begin
  select * into a from public.appointments where id = p_appointment_id;
  if not found then
    return '{}'::jsonb;
  end if;

  select name_ar, name_en into v_service_ar, v_service_en
  from public.services where id = a.service_id;
  select name into v_staff from public.staff where id = a.staff_id;
  select setting_value into v_vat_no from public.settings where setting_key = 'vat_number';

  v_rate := coalesce(
    (select nullif(btrim(setting_value), '')::numeric from public.settings where setting_key = 'vat_rate'),
    10
  );
  v_inclusive := coalesce(
    (select setting_value from public.settings where setting_key = 'vat_inclusive'),
    'true'
  ) <> 'false';

  v_gross := a.total_price;
  if v_inclusive then
    v_net := round(v_gross / (1 + v_rate / 100.0), 3);
    v_vat := round(v_gross - v_net, 3);
  else
    v_net := v_gross;
    v_vat := round(v_gross * v_rate / 100.0, 3);
    v_gross := round(v_net + v_vat, 3);
  end if;

  return jsonb_build_object(
    'invoice_no', coalesce(a.invoice_no, ''),
    'created_at', to_char(coalesce(a.created_at, now()) at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
    'appointment_date', to_char(a.appointment_date at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
    'client_name', a.client_name,
    'client_phone', a.client_phone,
    'service_ar', coalesce(v_service_ar, ''),
    'service_en', coalesce(v_service_en, ''),
    'staff', coalesce(v_staff, ''),
    'subtotal', v_net,
    'vat', v_vat,
    'total', v_gross,
    'vat_rate', v_rate,
    'vat_number', coalesce(v_vat_no, ''),
    'status', a.status,
    'payment_proof', coalesce(a.payment_proof, ''),
    'notes', coalesce(a.notes, '')
  );
end;
$$;

revoke all on function public.sheet_row(uuid) from public;

create or replace function public.sheet_send(p_appointment_id uuid, p_kind text default 'booking')
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_payload jsonb;
  v_req bigint;
begin
  select setting_value into v_url from public.settings where setting_key = 'google_sheet_url';
  v_url := btrim(coalesce(v_url, ''));

  if v_url = '' then
    insert into public.sheets_log (appointment_id, kind, message)
    values (p_appointment_id, p_kind, 'SKIPPED: Google Sheet URL is not set');
    return null;
  end if;
  if v_url !~ '^https://' then
    insert into public.sheets_log (appointment_id, kind, message)
    values (p_appointment_id, p_kind, 'SKIPPED: invalid Google Sheet URL');
    return null;
  end if;

  v_payload := public.sheet_row(p_appointment_id);
  if v_payload = '{}'::jsonb then
    insert into public.sheets_log (appointment_id, kind, message)
    values (p_appointment_id, p_kind, 'SKIPPED: appointment not found');
    return null;
  end if;

  v_req := net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );

  insert into public.sheets_log (appointment_id, kind, request_id)
  values (p_appointment_id, p_kind, v_req);
  return v_req;
exception when others then
  insert into public.sheets_log (appointment_id, kind, message)
  values (p_appointment_id, p_kind, 'ERROR: ' || sqlerrm);
  return -1;
end;
$$;

revoke all on function public.sheet_send(uuid, text) from public;

create or replace function public.sync_appointment_sheet()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    perform public.sheet_send(new.id, 'booking');
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_sync_appointment_sheet on public.appointments;
create trigger trg_sync_appointment_sheet
after insert or update of status, appointment_date, total_price, client_name, client_phone, notes, payment_proof
on public.appointments
for each row execute function public.sync_appointment_sheet();

-- Send a test row, so the manager can confirm the Apps Script deployment.
create or replace function public.admin_test_sheet()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_req bigint;
  v_payload jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select setting_value into v_url from public.settings where setting_key = 'google_sheet_url';
  v_url := btrim(coalesce(v_url, ''));
  if v_url = '' or v_url !~ '^https://' then
    return null;
  end if;

  v_payload := jsonb_build_object(
    'invoice_no', 'TEST-' || to_char(now() at time zone 'Asia/Bahrain', 'YYYYMMDDHH24MISS'),
    'created_at', to_char(now() at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
    'appointment_date', to_char(now() at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
    'client_name', 'Test / تجريبي',
    'client_phone', '97300000000',
    'service_ar', 'اختبار',
    'service_en', 'Test',
    'staff', 'System',
    'subtotal', 0,
    'vat', 0,
    'total', 0,
    'vat_rate', 0,
    'vat_number', '',
    'status', 'test',
    'payment_proof', '',
    'notes', 'Connection test from the salon system'
  );

  v_req := net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );

  insert into public.sheets_log (kind, request_id) values ('test', v_req);
  return v_req;
exception when others then
  insert into public.sheets_log (kind, message) values ('test', 'ERROR: ' || sqlerrm);
  return -1;
end;
$$;

revoke all on function public.admin_test_sheet() from public;
grant execute on function public.admin_test_sheet() to authenticated;

-- Re-send every recent booking and expense (useful after the sheet is first connected).
create or replace function public.admin_sync_all_to_sheet()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
  r record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  for r in
    select id from public.appointments
    order by created_at desc
    limit 1000
  loop
    perform public.sheet_send(r.id, 'bulk');
    v_count := v_count + 1;
  end loop;

  for r in
    select id from public.expenses
    order by created_at desc
    limit 1000
  loop
    perform public.sheet_send_expense(r.id, 'expense');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.admin_sync_all_to_sheet() from public;
grant execute on function public.admin_sync_all_to_sheet() to authenticated;

create or replace function public.admin_sheet_log()
returns table (
  id bigint,
  appointment_id uuid,
  kind text,
  status_code integer,
  response text,
  message text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, net
as $$
  select l.id, l.appointment_id, l.kind, r.status_code,
         left(coalesce(r.content, ''), 300),
         left(coalesce(l.message, ''), 300),
         l.created_at
  from public.sheets_log l
  left join net._http_response r on r.id = l.request_id
  where public.is_admin()
  order by l.created_at desc
  limit 30;
$$;

revoke all on function public.admin_sheet_log() from public;
grant execute on function public.admin_sheet_log() to authenticated;

-- Explicit table privileges (Supabase normally creates these by default).
-- RLS policies above still decide which rows are visible/writable.
grant usage on schema public to anon, authenticated;

-- No anonymous table access at all. Guests cannot read services, settings,
-- staff or appointments; they only reach the SECURITY DEFINER RPCs above.
grant select on public.services to authenticated;
grant insert, update, delete on public.services to authenticated;

grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;

grant select on public.settings to authenticated;
grant insert, update, delete on public.settings to authenticated;

grant select on public.whatsapp_log to authenticated;
revoke all on public.sheets_log from anon, authenticated;
revoke all on public.staff_sessions from anon, authenticated;
revoke all on public.staff_login_attempts from anon, authenticated;
revoke all on public.services from anon;
revoke all on public.staff from anon;
revoke all on public.appointments from anon;
revoke all on public.settings from anon;
revoke all on public.whatsapp_log from anon;

-- =====================================================================
-- Expenses (manager + staff)
-- =====================================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(10,3) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'benefitpay')),
  notes text,
  vendor_name text,
  vendor_vat_no text,
  invoice_no text,
  vat_amount numeric(10,3) not null default 0,
  staff_id uuid references public.staff(id) on delete set null,
  created_by text not null default 'admin' check (created_by in ('admin', 'staff')),
  spent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Upgrade safety for databases created before the VAT fields were added.
alter table public.expenses add column if not exists vendor_name text;
alter table public.expenses add column if not exists vendor_vat_no text;
alter table public.expenses add column if not exists invoice_no text;
alter table public.expenses add column if not exists vat_amount numeric(10,3) not null default 0;

-- Input VAT can never exceed the gross amount paid. Added only once so the
-- script stays safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expenses_vat_amount_check'
      and conrelid = 'public.expenses'::regclass
  ) then
    alter table public.expenses
      add constraint expenses_vat_amount_check
      check (vat_amount >= 0 and vat_amount <= amount);
  end if;
end $$;

create index if not exists idx_expenses_spent_at on public.expenses (spent_at desc);
create index if not exists idx_expenses_staff on public.expenses (staff_id);

alter table public.expenses enable row level security;

drop policy if exists expenses_admin_all on public.expenses;
create policy expenses_admin_all on public.expenses
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.expenses to authenticated;
revoke all on public.expenses from anon;

-- Staff RPCs: a staff token only ever reads or writes that staff member's rows.
drop function if exists public.staff_expenses(uuid);
drop function if exists public.staff_create_expense(uuid, text, numeric, text, text, timestamptz);
drop function if exists public.staff_delete_expense(uuid, uuid);

create or replace function public.staff_expenses(p_token uuid)
returns table (
  id uuid, title text, amount numeric, method text, notes text,
  spent_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff uuid := public.staff_id_from_token(p_token);
begin
  if v_staff is null then
    raise exception 'invalid_session';
  end if;
  return query
    select e.id, e.title, e.amount, e.method, e.notes, e.spent_at, e.created_at
    from public.expenses e
    where e.staff_id = v_staff
    order by e.spent_at desc, e.created_at desc
    limit 500;
end;
$$;

revoke all on function public.staff_expenses(uuid) from public;
revoke all on function public.staff_expenses(uuid) from anon, authenticated;
-- Staff can add expenses but must never read them: this function stays
-- unreachable from the browser API (no grant to anon/authenticated).

create or replace function public.staff_create_expense(
  p_token uuid,
  p_title text,
  p_amount numeric,
  p_method text,
  p_notes text default null,
  p_spent_at timestamptz default null,
  p_vendor_name text default null,
  p_vendor_vat_no text default null,
  p_invoice_no text default null,
  p_vat_amount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff uuid := public.staff_id_from_token(p_token);
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_method text := lower(btrim(coalesce(p_method, 'cash')));
  v_vendor text := nullif(btrim(coalesce(p_vendor_name, '')), '');
  v_vendor_vat text := nullif(btrim(coalesce(p_vendor_vat_no, '')), '');
  v_invoice text := nullif(btrim(coalesce(p_invoice_no, '')), '');
  v_vat numeric := coalesce(p_vat_amount, 0);
begin
  if v_staff is null then
    raise exception 'invalid_session';
  end if;
  if char_length(v_title) not between 2 and 160 then
    raise exception 'invalid_title';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception 'invalid_amount';
  end if;
  if v_method not in ('cash', 'benefitpay') then
    raise exception 'invalid_method';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'invalid_notes';
  end if;
  if char_length(coalesce(v_vendor, '')) > 160
     or char_length(coalesce(v_vendor_vat, '')) > 40
     or char_length(coalesce(v_invoice, '')) > 60 then
    raise exception 'invalid_input';
  end if;
  if v_vat < 0 or v_vat > p_amount then
    raise exception 'invalid_vat_amount';
  end if;

  insert into public.expenses (
    title, amount, method, notes, vendor_name, vendor_vat_no, invoice_no,
    vat_amount, staff_id, created_by, spent_at
  )
  values (
    v_title,
    round(p_amount, 3),
    v_method,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_vendor,
    v_vendor_vat,
    v_invoice,
    round(v_vat, 3),
    v_staff,
    'staff',
    coalesce(p_spent_at, now())
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.staff_create_expense(uuid, text, numeric, text, text, timestamptz, text, text, text, numeric) from public;
grant execute on function public.staff_create_expense(uuid, text, numeric, text, text, timestamptz, text, text, text, numeric) to anon, authenticated;

create or replace function public.staff_delete_expense(p_token uuid, p_expense_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff uuid := public.staff_id_from_token(p_token);
begin
  if v_staff is null then
    raise exception 'invalid_session';
  end if;
  delete from public.expenses where id = p_expense_id and staff_id = v_staff;
  return found;
end;
$$;

revoke all on function public.staff_delete_expense(uuid, uuid) from public;
revoke all on function public.staff_delete_expense(uuid, uuid) from anon, authenticated;
-- Deleting expenses is an admin action only.

-- Google Sheets: one row per expense, in an "Expenses" tab.
drop trigger if exists trg_sync_expense_sheet on public.expenses;
drop function if exists public.sync_expense_sheet();
drop function if exists public.sheet_send_expense(uuid, text);
drop function if exists public.sheet_expense_row(uuid);

create or replace function public.sheet_expense_row(p_expense_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e public.expenses%rowtype;
  v_staff text;
begin
  select * into e from public.expenses where id = p_expense_id;
  if not found then
    return '{}'::jsonb;
  end if;
  select name into v_staff from public.staff where id = e.staff_id;

  return jsonb_build_object(
    'kind', 'expense',
    'id', e.id,
    'created_at', to_char(e.created_at at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
    'spent_at', to_char(e.spent_at at time zone 'Asia/Bahrain', 'YYYY-MM-DD HH24:MI'),
    'title', e.title,
    'vendor_name', coalesce(e.vendor_name, ''),
    'vendor_vat_no', coalesce(e.vendor_vat_no, ''),
    'invoice_no', coalesce(e.invoice_no, ''),
    'amount', e.amount,
    'vat_amount', e.vat_amount,
    'net_amount', round(e.amount - e.vat_amount, 3),
    'method', e.method,
    'notes', coalesce(e.notes, ''),
    'staff', coalesce(v_staff, ''),
    'created_by', e.created_by
  );
end;
$$;

revoke all on function public.sheet_expense_row(uuid) from public;

create or replace function public.sheet_send_expense(p_expense_id uuid, p_kind text default 'expense')
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_payload jsonb;
  v_req bigint;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'expense');
begin
  select setting_value into v_url from public.settings where setting_key = 'google_sheet_url';
  v_url := btrim(coalesce(v_url, ''));

  if v_url = '' then
    insert into public.sheets_log (kind, message)
    values (v_kind, 'SKIPPED: Google Sheet URL is not set');
    return null;
  end if;
  if v_url !~ '^https://' then
    insert into public.sheets_log (kind, message)
    values (v_kind, 'SKIPPED: invalid Google Sheet URL');
    return null;
  end if;

  v_payload := public.sheet_expense_row(p_expense_id);
  if v_payload = '{}'::jsonb then
    insert into public.sheets_log (kind, message)
    values (v_kind, 'SKIPPED: expense not found');
    return null;
  end if;

  v_req := net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );

  insert into public.sheets_log (kind, request_id) values (v_kind, v_req);
  return v_req;
exception when others then
  insert into public.sheets_log (kind, message) values (v_kind, 'ERROR: ' || sqlerrm);
  return -1;
end;
$$;

revoke all on function public.sheet_send_expense(uuid, text) from public;

create or replace function public.sync_expense_sheet()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    perform public.sheet_send_expense(new.id, 'expense');
  exception when others then
    null;
  end;
  return new;
end;
$$;

create trigger trg_sync_expense_sheet
after insert or update of title, amount, method, notes, staff_id, spent_at
on public.expenses
for each row execute function public.sync_expense_sheet();
