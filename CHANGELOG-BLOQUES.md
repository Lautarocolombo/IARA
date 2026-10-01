# Changelog — Bloque 1 a 3

## Bloque 1 — Correcciones críticas y arquitectura

### Backend
- **Fix RBAC permissions**: corregido esquema de permisos en `products.js` de `products.view/create/edit/delete` a `products:read/write/delete` para consistencia con `auth.js`
- **Fix CI workflow**: actualizado `ADMIN_PASS` por `ADMIN_PASS_HASH` con hash bcrypt válido en `.github/workflows/backend-tests.yml`
- **Token blacklist multi-instancia**: migrado de `Set` en memoria a **Redis** con fallback a memoria para desarrollo local. Ahora soporta Vercel serverless correctamente
- **Arquitectura backend definida**: confirmado deploy en Vercel serverless (`/api/*` → `backend/api.js`). Frontend usa URLs relativas (`CONFIG.API.BASE = ''`)

### Frontend
- **Fix syntax error**: removida línea duplicada en `admin-testimonials.js`
- **Fix admin testimonials**: limpieza de código duplicado y estandarización de selectores
- **Fix products.js**: reestructuración de `initProducts` para mejor manejo de filtros y sincronización de datos

### Deploy
- Actualizado `DEPLOY.md` y `frontend/DEPLOY.md` con instrucciones de Vercel serverless
- Removida referencia a `remove.bg` de `backend/DEPLOY.md`

---

## Bloque 2 — Seguridad y testing

### Backend
- **Filtrado `tenant_id` obligatorio**: agregado `(tenant_id = current_setting('app.current_tenant', TRUE) OR tenant_id = 'default')` en todas las queries sensibles de:
  - `ordersController.js` — getOrders, getUserOrders, createOrder, updateOrderStatus, deleteOrder, batchDeleteOrders, updateOrderNotes, getOrderReceipt, getOrderDetail
  - `productsController.js` — getProducts, getProductById, updateProduct, toggleProductStatus, deleteProduct, duplicateProduct, bulkDelete, bulkToggle
  - `couponsController.js` — getCoupons, createCoupon, updateCoupon, deleteCoupon
- **Logger Pino**: reemplazados todos los `console.log/warn/error` por `logger.info/warn/error/debug` en:
  - `server.js` (CORS)
  - `heroCardsController.js`
  - `siteTextsController.js`
  - `upload.js`
- **Test fixes**: actualizadas expectativas de tests en `ordersController.test.js` para reflejar queries con `tenant_id`

### Seguridad
- **SQL injection prevention**: confirmado uso de parámetros preparados en todas las queries
- **XSS protection**: revisado uso de `sanitizeHtml` y `escapeHtml` en controllers y frontend
- **CORS**: confirmado origen allowlist correcto y manejo de preflight

---

## Bloque 3 — Auditoría, rate limiting y cache

### Backend
- **Nuevo módulo de auditoría**: `backend/src/lib/audit.js`
  - `logAudit()` — registra operaciones en `activity_log`
  - `auditMiddleware()` — middleware opcional para logging automático
- **Audit logging implementado** en controllers:
  - `productsController.js` — create, update, toggle_status, delete
  - `couponsController.js` — create, update, delete
  - `categoriesController.js` — create, update, delete
  - `testimonialsController.js` — create, toggle_status, update, delete
  - `heroCardsController.js` — create/update, delete
- **Rate limiting admin**: agregado `adminLimiter` (30 req/min) para `/api/admin/*` en `server.js`
- **Cache headers**: revisados y ajustados headers `Cache-Control` en endpoints públicos y admin
- **Optional chaining fix**: cambiado `req.headers['x-tenant-id']` por `req.headers?.['x-tenant-id']` en todos los controllers para evitar crashes en tests sin headers

### Testing
- Backend: 434/436 tests pasan (2 fallos pre-existentes en `productImages.test.js`)
- Frontend: 365/366 tests pasan (1 fallo pre-existente en `ui.test.js`)
- Lint: 0 errores en backend y frontend

---

```
7541d45 fix: cleanup optional chaining, audit logging y tests
0b44c6a fix: auditoría producción - catálogo, contadores, SEO, mapa, redes, carrusel y testimonios
```

## Deuda técnica pendiente

1. **productImages.test.js** — 2 tests fallan con 401 (auth issue pre-existente)
2. **ui.test.js** — 1 test falla en toggle de navbar (pre-existente)
3. **Frontend unit tests** — `products.test.js` tiene 366 tests pasando correctamente
4. **Backend unit tests** — 434/436 pasando

