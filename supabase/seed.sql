-- Optional demo data. Safe to run more than once.

insert into public.services (name_ar, name_en, price, image_url)
select v.name_ar, v.name_en, v.price, v.image_url
from (values
  ('قص وتصفيف شعر', 'Haircut & Styling', 12.000, 'img/services/hair.jpg'),
  ('صبغة شعر كاملة', 'Full Hair Coloring', 45.000, 'img/services/color.jpg'),
  ('مانيكير', 'Manicure', 8.000, 'img/services/manicure.jpg'),
  ('باديكير', 'Pedicure', 10.000, 'img/services/pedicure.jpg'),
  ('تنظيف وعناية بالبشرة', 'Facial Cleanup', 18.000, 'img/services/facial.jpg'),
  ('مكياج سهرات', 'Evening Makeup', 35.000, 'img/services/makeup.jpg'),
  ('حمام كريمي للشعر', 'Hair Spa Treatment', 25.000, 'img/services/hairwash.jpg')
) as v(name_ar, name_en, price, image_url)
where not exists (
  select 1 from public.services s where s.name_en = v.name_en
);

insert into public.staff (name, phone, commission_rate)
select v.name, v.phone, v.commission_rate
from (values
  ('نورة', '33001100', 30),
  ('مريم', '33002200', 25),
  ('لطيفة', '33003300', 20)
) as v(name, phone, commission_rate)
where not exists (
  select 1 from public.staff s where s.name = v.name
);
