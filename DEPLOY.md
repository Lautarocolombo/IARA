# Deploy — Artesanía Gualeguay

## Requisitos

- Node.js 20.x LTS
- PostgreSQL (producción) / SQLite (desarrollo)
- Variables de entorno en Vercel Dashboard (ver `.env.example`)

## Variables obligatorias en Vercel Dashboard

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
ALLOWED_ORIGINS=https://artesaniagualeguay.com,https://*.vercel.app,http://localhost:3000,http://localhost:5173
JWT_SECRET=<random 64+ chars>
ADMIN_USER=<username>
ADMIN_PASS_HASH=<bcrypt hash>
SITE_URL=https://artesania-gualeguay-v3.vercel.app
RESEND_API_KEY=<resend key>
EMAIL_FROM=noreply@artesaniagualeguay.com
ADMIN_NOTIFICATION_EMAIL=admin@artesaniagualeguay.com
BLOB_READ_WRITE_TOKEN=<vercel blob token>
```

## Deploy en Vercel

1. Conectar repo en Vercel
2. Configurar variables en Vercel Dashboard (no commitear `.env`)
3. Build command: `npm run build`
4. Output directory: `dist`
5. Install command: `npm install`
6. Node.js: `20.x` LTS
7. El backend se despliega como serverless function en Vercel (`/api/*` → `backend/api.js`)
8. Habilitar Vercel Blob para almacenamiento de imágenes

## Notas

- No subir archivos `.env` al repositorio. Usar Vercel Dashboard para secrets.
- Si necesitás Render como backend alternativo, configurar `CONFIG.API.BASE` en `frontend/js/config.js` con la URL de Render.
- El service worker y archivos estáticos se sirven desde Vercel.

## Health checks

- `GET /health` — estado general + DB + Sentry
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
- Hacer backup antes de migraciones: `pg_dump $DATABASE_URL > backup.sql`
- Para rollback DB: `psql $DATABASE_URL < backup.sql`

## Monitoreo

- Sentry: errores frontend + backend
- Vercel Analytics: métricas de rendimiento
- /metrics: memoria/CPU (acceso restringido)

## Staging

Consultá la documentación de staging para probar cambios antes de producción.

## Comandos locales

```bash
npm run dev          # Backend en puerto 3000
npm test             # Unit tests
npm run lint         # Lint
npm run e2e          # Playwright E2E
cd backend && npm test  # Backend tests
```
