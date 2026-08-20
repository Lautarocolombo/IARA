# AUDITORÍA TÉCNICA INTEGRAL - IARA e-Commerce

## 1. DIAGNÓSTICO EJECUTIVO

### Fallos Críticos Detectados

| # | Componente | Riesgo | Severidad | Estado Actual |
|---|-----------|--------|-----------|---------------|
| 1 | `vercel.json` | Sin cabeceras de seguridad, sin redirects HTTP→HTTPS, sin optimización de imágenes | CRÍTICO | Configuración mínima |
| 2 | `render.yaml` | Plan `free` con cold starts, credenciales hardcodeadas, sin keep-alive | CRÍTICO | Producción |
| 3 | `backend/src/lib/db.js` | Sin pooling optimizado, sin retry, `idleTimeoutMillis` agresivo (10s) | CRÍTICO | Producción |
| 4 | `backend/src/controllers/ordersController.js` | Sin validación de stock, sin transacciones ACID, sin idempotencia | CRÍTICO | Producción |
| 5 | `backend/src/middleware/auth.js` | JWT sin refresh tokens, sin HttpOnly cookies, comparación plaintext | CRÍTICO | Producción |
| 6 | `backend/src/server.js` | Sin graceful shutdown, sin manejo de señales, CORS con wildcard | ALTO | Producción |
| 7 | `Dockerfile` | Ejecuta `backup.js` en build phase (puede fallar el build) | ALTO | CI/CD |
| 8 | `.env.example` / `render.yaml` | `ADMIN_PASS` en texto plano en ejemplos y configuración | ALTO | Seguridad |
| 9 | `backend/src/controllers/paymentController.js` | Webhook sin idempotencia, sin verificación de firma | CRÍTICO | Pagos |
| 10 | Sin caché Redis/Upstash | Latencia alta en catálogo, carrito y sesiones | MEDIO | Performance |

---

## 2. CAMBIOS ESTRUCTURALES SUGERIDOS

### EJE 1: INFRAESTRUCTURA Y DESPLIEGUE

**Vercel (Frontend):**
- Configurar `vercel.json` con cabeceras de seguridad (CSP estricta, HSTS, X-Frame-Options)
- Implementar redirects HTTP→HTTPS y trailing slash normalization
- Configurar `images` domains para CDN externo
- Estructura preparada para ISR en fichas de producto

**Render (Backend):**
- Migrar a plan `starter` para eliminar cold starts (o implementar keep-alive)
- Eliminar credenciales hardcodeadas de `render.yaml`
- Implementar graceful shutdown y health check mejorado
- Configurar CORS estricto por dominio exacto

### EJE 2: BASE DE DATOS Y PERSISTENCIA

**Connection Pooling:**
- Configurar `max` (20), `idleTimeoutMillis` (30000), `connectionTimeoutMillis` (5000)
- Implementar retry con backoff exponencial
- Añadir validación de conexión al startup

**Transacciones ACID:**
- Wrap de `createOrder` en transacción con `BEGIN`/`COMMIT`/`ROLLBACK`
- Validación de stock antes de crear orden
- Decremento atómico de inventario

**Índices:**
- `products(category)`, `products(created_at)`, `orders(created_at)`, `orders(status)`

### EJE 3: FLUJO DE COMPRA Y SEGURIDAD

**Webhooks (MercadoPago):**
- Implementar idempotencia via `idempotency_key` y tabla `webhook_events`
- Verificación de firma HMAC en endpoints de webhook
- Procesamiento asíncrono con cola de eventos

**Autenticación:**
- HttpOnly cookies con SameSite=Strict para JWT
- Refresh tokens rotatorios (7 días)
- Bcrypt para verificación de contraseñas de admin

**Error Handling:**
- Middleware global que captura todos los errores
- Respuestas JSON estandarizadas sin stack traces en producción
- Logging estructurado con correlation ID

---

## 3. ENTREGABLES

### Paso 2: Código Refactorizado

Los siguientes archivos serán reescritos:

```
vercel.json                          → Proxies, seguridad, redirects
render.yaml                          → Sin credenciales hardcodeadas
Dockerfile                           → Sin scripts en build
backend/src/server.js                → Graceful shutdown, middlewares
backend/src/lib/db.js                → Pool optimizado, retry, transacciones
backend/src/middleware/auth.js       → Cookies HttpOnly, refresh tokens
backend/src/middleware/errorHandler.js → Middleware global (nuevo)
backend/src/controllers/ordersController.js → Stock + transacciones
backend/src/controllers/paymentController.js → Webhook idempotencia (nuevo)
backend/src/routes/payments.js       → Webhook endpoint
backend/.env.example                 → Seguridad mejorada
```

### Paso 4: Matriz de Variables de Entorno

Ver sección al final de este documento.

### Paso 5: Comandos de Migración

```bash
# Instalar dependencias adicionales
npm install express-rate-limit helmet pino jsonwebtoken zod
cd backend && npm install

# Migraciones SQL (ejecutar en Neon)
# Ver script SQL adjunto
```
