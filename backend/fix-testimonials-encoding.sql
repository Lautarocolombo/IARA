-- Script SQL para corregir encoding corrupto en testimonios
-- Ejecutar en el SQL Editor de Neon (https://console.neon.tech)

BEGIN;

-- Ver cuántos registros están afectados
SELECT 'name' as columna, count(*) as corruptos FROM testimonials WHERE name LIKE '%Ã%'
UNION ALL
SELECT 'comment', count(*) FROM testimonials WHERE comment LIKE '%Ã%'
UNION ALL
SELECT 'role', count(*) FROM testimonials WHERE role LIKE '%Ã%';

-- Corregir nombres corruptos
UPDATE testimonials
SET name = convert_from(convert_to(name, 'LATIN1'), 'UTF8')
WHERE name LIKE '%Ã%';

-- Corregir comentarios corruptos
UPDATE testimonials
SET comment = convert_from(convert_to(comment, 'LATIN1'), 'UTF8')
WHERE comment LIKE '%Ã%';

-- Corregir cargos corruptos
UPDATE testimonials
SET role = convert_from(convert_to(role, 'LATIN1'), 'UTF8')
WHERE role LIKE '%Ã%';

COMMIT;

-- Verificar resultado
SELECT id, name, role, comment FROM testimonials WHERE name LIKE '%Ã%' OR comment LIKE '%Ã%' OR role LIKE '%Ã%';
