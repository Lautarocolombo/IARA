# FASE 0 — RELEVAMIENTO TOTAL: IARA (Artesanía Gualeguay)

## 1. Arquitectura del proyecto

| Carpeta | Responsabilidad |
|---------|-----------------|
| `frontend/` | Sitio público estático (HTML, CSS, JS vanilla). Sin framework. Páginas independientes con header/navbar compartido generado por `header.js`. |
| `frontend/css/` | Sistema de estilos: variables, base, components, páginas específicas (cart, checkout, orders, admin), animaciones, pill-buttons. |
| `frontend/js/` | Lógica del cliente: configuración, tema, carrito, wishlist, productos, checkout, pago, admin, conexión/SSE, UI utilities, imágenes seguras. |
| `frontend/pages/` | 16 páginas HTML estáticas (home es `index.html`). |
| `backend/` | API REST Node.js/Express. Sirve estáticos y expone endpoints `/api/*`. |
| `backend/src/controllers/` | 16 controladores (auth, products, orders, payments, categories, heroCards, siteTexts, testimonials, reviews, contact, newsletter, siteConfig, siteSettings, productImages, receipts, reports). |
| `backend/src/routes/` | 19 archivos de rutas montados bajo `/api`. |
| `backend/src/middleware/` | `auth.js` (JWT + permisos) y `errorHandler.js`. |
| `backend/src/lib/` | `db.js` (PostgreSQL/SQLite dual con retry), `upload.js` (Sharp + Vercel Blob), `validators.js` (Zod), `logger.js` (pino). |
| `backend/tests/` | Tests backend (api, productImages, blobUpload). |
| `tests/e2e/` | Playwright (navbar, homepage). |
| `tests/unit/` | Jest (ui, theme, products, cart). |
| `scripts/` | Migraciones, backup, sync Neon, inspección DB. |

---

## 2. Rutas del frontend (páginas)

| # | Página | Ruta | Estado actual |
|---|--------|------|---------------|
| 1 | Home / Catálogo | `frontend/index.html` | Funcional |
| 2 | Producto detalle | `frontend/pages/product.html` | Funcional |
| 3 | Carrito | `frontend/pages/cart.html` | Funcional |
| 4 | Checkout | `frontend/pages/checkout.html` | Funcional |
| 5 | Pedido recibido | `frontend/pages/success.html` | Funcional |
| 6 | Mis Pedidos | `frontend/pages/orders.html` | Funcional |
| 7 | Favoritos | `frontend/pages/wishlist.html` | Funcional |
| 8 | Admin | `frontend/pages/admin.html` | Funcional |
| 9 | Contacto | `frontend/pages/contact.html` | Funcional |
| 10 | Términos | `frontend/pages/terms.html` | Funcional |
| 11 | Privacidad | `frontend/pages/privacy.html` | Funcional |
| 12 | Cambios/Devoluciones | `frontend/pages/devoluciones.html` | Funcional |
| 13 | FAQ | `frontend/pages/faq.html` | Funcional |
| 14 | Envíos | `frontend/pages/shipping.html` | Funcional |
| 15 | Cesión de ubicación | `frontend/pages/cesion-ubicacion.html` | Funcional |
| 16 | 404 | `frontend/pages/404.html` | Funcional |
| 17 | Pulsera (legacy) | `frontend/pages/pulsera.html` | Funcional |

---

## 3. Endpoints del backend

