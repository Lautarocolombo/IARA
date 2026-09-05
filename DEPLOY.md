# Deploy — Artesanía Gualeguay

## Arquitectura

- **Frontend (estático)**: Vite → `dist/`, hosteado en Vercel (`artesania-gualeguay-v3.vercel.app`).
  - `vercel.json` reescribe `/api/(.*)` → backend de Render y `/uploads/(.*)` → Render.
- **Backend (Node/Express)**: hosteado en Render (`iara-os3h.onrender.com`, ver `render.yaml`).
  - Deploy automático al pushear a la rama `main` del repo conectado.
- **Base de datos**: PostgreSQL (Neon) en producción / SQLite en tests y desarrollo local.

## Almacenamiento de imágenes (importante)

- **Todas las imágenes del catálogo se guardan como base64 en PostgreSQL** (columna `url` como `data:image/webp;base64,...`). No se usa filesystem ni Blob para imágenes de productos, hero cards, carousel, testimonios ni site_texts.
- **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`) es opcional y solo se usa como mejor-esfuerzo para:
  - Comprobantes de pago (PDF/imagen) subidos por clientes → `uploadProofToBlob`, con **fallback a base64 en DB** si el token no está o falla.
  - Recibos PDF generados por el backend (`receiptsController`), con fallback a `/uploads/receipts/`.
- Las URLs legacy `/uploads/...` se sirven desde el backend; si el archivo no existe se devuelve un placeholder SVG.

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

Opcionales: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `BLOB_READ_WRITE_TOKEN`, `SENTRY_DSN`.

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