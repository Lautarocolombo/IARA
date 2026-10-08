DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carousel_images' AND column_name = 'caption') THEN
    ALTER TABLE carousel_images ADD COLUMN caption TEXT DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carousel_images' AND column_name = 'about_group') THEN
    ALTER TABLE carousel_images ADD COLUMN about_group INTEGER DEFAULT 0;
  END IF;
END $$;

UPDATE carousel_images SET caption = CASE slot
  WHEN 1 THEN 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.'
  WHEN 2 THEN 'En cada pieza dejamos un pedacito de Gualeguay: horas de trabajo manual, materiales elegidos con cuidado y el orgullo de hacer las cosas bien.'
  WHEN 3 THEN 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.'
  WHEN 4 THEN 'Artesanía Gualeguay nació en el corazón de Entre Ríos con la misión de crear pulseras, souvenirs y accesorios únicos que capturen la esencia de nuestra tierra.'
  WHEN 5 THEN ''
END,
about_group = CASE slot
  WHEN 1 THEN 1
  WHEN 2 THEN 1
  WHEN 3 THEN 2
  WHEN 4 THEN 2
  WHEN 5 THEN 3
END
WHERE tenant_id = 'default' AND (caption IS NULL OR caption = '');
