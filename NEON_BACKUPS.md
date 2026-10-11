# Documentación de Backups - Neon PostgreSQL

## Resumen
Neon proporciona backups automáticos y point-in-time recovery (PITR) para todas las bases de datos.

## Tipos de Backup

### 1. Backups Automáticos (PITR - Point-in-Time Recovery)
- **Retención**: 7 días (plan gratuito), hasta 30+ días (planes pagos)
- **Frecuencia**: Continuo (WAL streaming)
- **Recuperación**: A cualquier segundo dentro del periodo de retención
- **Costo**: Incluido en el plan

### 2. Branch Protection (Neon Branching)
- **Main branch**: Protegida contra DROP/TRUNCATE accidental
- **Development branches**: Efímeras, se pueden borrar sin afectar producción
- **Branch reset**: Restaurar main a un punto anterior (PITR)

### 3. Manual Backups (pg_dump)
Para exportaciones manuales o migraciones:

```bash
# Backup completo (schema + data)
pg_dump "postgresql://user:pass@host/db?sslmode=require" > backup_$(date +%Y%m%d).sql

# Solo schema
pg_dump --schema-only "postgresql://user:pass@host/db?sslmode=require" > schema_$(date +%Y%m%d).sql

# Solo data
pg_dump --data-only "postgresql://user:pass@host/db?sslmode=require" > data_$(date +%Y%m%d).sql

# Comprimido
pg_dump "postgresql://user:pass@host/db?sslmode=require" | gzip > backup_$(date +%Y%m%d).sql.gz
```

## Procedimiento de Restauración

### Opción A: PITR desde Neon Console (Recomendado)
1. Ir a Neon Console → Project → Branches
2. Click en "Restore" en la branch main
3. Seleccionar timestamp exacto
4. Crear nueva branch restaurada
5. Verificar datos → Swap branch names o actualizar connection string

### Opción B: Restore desde pg_dump
```bash
# Restaurar backup completo
psql "postgresql://user:pass@host/db?sslmode=require" < backup_20261010.sql

# Restaurar solo data (requiere schema existente)
psql "postgresql://user:pass@host/db?sslmode=require" < data_20261010.sql
```

## Verificación de Backups (Mensual)
Ejecutar mensualmente y documentar resultado:

```bash
# 1. Verificar conectividad
psql "postgresql://user:pass@host/db?sslmode=require" -c "SELECT version();"

# 2. Verificar conteo de tablas críticas
psql "postgresql://user:pass@host/db?sslmode=require" -c "
SELECT 'orders' as tabla, COUNT(*) as total FROM orders
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'payment_proofs', COUNT(*) FROM payment_proofs
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log;
"

# 3. Test de restore a branch temporal (opcional)
# En Neon Console: Create branch → Restore from point in time → Verify → Delete branch
```

## Variables de Entorno Requeridas
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require
# Para pg_dump (opcional, si no usar connection string directa)
PGHOST=ep-xxx.region.aws.neon.tech
PGPORT=5432
PGUSER=user
PGPASSWORD=pass
PGDATABASE=db
```

## Monitoreo
- **Neon Console**: Dashboard → Storage/Compute usage
- **Alertas**: Configurar webhook para storage > 80%
- **Logs**: `SELECT * FROM pg_stat_activity WHERE state = 'active';`

## Contacto de Emergencia
- **Neon Support**: support@neon.tech / Console → Help
- **SLA**: 99.9% uptime (planes pagos)
- **RPO**: ~0 (PITR continuo)
- **RTO**: Minutos (branch restore)

---
*Última actualización: 2026-10-10*
*Responsable: Equipo de desarrollo*