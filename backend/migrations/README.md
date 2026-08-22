# Guía de Migraciones - Artesanía Gualeguay

## Orden deMigraciones

Las migraciones se ejecutan en orden alfabético/numérico según el nombre del archivo. Es importante mantener el prefijo numérico para garantizar el orden correcto.

### Convención de Nombres

```
NNN_descripcion_corta.sql
```

Ejemplos:
- `001_init_schema.sql` - Esquema inicial
- `002_add_multi_tenancy.sql` - Soporte multi-tenant
- `010_add_carousel_fields.sql` - Campos del carrusel

### Reglas para Migraciones Seguras

1. **Usar `IF NOT EXISTS`** para tablas e índices:
   ```sql
   CREATE TABLE IF NOT EXISTS nombre_tabla (...);
   CREATE INDEX IF NOT EXISTS idx_nombre ON tabla(columna);
   ```

2. **Usar `ADD COLUMN IF NOT EXISTS`** para columnas:
   ```sql
   ALTER TABLE tabla ADD COLUMN IF NOT EXISTS columna TIPO DEFAULT valor;
   ```

3. **Usar `DROP ... IF EXISTS` antes de crear** para políticas RLS y objetos que no soportan `IF NOT EXISTS`:
   ```sql
   DROP POLICY IF EXISTS nombre_politica ON tabla;
   CREATE POLICY nombre_politica ON tabla ...;
   ```

4. **Usar `ON CONFLICT` para inserts** que pueden duplicarse:
   ```sql
   INSERT INTO tabla (col) VALUES (val) ON CONFLICT (col) DO NOTHING;
   ```

## Solución de Problemas

### Error: "001_init_schema no está ejecutada pero 001_add_order_token ya fue ejecutada"

Este error ocurre cuando:
- Las tablas se crearon manualmente o por otro medio
- El sistema de migraciones no registro la migración inicial

**Solución:**
Ejecutar el script de reparación en la base de datos:

```bash
# Conectar a la base de datos de Neon/Postgres y ejecutar:
psql $DATABASE_URL -f backend/migrations/999_repair_migration_conflict.sql
```

O manualmente:
```sql
-- Marcar 001_init_schema como aplicada si la tabla orders existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders')
     AND NOT EXISTS (SELECT 1 FROM migrations WHERE name = '001_init_schema.sql') THEN
    INSERT INTO migrations (name, applied_at) VALUES ('001_init_schema.sql', CURRENT_TIMESTAMP);
  END IF;
END $$;

-- Eliminar registro huérfano si existe
DELETE FROM migrations WHERE name = '001_add_order_token';
```

### Error: "policy already exists"

Si una migración de RLS falla porque la política ya existe:
```sql
-- Eliminar política existente y recrear
DROP POLICY IF EXISTS nombre_politica ON tabla;
CREATE POLICY nombre_politica ON tabla ...;
```

### Error: "relation already exists"

Si una migración de tabla falla porque la tabla ya existe:
```sql
-- La migración debería usar CREATE TABLE IF NOT EXISTS
-- Si no lo hace, modificarla antes de ejecutar
```

## Estado Actual de Migraciones

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| 001_init_schema.sql | Esquema base | ✅ Aplicar |
| 002_add_multi_tenancy.sql | Columnas tenant_id | ✅ Aplicar |
| 003_add_missing_columns.sql | Columnas faltantes | ✅ Aplicar |
| 003_enable_rls.sql | Row Level Security | ✅ Aplicar (idempotente) |
| 004_add_orders_missing_columns.sql | Columnas de envío | ✅ Aplicar |
| 005_add_coupons.sql | Tabla de cupones | ✅ Aplicar |
| 006_add_order_coupon_fields.sql | Cupones en órdenes | ✅ Aplicar |
| 007_shipping_rates.sql | Tarifas por provincia | ✅ Aplicar |
| 008_add_users_last_login.sql | Tracking de login | ✅ Aplicar |
| 009_carousel_images.sql | Carrusel de imágenes | ✅ Aplicar |
| 009_section_content.sql | Contenido de secciones | ✅ Aplicar |
| 010_add_carousel_fields.sql | Campos de carrusel | ✅ Aplicar |
| 011_fix_utf8_encoding.sql | Fix encoding UTF-8 | ✅ Aplicar |
