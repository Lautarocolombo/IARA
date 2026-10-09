-- 015: Consolidar imagen de testimonios → foto del producto en uso
-- La columna `image`/`avatar` pasa a ser la foto del producto en uso.
-- Las fotos previamente subidas como `product_image_url` se migran a `image`/`avatar`
-- para que sigan visibles sin romper datos existentes.
-- Esta migración es idempotentente (se puede ejecutar múltiples veces sin efectos secundarios).
UPDATE testimonials
  SET image = product_image_url,
      avatar = product_image_url
WHERE (image IS NULL OR image = '')
  AND product_image_url IS NOT NULL
  AND product_image_url != '';