### Públicos (26 endpoints)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/products` | Lista productos activos |
| GET | `/api/products/search` | Busca productos |
| GET | `/api/products/:id/images` | Imágenes de un producto |
| GET | `/api/products/:id/reviews` | Reseñas de producto |
| POST | `/api/products/:id/reviews` | Crear reseña |
| GET | `/api/categories` | Categorías activas |
| GET | `/api/hero-cards` | Cards del hero |
| GET | `/api/testimonials` | Testimonios activos |
| GET | `/api/site-texts` | Textos editables del sitio |
| GET | `/api/site-settings` | Configuración pública |
| GET | `/api/site-config` | Configuración técnica (analytics, WhatsApp) |
| GET | `/api/payment-config` | Alias, WhatsApp, método de pago |
| POST | `/api/contact` | Formulario de contacto |
| POST | `/api/subscribe` | Newsletter |
| POST | `/api/orders` | Crear pedido |
| GET | `/api/orders` | Pedidos por email (usuario) |
| POST | `/api/payments/transfer` | Confirmar transferencia |
| GET | `/api/payments/transfer/status` | Estado de pagos |
| POST | `/api/orders/:id/receipt` | Subir comprobante |
| GET | `/api/sync` | SSE para sincronización |
| GET | `/sitemap.xml` | Sitemap |
| GET | `/health` | Health check |
| GET | `/ready` | Readiness probe |
| GET | `/metrics` | Métricas (protegido) |
| GET | `/` | Sirve `index.html` |
| GET | `/*` | SPA fallback |

### Admin (31 endpoints)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login JWT |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh token |
| PUT | `/api/auth/change-password` | Cambiar contraseña |
| GET | `/api/admin/products` | Lista productos (paginado) |
| POST | `/api/admin/products` | Crear producto |
| PUT | `/api/admin/products/:id` | Editar producto |
| PATCH | `/api/admin/products/:id/estado` | Activar/desactivar |
| POST | `/api/admin/products/:id/duplicar` | Duplicar producto |
| DELETE | `/api/admin/products/:id` | Eliminar producto |
| POST | `/api/admin/products/bulk-import` | Importar CSV/Excel |
| POST | `/api/admin/sync-to-neon` | Sync a Neon |
| GET | `/api/admin/categories` | Lista categorías |
| POST | `/api/admin/categories` | Crear categoría |
| PUT | `/api/admin/categories/:id` | Editar categoría |
| PATCH | `/api/admin/categories/order` | Reordenar |
| DELETE | `/api/admin/categories/:id` | Eliminar categoría |
| GET | `/api/admin/orders` | Lista pedidos (paginado) |
| GET | `/api/admin/orders/:id` | Detalle pedido |
| PATCH | `/api/admin/orders/:id/status` | Cambiar estado |
| PUT | `/api/admin/orders/:id/notes` | Notas internas |
| DELETE | `/api/admin/orders/:id` | Eliminar pedido |
| DELETE | `/api/admin/orders/bulk` | Eliminar seleccionados |
| GET | `/api/admin/orders/export` | Exportar CSV/PDF |
| GET | `/api/admin/reports/sales` | Reporte de ventas |
| GET | `/api/admin/reports/trend` | Tendencia de ventas |
| GET | `/api/admin/reports/weekly-summary` | Resumen semanal |
| POST | `/api/admin/reports/reset` | Reiniciar métricas |
| GET | `/api/admin/testimonials` | Lista testimonios |
| POST | `/api/admin/testimonials` | Crear testimonio |
| PUT | `/api/admin/testimonials/:id` | Editar testimonio |
| PATCH | `/api/admin/testimonials/:id/active` | Activar/desactivar |
| PATCH | `/api/admin/testimonials/:id/order` | Reordenar |
| DELETE | `/api/admin/testimonials/:id` | Eliminar testimonio |
| GET/POST/PUT | `/api/admin/site-texts` | CRUD textos |
| POST | `/api/admin/sync-texts` | Sync textos a Neon |
| GET | `/api/admin/hero-cards` | CRUD hero cards |
| POST/PUT/DELETE | `/api/admin/hero-cards/*` | Operaciones hero |
| POST | `/api/admin/hero-cards/sync` | Sync hero cards |
| GET/PUT | `/api/admin/settings` | Configuración del sitio |
| GET/PUT | `/api/admin/payment-config` | Configuración de pago |
| GET | `/api/admin/contacts` | Contactos recibidos |
| POST | `/api/admin/upload` | Subida genérica de imagen |
| GET | `/api/admin/orders/:id/receipt` | Generar comprobante PDF |
| GET | `/api/admin/orders/:id/receipt/whatsapp` | Enviar comprobante por WhatsApp |

---

## 4. Tablas de base de datos (18 tablas)

