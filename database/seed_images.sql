-- ============================================================
-- SEED: IMÁGENES DE PRODUCTOS
-- Reemplazá las URLs con tus imágenes reales
-- ============================================================

-- Estructura de inserción:
-- INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
-- VALUES (1, 'https://tu-cdn.com/img/pulsera-rosa-1.jpg', 'Pulsera Minimalista Rosa - vista 1', 0, true);

-- Si usas Vercel Blob:
-- INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
-- VALUES (1, 'https://xyz.public.blob.vercel-storage.com/pulsera-rosa.jpg', 'Pulsera Minimalista Rosa', 0, true);

-- Si usas Cloudinary:
-- INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
-- VALUES (1, 'https://res.cloudinary.com/tu-cloud/image/upload/v123/pulsera-rosa.jpg', 'Pulsera Minimalista Rosa', 0, true);

-- Si usás base64 (no recomendado para producción):
-- INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
-- VALUES (1, 'data:image/jpeg;base64,...', 'Pulsera Minimalista Rosa', 0, true);

-- Regla: is_primary = true marca la imagen principal que se muestra en la card del catálogo.
-- sort_order = 0, 1, 2... define el orden en la galería (cuando la implementes).