## Próximos pasos sugeridos

1. Corregir tests pre-existentes fallidos
2. Implementar cache策略 más agresiva en endpoints públicos (CDN)
3. Agregar más audit logging en otros controllers (shipping, siteSettings, etc.)
4. Considerar implementar `auditMiddleware` como middleware global para admin routes
5. Migrar `activity_log` a tabla particionada si crece mucho

---

## Bloque 4 — Fix migraciones Neon / 502 producción (2026-08-20)

### Incidente
El deploy en Render fallaba en el paso de migraciones con:
`[migrations] Error ejecutando migraciones: Not run migration 001_init_schema is preceding already run migration 001_add_order_token`
El backend no levantaba y TODOS los `/api/*` devolvían 502 en producción.

### Causa raíz
- `node-pg-migrate` valida el orden con `checkOrder(runNames, migrations)`
  (`node_modules/node-pg-migrate/dist/bundle/index.js:3534`): exige que la lista de
  migraciones ya ejecutadas (`pgmigrations`, ordenada por `run_on, id`) sea un **prefijo exacto**
  de la lista de archivos (orden por nombre).
- En producción, `pgmigrations` tenía `001_add_order_token` como primer registro (aplicado hace
  tiempo), pero ese archivo fue **renombrado/fundido** en `001_init_schema.sql` en el repo. El nuevo
  primer archivo `001_init_schema` nunca se registró bajo ese nombre.
- Resultado: en la posición 0, `runNames[0]="001_add_order_token"` ≠ `migrations[0]="001_init_schema"`
  → lanza el error.
- `scripts/fix-pgmigrations.js` **enmascaraba** el problema: borraba `001_add_order_token.sql`
  (con `.sql`) e insertaba `001_init_schema.sql` (con `.sql`). Pero node-pg-migrate guarda los
  nombres **SIN extensión** (`basename(migrationPath, extname(...))` en `migration.js:106`), así que
  el DELETE no matcheaba ninguna fila (0 rows) y el INSERT tampoco era reconocido. El error reaparecía
  en cada deploy.

### Fix aplicado
- `backend/scripts/fix-pgmigrations.js` reescrito para:
  1. Leer los nombres de archivo **sin extensión** (formato real de `pgmigrations`).
  2. Eliminar entradas huérfanas (registradas sin archivo, p. ej. `001_add_order_token`).
  3. Insertar como aplicadas las entradas faltantes, reconciliando `pgmigrations` con la lista real
     de archivos. Así `checkOrder` pasa y `node-pg-migrate` queda en estado consistente.
  Solo toca la tabla de control; NO modifica datos de negocio ni tablas del esquema.
- También se puede aplicar manualmente en Neon con la transacción documentada en el PR/commit
  (DELETE de huérfanos + INSERT de los 11 nombres actuales sin `.sql`).

### Prevención
- **Convención de nombres**: las migraciones nuevas usan timestamp `AAAAMMDDHHMMSS_descripcion.sql`
  (ej. `20260820120000_agregar_campo.sql`). Se actualizó `npm run migrate:create` para generarlas así.
  Esto evita colisiones de prefijos (había duplicados `003_` y `009_`) y el problema de renombrar el
  "primer" archivo.
- **`fix-pgmigrations.js`**: debe eliminarse del build una vez confirmado en verde, porque un script
  que "corrige" el estado de migraciones en cada deploy es síntoma de que la causa raíz no está
  resuelta. Dejarlo solo como red de seguridad temporal.
- **Render**: el `render.yaml` de este repo NO incluye el paso de migración (se removió en
  `52afcc7`). Confirmar que el deploy invoca `node scripts/migrate-neon.js` (que corre fix + migraciones)
  antes de `node src/server.js`; si no, correr el SQL manual o reintegrar el paso.

### Verificación pendiente (requiere Neon + deploy)
- `SELECT name, run_on FROM pgmigrations ORDER BY run_on, id;` → debe listar los 11 nombres actuales.
- Endpoints `/api/hero-cards`, `/api/site-texts`, `/api/testimonials`, `/api/products`,
  `/api/site-settings`, `/api/payment-config`, `/api/sync` → esperados 200 (no 502).

---

## Bloque 5 — Cierre de secrets y configuración de entorno (2026-09-22)

### Cambios aplicados

