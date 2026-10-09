-- Migración de reparación integral de encoding UTF-8
-- Problema detectado: emojis y caracteres especiales se muestran corruptos
-- Ejemplos: "âœï¸" en lugar de "✏️", "ðŸ—‘" en lugar de "🗑️"
-- Causa: archivos fuente guardados con encoding incorrecto (Latin1 interpretado como UTF-8)
-- Esta migración corrige datos YA CORRUPTOS en la base de datos.
-- El fix de código (archivos fuente) está por separado.

-- Función auxiliar idempotente para corregir doble codificación
CREATE OR REPLACE FUNCTION fix_utf8_encoding(text) RETURNS text AS $$
DECLARE
  input ALIAS FOR $1;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  -- Detectar patrones típicos de mojibake (doble encoding UTF-8 -> Latin1 -> UTF-8)
  -- Patrones: Ã*, â€*, âœ*, ðŸ* y otros caracteres corruptos comunes
  IF input ~ '(Ã|â€|âœ|ðŸ|Â)' THEN
    BEGIN
      RETURN convert_from(convert_to(input, 'LATIN1'), 'UTF8');
    EXCEPTION WHEN OTHERS THEN
      RETURN input;
    END;
  END IF;

  RETURN input;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- DRY-RUN: ver qué filas se verían afectadas
-- (Ejecutar primero las consultas SELECT para inspeccionar)
-- ============================================

-- SELECT 'testimonials', id, name, comment, role FROM testimonials WHERE name LIKE '%Ã%' OR comment LIKE '%Ã%' OR role LIKE '%Ã%' OR name LIKE '%â€%' OR comment LIKE '%â€%';
-- SELECT 'products', id, name, description FROM products WHERE name LIKE '%Ã%' OR description LIKE '%Ã%' OR name LIKE '%â€%' OR description LIKE '%â€%' OR emoji LIKE '%Ã%' OR emoji LIKE '%â€%';
-- SELECT 'categories', id, name, description FROM categories WHERE name LIKE '%Ã%' OR description LIKE '%Ã%' OR name LIKE '%â€%' OR description LIKE '%â€%';
-- SELECT 'site_texts', key, value FROM site_texts WHERE value LIKE '%Ã%' OR value LIKE '%â€%';
-- SELECT 'section_content', section_key, title, subtitle FROM section_content WHERE title LIKE '%Ã%' OR subtitle LIKE '%Ã%' OR title LIKE '%â€%' OR subtitle LIKE '%â€%';
-- SELECT 'hero_cards', id, nombre, titulo, subtitulo, descripcion, cta_texto FROM hero_cards WHERE nombre LIKE '%Ã%' OR titulo LIKE '%Ã%' OR descripcion LIKE '%Ã%' OR cta_texto LIKE '%Ã%';
-- SELECT 'reviews', id, name, comment FROM reviews WHERE name LIKE '%Ã%' OR comment LIKE '%Ã%';
-- SELECT 'contacts', id, name, email, message FROM contacts WHERE name LIKE '%Ã%' OR message LIKE '%Ã%';
-- SELECT 'payment_config', mp_alias, transfer_alias, holder_name, message FROM payment_config WHERE message LIKE '%Ã%' OR holder_name LIKE '%Ã%';

-- ============================================
-- APLICAR CORRECCIÓN (descomentar para ejecutar)
-- ============================================

-- Testimonials
-- UPDATE testimonials SET
--   name = fix_utf8_encoding(name),
--   comment = fix_utf8_encoding(comment),
--   role = fix_utf8_encoding(role)
-- WHERE name LIKE '%Ã%' OR comment LIKE '%Ã%' OR role LIKE '%Ã%'
--    OR name LIKE '%â€%' OR comment LIKE '%â€%' OR role LIKE '%â€%';

-- Products
-- UPDATE products SET
--   name = fix_utf8_encoding(name),
--   description = fix_utf8_encoding(description),
--   emoji = fix_utf8_encoding(emoji)
-- WHERE name LIKE '%Ã%' OR description LIKE '%Ã%' OR emoji LIKE '%Ã%'
--    OR name LIKE '%â€%' OR description LIKE '%â€%' OR emoji LIKE '%â€%';

-- Categories
-- UPDATE categories SET
--   name = fix_utf8_encoding(name),
--   description = fix_utf8_encoding(description),
--   emoji = fix_utf8_encoding(emoji)
-- WHERE name LIKE '%Ã%' OR description LIKE '%Ã%' OR emoji LIKE '%Ã%'
--    OR name LIKE '%â€%' OR description LIKE '%â€%' OR emoji LIKE '%â€%';

-- Site Texts
-- UPDATE site_texts SET
--   value = fix_utf8_encoding(value)
-- WHERE value LIKE '%Ã%' OR value LIKE '%â€%';

-- Section Content
-- UPDATE section_content SET
--   title = fix_utf8_encoding(title),
--   subtitle = fix_utf8_encoding(subtitle)
-- WHERE title LIKE '%Ã%' OR subtitle LIKE '%Ã%'
--    OR title LIKE '%â€%' OR subtitle LIKE '%â€%';

-- Hero Cards
-- UPDATE hero_cards SET
--   nombre = fix_utf8_encoding(nombre),
--   titulo = fix_utf8_encoding(titulo),
--   subtitulo = fix_utf8_encoding(subtitulo),
--   descripcion = fix_utf8_encoding(descripcion),
--   cta_texto = fix_utf8_encoding(cta_texto)
-- WHERE nombre LIKE '%Ã%' OR titulo LIKE '%Ã%' OR descripcion LIKE '%Ã%' OR cta_texto LIKE '%Ã%'
--    OR nombre LIKE '%â€%' OR titulo LIKE '%â€%' OR descripcion LIKE '%â€%' OR cta_texto LIKE '%â€%';

-- Reviews
-- UPDATE reviews SET
--   name = fix_utf8_encoding(name),
--   comment = fix_utf8_encoding(comment)
-- WHERE name LIKE '%Ã%' OR comment LIKE '%Ã%'
--    OR name LIKE '%â€%' OR comment LIKE '%â€%';

-- Contacts
-- UPDATE contacts SET
--   name = fix_utf8_encoding(name),
--   email = fix_utf8_encoding(email),
--   message = fix_utf8_encoding(message)
-- WHERE name LIKE '%Ã%' OR message LIKE '%Ã%'
--    OR name LIKE '%â€%' OR message LIKE '%â€%';

-- Payment Config
-- UPDATE payment_config SET
--   mp_alias = fix_utf8_encoding(mp_alias),
--   transfer_alias = fix_utf8_encoding(transfer_alias),
--   holder_name = fix_utf8_encoding(holder_name),
--   message = fix_utf8_encoding(message)
-- WHERE message LIKE '%Ã%' OR holder_name LIKE '%Ã%'
--    OR message LIKE '%â€%' OR holder_name LIKE '%â€%';

-- Site Settings (buscar en value JSON)
-- UPDATE site_settings SET
--   value = fix_utf8_encoding(value)
-- WHERE value LIKE '%Ã%' OR value LIKE '%â€%';

-- ============================================
-- Limpiar función auxiliar (opcional)
-- ============================================
-- DROP FUNCTION IF EXISTS fix_utf8_encoding(text);
