-- Migración de reparación para encoding UTF-8 en testimonios
-- El problema: caracteres como "Lucía Fernández" se muestran como "LucÃa FernÃ¡ndez"
-- Esto ocurre cuando datos UTF-8 se interpretan como Latin1 (doble codificación)

-- Función auxiliar para corregir doble codificación UTF-8
CREATE OR REPLACE FUNCTION fix_utf8_encoding(text) RETURNS text AS $$
DECLARE
  bytea_val bytea;
BEGIN
  -- Si el texto contiene patrones de doble codificación comunes, intentar corregir
  bytea_val := convert_to($1, 'UTF8');
  -- Si llegamos aquí sin error, el texto ya está en UTF8 correcto
  RETURN $1;
EXCEPTION WHEN OTHERS THEN
  -- Si falla, intentar decodificar como si fuera Latin1 convertido a UTF8
  BEGIN
    RETURN convert_from(convert_to($1, 'LATIN1'), 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN $1;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Aplicar corrección a la tabla testimonials
UPDATE testimonials SET
  name = fix_utf8_encoding(name),
  comment = fix_utf8_encoding(comment),
  role = fix_utf8_encoding(role)
WHERE name LIKE '%Ã%' OR comment LIKE '%Ã%' OR role LIKE '%Ã%';

-- Aplicar corrección a la tabla products
UPDATE products SET
  name = fix_utf8_encoding(name),
  description = fix_utf8_encoding(description)
WHERE name LIKE '%Ã%' OR description LIKE '%Ã%';

-- Aplicar corrección a la tabla categories
UPDATE categories SET
  name = fix_utf8_encoding(name),
  description = fix_utf8_encoding(description)
WHERE name LIKE '%Ã%' OR description LIKE '%Ã%';

-- Limpiar función auxiliar (opcional, mantener para futuros usos)
-- DROP FUNCTION IF EXISTS fix_utf8_encoding(text);
