# BASELINE - Estado inicial antes del refactor

**Fecha:** 2026-10-11
**Commit:** (pendiente - se registrará al finalizar Fase 0)

---

## 1. Suite de Tests

| Ámbito | Tests | Estado | Tiempo |
|--------|-------|--------|--------|
| Backend | 615 (1 fail pre-existente) | ✅ 614 pass / 1 fail | 8.67s |
| Frontend | 554 | ✅ 554 pass | 10.2s |
| **Total** | **1,169** | **✅ 1,168 pass / 1 fail** | **~19s** |

### Fallo pre-existente conocido
- **Archivo:** `backend/tests/ordersController.test.js`
- **Test:** `updateOrderStatus › actualiza estado y restaura stock si se cancela`
- **Causa:** Mock del test no coincide con el orden real de queries en `restoreStockOnCancellation` (llama a `query` para obtener stock antes de actualizar). El código de producción funciona correctamente; es un problema del test.

---

## 2. Lint

| Ámbito | Estado |
|--------|--------|
| Frontend (`eslint frontend/js/ tests/ --ext .js`) | ✅ Pass |
| Backend (`eslint src --ext .js`) | ✅ Pass |

---

## 3. Build

| Comando | Estado | Tiempo | Output |
|---------|--------|--------|--------|
| `npm run build` (Vite) | ✅ Pass | 921ms | `dist/` generado correctamente |

---

## 4. Cobertura de Flujos Críticos (Análisis Preliminar)

| Flujo Crítico | Cobertura Test | Archivos Involucrados | Riesgo |
|---------------|----------------|----------------------|--------|
| **Crear pedido** | ✅ Unit + E2E | `ordersController.createOrder`, `checkout.js` | Bajo |
| **Descuento de stock** | ✅ Unit (mock) | `orders/stock.js`, `inventoryController` | Medio (mock no cubre concurrencia real) |
| **Webhook MercadoPago** | ⚠️ Parcial | `paymentController.js`, `mercadopagoService.js` | Alto (sin tests de idempotencia) |
| **Login / Auth** | ✅ Unit + E2E | `authController.js`, `admin.js` | Bajo |
| **Cancelación pedido + restitución stock** | ✅ Unit (1 fail mock) | `ordersController.updateOrderStatus`, `orders/stock.js` | Medio |
| **WhatsApp / Checkout** | ✅ Unit + E2E | `checkout.js`, `config.js`, `whatsapp.js` | Bajo |
| **Subida imágenes / Vercel Blob** | ⚠️ Parcial | `productImagesController`, `upload.js` | Medio |
| **CSRF / Seguridad** | ✅ Unit | `csrf.js`, `api.test.js` | Bajo (modo degradado en dev) |

---

## 5. Mapa de Dependencias Clave

### `backend/src/lib/db.js` (1280 líneas) - **MÁS IMPORTADO**
```
Consumidores directos (require '../lib/db'):
├── Controllers (26): authController, carouselController, categoriesController,
│   configController, couponsController, dataController, earningsController,
│   heroCardsController, historyController, inventoryController,
│   paymentController, paymentProofsController, productImagesController,
│   productsController, receiptsController, reportsController, reviewsController,
│   salesController, sectionContentController, shippingController,
│   siteConfigController, siteSettingsController, siteTextsController,
│   testimonialsController, usersController
├── Middlewares (3): auditLog, requireOrderToken, tenant
├── Rutas (6): admin, contact, health, newsletter, sitemap
├── Scripts (5): migrate-all-images-to-blob, migrate-to-base64, migrateImages
├── Servicios (1): mercadopagoService
└── Librerías (1): audit.js
```
**Exports usados:** `query`, `transaction`, `isLocal`, `runMigrationsOnly`, `seedLocalData`, `ensureAdminUser`, `setTenant`, `pool`, `connectionString`

### `backend/src/controllers/ordersController.js` (694 líneas) - **YA REFACTORIZADO EN FASE 1 PREVIA**
```
Importado por: src/routes/orders.js (línea 4)
Re-exportado desde: src/controllers/orders/index.js → { queries, mutations, activities, stock }
```
**Estado actual:** Ya dividido en `queries.js`, `mutations.js`, `activities.js`, `stock.js` con `index.js` como fachada.

### `frontend/js/config.js` - **CENTRAL PARA FRONTEND**
```
Consumidores (window.CONFIG / import):
├── admin.js, admin-carousel.js, admin-content.js, admin-dashboard.js,
│   admin-orders.js, admin-pages.js, admin-payments.js, admin-products.js,
│   admin-settings.js
├── about-carousel.js, account.js, analytics.js, blog.js, cart.js, checkout.js
├── hero.js, home-init.js, products.js, tracking.js, ui.js
├── checkout.js (importa whatsapp.js)
└── Configuración por defecto: WhatsApp, coords, shipping, API, theme, etc.
```
**Defaults hardcodeados en `DEFAULT_CONFIG`** que deberían venir de BD/env.

### `backend/src/middleware/csrf.js`
```
Montado en: src/server.js líneas 376 (/api/v1) y 428 (/api)
Middleware: csrfProtection
Dependencias: crypto, process.env.CSRF_SECRET, process.env.ALLOWED_ORIGINS
Modo actual: "DEGRADADO" en dev (solo origin-check, sin token CSRF real)
Consumidor: Solo montado en server.js, no importado directamente por otros módulos
```

---

## 6. Archivos de Configuración / Build

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `package.json` (root) | Scripts, deps, engines | ✅ |
| `package.json` (backend) | Scripts, deps, opcional: bullmq, ioredis | ✅ |
| `vite.config.mjs` | Build frontend | ✅ |
| `vercel.json` | Rewrites /api → Render | ✅ |
| `render.yaml` | Deploy backend | (no verificado) |
| `.env.example` | Template variables | ✅ |

---

## 7. Variables de Entorno Críticas (Backend)

| Variable | Requerida | Default | Uso |
|----------|-----------|---------|-----|
| `JWT_SECRET` | ✅ | - | Auth tokens |
| `ADMIN_USER` | ✅ | - | Login admin |
| `ADMIN_PASS_HASH` | ✅ | - | Login admin |
| `DATABASE_URL` | Solo prod | - | PostgreSQL (Render) |
| `ALLOWED_ORIGINS` | Solo prod | - | CORS + CSRF origin check |
| `CSRF_SECRET` | Solo prod | - | CSRF token signing |
| `REDIS_URL` | Opcional | - | Rate limit + Session + BullMQ |
| `BLOB_READ_WRITE_TOKEN` | Opcional | - | Vercel Blob |
| `RESEND_API_KEY` | Opcional | - | Emails |
| `SENTRY_DSN` | Opcional | - | Error tracking |

---

## 7. Cómo Revertir Fase 0 (no aplica - solo auditoría)

```bash
# No hay cambios que revertir en Fase 0
```

---

## 8. Próximos Pasos (Fase 1)

1. **Crear rama:** `git checkout -b refactor/fase-1-db-split`
2. **Dividir `db.js`** en `backend/src/lib/db/`:
   - `pool.js` - conexión y adaptador SQLite/PG
   - `migrations.js` - ejecución y versionado
   - `seeds.js` - datos iniciales
   - `bootstrap.js` - inicialización y orquestación
   - `index.js` - fachada que reexporta TODO (compatibilidad total)
3. **Verificar:** tests backend, tests frontend, lint, build
4. **Commit atómico** con mensaje convencional

---

**Firmado:** Auditoría completada. Baseline guardado. Listo para Fase 1.