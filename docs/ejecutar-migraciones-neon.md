# Ejecutar migraciones en Neon producción

## Estado actual

Existen migraciones pendientes de aplicar en la base de datos Neon de producción:
- `scripts/rls-setup.sql` - Multi-tenancy y Row Level Security
- `scripts/migrations.sql` - Migraciones adicionales
- `backend/migrations/` - Migraciones node-pg-migrate

## Requisitos previos

1. Acceso a Neon dashboard: https://neon.tech/
2. Credenciales actualizadas de la base de datos
3. `DATABASE_URL` configurada en variables de entorno

## Opción 1: Ejecutar SQL directamente en Neon

1. Ir a Neon Dashboard → **SQL Editor**
2. Copiar contenido de `scripts/rls-setup.sql`
3. Pegar y ejecutar en el editor SQL
4. Verificar que no haya errores
5. Repetir con `scripts/migrations.sql` si aplica

## Opción 2: Ejecutar migraciones node-pg-migrate

```bash
cd backend

# Configurar DATABASE_URL
export DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-purple-water-axuf1ls3-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Aplicar migraciones
npm run migrate

# O ejecutar el runner actualizado
node scripts/run-migrations.js up
```

## Opción 3: Usar script de migración personalizado

```bash
cd backend
node scripts/migrate-neon.js
```

## Verificación post-migración

```bash
# Verificar tablas creadas
cd backend
node -e "
const { query } = require('./src/lib/db');
query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\")
  .then(r => console.log(r.rows.map(x => x.table_name)))
  .catch(e => console.error(e));
"
```

## Rollback

Si algo sale mal, usar:
```bash
npm run migrate:down
```

O revertir manualmente desde Neon SQL Editor.

## Notas

- Las migraciones son **idempotentes** (usar `IF NOT EXISTS`)
- Ejecutar primero en staging si es posible
- Hacer backup antes de migrar (ejecutar `npm run backup`)