| Tabla | Campos principales |
|-------|-------------------|
| `products` | id, name, slug, category, price, description, emoji, image, badge, stock, featured, active, sku, deleted, created_at, updated_at |
| `product_images` | id, product_id, url, alt, filename, cloudinary_public_id, orden, es_principal, descripcion, categoria |
| `categories` | id, name, slug, description, active, orden, emoji, image |
| `orders` | id, items (JSONB), total, customer (JSONB), status, notes, shipping_*, subtotal, shipping_cost, payment_method, created_at |
| `order_items` | (no existe como tabla separada; items está embebido como JSONB en `orders`) |
| `payment_config` | id, mp_alias, transfer_alias, cbu_cvu, holder_name, whatsapp, message, active, mp_enabled, cash_enabled, shipping_cost, free_shipping_from |
| `site_texts` | id, key (UNIQUE), value, updated_at |
| `site_settings` | id, key (UNIQUE), value, updated_at |
| `testimonials` | id, name, comment, rating, image, avatar, role, active, featured, orden |
| `reviews` | id, product_id, rating, comment, name |
| `contacts` | id, name, email, message, status, created_at |
| `subscribers` | id, email (UNIQUE), created_at |
| `hero_cards` | id, nombre, precio, imagen, emoji, orden, activo, titulo, subtitulo, cta_texto, cta_url, slot, tipo |
| `webhook_events` | id, event_id (UNIQUE), source, payload, status, processed_at |
| `activity_log` | id, username, action, entity_type, entity_id, details, ip, created_at |
| `customers` | id, name, email (UNIQUE), phone, address, city, zip, active, blocked, notes |
| `users` | id, username (UNIQUE), password_hash, role, permissions (JSONB), active |
| `product_bulk_imports` | id, filename, status, total_rows, success_rows, error_rows, errors |
| `receipts` | id, order_id, filename, url, sent_whatsapp, sent_email |
| `migrations` | name (PK), applied_at |

---

## 5. Resultados de tests

| Suite | Tests | Pasados | Fallados | Razón |
|-------|-------|---------|----------|-------|
| Frontend unit (Jest) | 19 | 19 | 0 | — |
| Backend unit (Jest) | 21 | 21 | 0 | — |
| E2E (Playwright) | 16 | 3 | 13 | `navbar.spec.js`: test espera 1 `.nav-back` pero hay 3 en páginas internas |

---

## 6. Tabla de estado completa (Fase 0)

