# Deploy — Artesanías Gualeguay

## Arquitectura

- **Frontend (estático)**: Vite → `dist/`, hosteado en Vercel (`artesania-gualeguay-v3.vercel.app`).
  - `vercel.json` reescribe `/api/(.*)` → backend de Render y `/uploads/(.*)` → Render.
- **Backend (Node/Express)**: hosteado en Render (`iara-os3h.onrender.com`, ver `render.yaml`).
  - Deploy automático al pushear a la rama `main` del repo conectado.
- **Base de datos**: PostgreSQL (Neon) en producción / SQLite en tests y desarrollo local.
## Almacenamiento de imágenes (importante)

El backend elige el modo según `BLOB_READ_WRITE_TOKEN`, en `processFile` (`backend/src/lib/upload.js`). El token se valida al arrancar: debe empezar por `vercel_blob_`; cualquier otro valor se ignora y se cae al modo base64.

| Modo | Condición | Dónde queda la imagen | URL guardada |
|------|-----------|-----------------------|--------------|
| **Vercel Blob** | `BLOB_READ_WRITE_TOKEN` válido y la subida tiene éxito | `products/<ts>_<nombre>.<ext>` en el Blob store | `https://<store>.blob.vercel-storage.com/...` |
| **Base64** | Sin token, token inválido o error de subida | Fila de PostgreSQL, columna `url` | `data:image/webp;base64,...` |

En ambos modos la imagen se optimiza a WebP antes de guardarse y el archivo temporal se borra del disco. El modo Blob aplica igual a productos, hero cards, carousel y testimonios. Los comprobantes de pago siguen su propio camino (`uploadProofToBlob`) y los recibos PDF los genera el backend.

- Las URLs legacy `/uploads/...` se sirven desde el backend; si el archivo no existe se devuelve un placeholder SVG.

### Costo de cada modo

**Base64 (modo actual por defecto)**

- El encoding añade ~33% sobre el binario: una foto optimizada a WebP de 120 KB ocupa ~160 KB de fila.
- Las imágenes se duplican si el mismo asset se sube en más de un lugar, y no hay deduplicación.
- Cada lectura de `/api/products` arrastra el peso de las imágenes en la respuesta: con 50 productos y 3 fotos cada uno, el payload puede pasar de 5 MB a 20 MB.
- `GET /health` reporta `blob: not_configured` como recordatorio.
- Límite práctico de Neon en el plan gratuito: ~0,5 GB. Un catálogo de 300 imágenes de 120 KB lo agota en menos de un mes.
- A favor: cero configuración, cero archivos que respaldar, y los dumps de la DB incluyen todo el catálogo.

**Vercel Blob**

- Las filas quedan livianas (solo la URL) y las imágenes se sirven por CDN con caché.
- La base deja de crecer con el catálogo y los dumps se vuelven manejables.
- Costo: almacenamiento y transferencia se cobran por GB según el plan de Vercel, y las imágenes quedan fuera de los backups de la base, así que requieren su propio ciclo de respaldo si eso importa.
- Requiere generar el token en Vercel Dashboard → Storage → Blob y configurarlo **tanto en Render como en Vercel** (ver variables más abajo).

### Recomendación

Para el volumen de un catálogo artesanal, activar Blob. El base64 queda como fallback válido si el token no está disponible, y el cambio no requiere migrar los datos ya almacenados: las filas existentes en base64 siguen sirviéndose tal cual porque `getPublicUrl` devuelve el data URI sin tocar. Migrar las filas existentes a Blob es opcional y se puede hacer por lotes.

## Variables de entorno backend

