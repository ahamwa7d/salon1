CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. جدول الإعدادات العامة للصالون
CREATE TABLE IF NOT EXISTS public.salon_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salon_name TEXT NOT NULL DEFAULT 'صالون نسائي',
  phone TEXT DEFAULT '',
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  currency TEXT NOT NULL DEFAULT 'BHD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.salon_settings (id, salon_name, vat_rate, currency)
VALUES (1, 'صالون نسائي', 10.00, 'BHD')
ON CONFLICT (id) DO NOTHING;

-- 2. جدول الخدمات
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT DEFAULT '',
  price NUMERIC(10,3) NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول الموظفات وصلاحيات المديرة/الموظفة
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول الحجوزات
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. جدول الفواتير (مع احتساب ضريبة 10%)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT UNIQUE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  subtotal NUMERIC(10,3) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,3) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. دالة الحجز العام الآمنة (تجنب تضارب الأنواع)
CREATE OR REPLACE FUNCTION public.public_booking(
  p_service_id UUID,
  p_staff_id UUID DEFAULT NULL,
  p_customer_name TEXT DEFAULT '',
  p_customer_phone TEXT DEFAULT '',
  p_booking_date DATE DEFAULT CURRENT_DATE,
  p_booking_time TIME DEFAULT '10:00:00',
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_price NUMERIC(10,3);
  v_vat_rate NUMERIC(5,2);
  v_vat_amount NUMERIC(10,3);
  v_total NUMERIC(10,3);
  v_booking_id UUID;
  v_invoice_no TEXT;
BEGIN
  IF btrim(COALESCE(p_customer_name, '')) = '' OR btrim(COALESCE(p_customer_phone, '')) = '' THEN
    RAISE EXCEPTION 'Customer name and phone are required';
  END IF;

  SELECT price INTO v_service_price
  FROM public.services
  WHERE id = p_service_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected service is not available';
  END IF;

  SELECT COALESCE(vat_rate, 10.00) INTO v_vat_rate
  FROM public.salon_settings
  WHERE id = 1;

  v_vat_amount := ROUND((v_service_price * v_vat_rate / 100.0)::NUMERIC, 3);
  v_total := ROUND((v_service_price + v_vat_amount)::NUMERIC, 3);
  v_invoice_no := 'INV-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));

  INSERT INTO public.bookings (
    service_id, staff_id, customer_name, customer_phone, booking_date, booking_time, status, notes
  )
  VALUES (
    p_service_id, p_staff_id, btrim(p_customer_name), btrim(p_customer_phone), p_booking_date, p_booking_time, 'pending', COALESCE(p_notes, '')
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.invoices (
    invoice_no, booking_id, customer_name, subtotal, vat_amount, total_amount, payment_status
  )
  VALUES (
    v_invoice_no, v_booking_id, btrim(p_customer_name), v_service_price, v_vat_amount, v_total, 'unpaid'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'invoice_no', v_invoice_no,
    'subtotal', v_service_price,
    'vat_amount', v_vat_amount,
    'total_amount', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_booking(UUID, UUID, TEXT, TEXT, DATE, TIME, TEXT) TO anon, authenticated;

-- 7. Trigger تلقائي لإضافة المديرة في جدول staff عند إنشاء حسابها في auth.users
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  IF v_role NOT IN ('admin', 'staff') THEN
    v_role := 'admin';
  END IF;

  INSERT INTO public.staff (user_id, full_name, email, role, commission_rate, is_active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    v_role,
    0,
    TRUE
  )
  ON CONFLICT (email) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      role = EXCLUDED.role,
      is_active = TRUE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_salon_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_salon_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_admin_user();

-- 8. تفعيل سياسات الحماية (RLS)
ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read salon settings" ON public.salon_settings;
CREATE POLICY "Public read salon settings" ON public.salon_settings
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage salon settings" ON public.salon_settings;
CREATE POLICY "Admin manage salon settings" ON public.salon_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true));

DROP POLICY IF EXISTS "Public read active services" ON public.services;
CREATE POLICY "Public read active services" ON public.services
FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Admin manage services" ON public.services;
CREATE POLICY "Admin manage services" ON public.services
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true));

DROP POLICY IF EXISTS "Staff and admin read staff" ON public.staff;
CREATE POLICY "Staff and admin read staff" ON public.staff
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true));

DROP POLICY IF EXISTS "Admin manage staff" ON public.staff;
CREATE POLICY "Admin manage staff" ON public.staff
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true));

DROP POLICY IF EXISTS "Staff and admin read bookings" ON public.bookings;
CREATE POLICY "Staff and admin read bookings" ON public.bookings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.is_active = true));

DROP POLICY IF EXISTS "Staff and admin update bookings" ON public.bookings;
CREATE POLICY "Staff and admin update bookings" ON public.bookings
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.is_active = true));

DROP POLICY IF EXISTS "Staff and admin read invoices" ON public.invoices;
CREATE POLICY "Staff and admin read invoices" ON public.invoices
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.is_active = true));

DROP POLICY IF EXISTS "Admin manage invoices" ON public.invoices;
CREATE POLICY "Admin manage invoices" ON public.invoices
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.user_id = auth.uid() AND s.role = 'admin' AND s.is_active = true));