| Página / Función | Estado | Severidad | Causa probable |
|------------------|--------|-----------|----------------|
| **HOME** | | | |
| Catálogo productos | Funcional | — | — |
| Filtros por categoría | Funcional | — | — |
| Búsqueda de productos | Funcional | — | — |
| Agregar al carrito | Funcional | — | — |
| Agregar a favoritos | Funcional | — | — |
| Hero cards dinámicas | Funcional | — | — |
| Textos editables | Funcional | — | — |
| Testimonios | Funcional | — | — |
| Contacto / WhatsApp CTA | Funcional | — | — |
| Modo claro/oscuro | Funcional | — | — |
| **CARRITO** | | | |
| Ver items | Funcional | — | — |
| Modificar cantidad | Funcional | — | — |
| Eliminar item | Funcional | — | — |
| Resumen (subtotal/envío/total) | Funcional | — | — |
| Persistencia localStorage | Funcional | — | — |
| Badge carrito sincronizado | Funcional | — | — |
| CSS `var(--text)` no definido | Roto visual | Media | `cart.css` usa variable inexistente |
| **CHECKOUT** | | | |
| Validación de campos | Funcional | — | — |
| Creación de pedido backend | Funcional | — | — |
| **Mensaje WhatsApp NO incluye productos** | **No conforme** | **Alta** | Especificación Fase 5 exige listar productos con precio; mensaje actual es genérico |
| Alias hardcodeado fallback (`iara-salgueiro`) | Riesgo | Media | Si el fetch falla, se usa alias fijo en vez de mostrar error claro |
| Sin protección doble-click | Bug | Alta | Doble envío puede crear pedidos duplicados |
| `loadMpAlias` sin timeout | Bug | Media | Puede quedar en "Cargando..." infinito si el fetch no responde |
| Botón "Continuar al pago" sin estado loading | Bug | Media | No hay feedback visual durante submit |
| **SUCCESS / CONFIRMACIÓN** | | | |
| Resumen del pedido | Funcional | — | — |
| Alias hardcodeado fallback | Riesgo | Media | `success.html` línea 48 tiene `iara-salgueiro` fijo |
| Subida de comprobante | Funcional | — | — |
| Botón WhatsApp | Funcional | — | — |
| **MIS PEDIDOS** | | | |
| Búsqueda por email | Funcional | — | — |
| Visualización de items | Funcional | — | — |
| Sincronización SSE | Funcional | — | — |
| Imágenes de producto en pedido | **No conforme** | **Alta** | `orderSchema` de Zod no incluye `image`; se pierde al validar backend |
| **FAVORITOS** | | | |
| Agregar/quitar | Funcional | — | — |
| Badge sincronizado | Funcional | — | — |
| Persistencia localStorage | Funcional | — | — |
| **ADMIN** | | | |
| Login | Funcional | — | — |
| CRUD Productos | Funcional | — | — |
| Subida de imágenes producto | Funcional | — | — |
| Gestión de pedidos | Funcional | — | — |
| Reportes | Funcional | — | — |
| Cambio de contraseña | Funcional | — | — |
| Health check "Servidor conectado" pero login falla | Bug | Media | Mensaje误导or; el usuario ve "conectado" pero luego "credenciales incorrectas" |
| **E2E TESTS** | | | |
| 13 tests de navbar fallan | Roto | Alta | `header.js` renderiza 3 `.nav-back` en páginas internas; test espera 1 |
| **SEGURIDAD** | | | |
| Credenciales en `render.yaml` | Vulnerabilidad | Crítica | `DATABASE_URL` y `ADMIN_PASS_HASH` expuestos en repo |
| **VARIABLES DE ENTORNO** | | | |
| `vercel.json` apunta a `iara-os3h.onrender.com` | Riesgo | Media | `render.yaml` define `SITE_URL=https://iara-wz9o.vercel.app`; hay inconsistencia de URLs |
| `config.js` tiene WHATSAPP hardcodeado | Riesgo | Baja | Debería venir de backend, aunque hay fallback |
| **CSS / VISUAL** | | | |
| Colores hardcodeados fuera de variables | Inconsistencia | Media | Muchos componentes usan valores directos en vez de `var(--rose-dark)` etc. |
| `var(--text)` indefinido en cart.css | Roto visual | Media | `.cart-help` usa variable que no existe |
| Tipografía admin usa `Inter` vs público `DM Sans` | Inconsistencia | Baja | Admin tiene identidad visual distinta |
| **DATOS DE PRUEBA** | | | |
| `defaultProducts` en `products.js` | Riesgo | Media | Si la API falla, se muestran productos placeholder con imágenes placeholder en producción |

---

## 7. Problemas de deploy / producción

| Issue | Severidad | Detalle |
|-------|-----------|---------|
| Credenciales en `render.yaml` | Crítica | Password de DB y hash de admin visibles en el repositorio |
| URLs inconsistentes entre Vercel/Render | Media | `vercel.json` apunta a `iara-os3h.onrender.com`; `render.yaml` tiene `SITE_URL=https://iara-wz9o.vercel.app` |
| No hay logs de deploy para analizar | Info | No se encontró evidencia de CI/CD fallido reciente |

---

## Próximos pasos recomendados

1. **Fase 1**: Corregir `var(--text)` en cart.css, centralizar colores hardcodeados, verificar modo oscuro en todas las páginas.
2. **Fase 2**: Protección doble-click en checkout, asegurar que todos los botones tienen respuesta.
3. **Fase 3**: Incluir `image` en `orderSchema` del backend para preservar imagen del producto en el pedido.
4. **Fase 4**: Agregar timeout a `loadMpAlias`, loading states, manejo de errores más robusto.
5. **Fase 5**: Reescribir mensaje WhatsApp para incluir lista de productos con nombres, cantidades y precios; agregar protección doble-click; manejo de error si falla fetch del alias.
6. **Fase 6**: Corregir tests E2E de navbar (ajustar selector o cantidad esperada), correr suite completa, deploy.