Ver `.env.example` (raíz y `backend/`). Obligatorias:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<random 64+ chars>
CSRF_SECRET=<random 32+ chars>
ADMIN_USER=<username>
ADMIN_PASS_HASH=<bcrypt hash>
SITE_URL=https://artesania-gualeguay-v3.vercel.app
BACKEND_URL=https://iara-os3h.onrender.com
ALLOWED_ORIGINS=https://artesania-gualeguay-v3.vercel.app,https://*.vercel.app,https://artesaniagualeguay.com,http://localhost:3000,http://localhost:5173
```

Opcionales: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `ADMIN_EMAIL`, `BLOB_READ_WRITE_TOKEN`, `SENTRY_DSN`, `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_INTEGRATOR_ID`, `REDIS_URL`, `METRICS_TOKEN`.

## Pre-Deploy — Checklist obligatorio

Antes de hacer deploy, completar estos pasos:

### 1. Rotar tokens expuestos
Si los siguientes tokens fueron expuestos en archivos locales, **rotar inmediatamente** en Vercel Dashboard → Settings → Tokens y en Vercel Blob Dashboard:
- `VERCEL_OIDC_TOKEN`
- `BLOB_READ_WRITE_TOKEN`

### 2. Variables de Render Dashboard (manuales)
Ir a **Render Dashboard → iara-backend → Environment** y configurar:

| Variable | Acción | Crítica |
|----------|--------|---------|
| `DATABASE_URL` | Conexión PostgreSQL (Neon) | 🔴 Sí |
| `ADMIN_PASS_HASH` | bcrypt hash de contraseña admin (`npx bcrypt-cli hash`) | 🔴 Sí |
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob Store (`vercel.com/dashboard/stores`) | 🔴 Sí |
| `CSRF_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 🟡 Recomendado |
| `RESEND_API_KEY` | API key de Resend para emails | 🟡 Si usa email |
| `MP_ACCESS_TOKEN` | Token de Mercado Pago | 🟡 Si usa MP |
| `MP_PUBLIC_KEY` | Public key de Mercado Pago | 🟡 Si usa MP |
| `ADMIN_EMAIL` | Email de notificaciones admin | 🟡 Recomendado |

### 3. Variables de Vercel Dashboard
Ir a **Vercel Dashboard → artesania-gualeguay-v3 → Settings → Environment Variables**:
- `DATABASE_URL` (mismo valor que Render)
- `JWT_SECRET` (mismo valor que Render)
- `ADMIN_USER`, `ADMIN_PASS_HASH`
- `ALLOWED_ORIGINS`
- `SITE_URL`, `BACKEND_URL`
- `BLOB_READ_WRITE_TOKEN` (mismo token que Render)

### 4. Build y probar
```bash
npm run build          # Verificar que build pase sin errores
npm run lint           # Verificar que lint no tenga errores
```

## Deploy

### Vercel (frontend)
1. Build command: `npm run build` → output `dist`.
2. Configurar `vercel.json` (rewrites `/api/*` y `/uploads/*` → Render).
3. Node.js `20.x` LTS.

### Render (backend)
1. Conectar el repo GitHub (ver `render.yaml`: `autoDeploy: main`).
2. Configurar variables de entorno en dashboard.
3. Build: `npm ci --only=production`; start: `node src/server.js`.
4. Las migraciones (`backend/migrations/*.sql`) se aplican automáticamente al arrancar.

## Health checks

- `GET /health` — estado general + DB + blob + Sentry
- `GET /ready` — readiness probe (solo DB)
- `GET /metrics` — memoria, CPU, uptime (protegido por IP/token)

## Rollback

### Vercel
```bash
vercel rollback
```

### Render
1. Ir a Dashboard → Manual Deploy
2. Seleccionar deploy anterior
3. Confirmar rollback

### Base de datos
- Antes de migraciones: `pg_dump $DATABASE_URL > backup.sql`
- Para rollback DB: `psql $DATABASE_URL < backup.sql`
- Migraciones: único sistema en `backend/migrations/` (ejecutadas automáticamente al arrancar por `backend/src/lib/migrator.js`). El directorio `migrations/` de la raíz fue eliminado (era obsoleto y duplicaba `001_init_schema.sql`).
- Para reparación manual de orden de migraciones: `psql $DATABASE_URL -f backend/migrations/999_repair_migration_conflict.sql`

## Monitoreo

- Sentry: errores frontend + backend
- Vercel Analytics: métricas de rendimiento
- `/metrics`: memoria/CPU (acceso restringido)

## Comandos locales

```bash
npm run dev          # Backend en puerto 3000
npm test             # Frontend unit tests
npm run lint         # Frontend lint
npm run e2e          # Playwright E2E
cd backend && npm test  # Backend tests
cd backend && npm run lint  # Backend lint
```