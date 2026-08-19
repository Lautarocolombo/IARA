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

## Resumen de commits

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