1. **Rotación de secrets**:
   - `JWT_SECRET` → regenerado con `crypto.randomBytes(64)` (64 bytes hex).
   - `CSRF_SECRET` → regenerado con `crypto.randomBytes(32)` (32 bytes hex).
   - `ADMIN_PASS_HASH` → regenerado con bcrypt de `Arteguay2026!Prod`.
   - Nuevos valores cargados en `backend/.env` (desarrollo local).
   - Los valores reales deben cargarse en **Render Dashboard** (variables sensibles) y
     **Vercel Dashboard** (variables públicas/build). `render.yaml` conserva `generateValue: true`
     para `JWT_SECRET` y `CSRF_SECRET` como red de seguridad.

2. **Unificación de migraciones**:
   - Eliminado el directorio `migrations/` obsoleto de la raíz (duplicaba `001_init_schema.sql`
     y causaba el conflicto de orden documentado en Bloque 4).
   - Ahora existe un único sistema: `backend/migrations/`, leído por `backend/src/lib/migrator.js`.
   - `backend/scripts/migrate-neon.js` simplificado: ya no invoca `fix-pgmigrations.js`
     (eliminado). Usa el mismo `runMigrations` de `node-pg-migrate` con tabla `pgmigrations`.
   - `backend/migrations/999_repair_migration_conflict.sql` actualizado con la lista completa
     de 16 migraciones actuales (para reparación manual en Neon si se necesita).

3. **Placeholders corregidos**:
   - `BUSINESS_EMAIL`: `CONFIGURAR_EMAIL` → `contacto@artesaniagualeguay.com`.
   - `INSTAGRAM_URL` / `FACEBOOK_URL`: `#` → URLs reales.
   - `TWITTER_URL`: `#` → vacío (el frontend now oculta el icono si no hay URL).
   - `og:image`: relativo → absoluto (`https://artesania-gualeguay-v3.vercel.app/imagenes/og-image.jpg`).
   - `sameAs` en JSON-LD: URLs genéricas → URLs reales de redes sociales.
   - `canonical`: ya apuntaba correctamente a `artesania-gualeguay-v3.vercel.app`.

4. **Variables de entorno**:
   - `.env.example` (raíz y backend) actualizado: sin placeholders de email, con URLs reales
     de redes sociales y con comments sobre formato WhatsApp (sin 9 para wa.me).
   - Variables detectadas en el código pero no documentadas: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`,
     `MP_INTEGRATOR_ID`, `REDIS_URL`, `LOG_LEVEL`, `METRICS_TOKEN`, `METRICS_ALLOWED_IPS`,
     `CLOUDINARY_CLOUD_NAME` — todas agregadas a `backend/.env.example`.

5. **CORS**:
   - El backend ya incluye `https://artesania-gualeguay-v3.vercel.app` en `defaultOrigins`
     (hardcoded en `server.js:146-156`) y en `ALLOWED_ORIGINS` de `render.yaml`.
   - El middleware CORS manual (preflight 204) cubre `/api/admin/upload` correctamente.

### Pendiente (requiere acción manual en plataformas)
- Cargar los secrets rotados en **Render Dashboard** y **Vercel Dashboard**.
- Configurar `BLOB_READ_WRITE_TOKEN` real (Vercel Blob Store).
- Configurar `RESEND_API_KEY` si se quiere email de contacto.
- Confirmar número WhatsApp con el dueño (actual `+543444634444` sin 9).

---

## Bloque 6 — Tests al 100% y documentación (2026-09-22)

### Tests

- **Frontend unit**: 528/528 tests pasan (Jest + jsdom)
- **Backend unit**: 510/510 tests pasan (Jest + Node)
- **E2E**: 24/24 tests (Playwright)
  - Nuevo `tests/e2e/admin-users.spec.js` — pruebas de navegación del panel de administración de usuarios
  - Nuevo `tests/e2e/payments-mercadopago.spec.js` — pruebas de flujo de pagos
- **Corrección de tests fallantes**:
  - `carouselController.test.js`: 6 tests corregidos (mocks de `res.status` y `res.setHeader`)
  - `blobUpload.test.js`: 3 tests corregidos (manejo de archivos temporales en Windows)

### Documentación

- **CONTRIBUTING.md** creado — guía completa para contribuyentes (estructura, requisitos, flujo, convenciones)
- **README.md** actualizado — nuevos tests, features y conteos actualizados
- **CHANGELOG-BLOQUES.md** actualizado — documentación del Bloque 6

### Cobertura

| Suite | Cobertura statements | Cobertura branches | Tests |
|-------|---------------------|-------------------|-------|
| Frontend | 46.25% | 44.47% | 528 |
| Backend | 82.33% | 71.71% | 510 |
